import json
import hashlib
import logging
import random
from typing import Any, Dict, Optional

import requests

from app.config import settings


logger = logging.getLogger(__name__)

MOCK_REVIEW_FLAG = "Scored by the offline fallback scorer (no LLM configured). Re-run once an LLM is configured."


class LLMUnavailableError(RuntimeError):
    """An LLM is configured but could not produce a usable evaluation.

    Raised instead of silently falling back to the mock, so a real hackathon
    never stores a made-up score.
    """


class LLMClient:
    """Thin HTTP client that prefers Gemini, then a configurable generic LLM
    backend. The deterministic mock is used only when neither is configured
    (local development and tests). Every result carries a `_source` key."""

    def __init__(self, url: str = None, token: str = None):
        self.url = url if url is not None else settings.ai_backend_url
        self.token = token if token is not None else settings.ai_backend_token

    def complete_json(
        self,
        prompt: str,
        temperature: float = 0.2,
        categories: Optional[Dict[str, int]] = None,
    ) -> Dict[str, Any]:
        """Call the LLM and return a parsed JSON object."""
        if settings.gemini_api_key:
            result = self._call_gemini(prompt, temperature)
            result["_source"] = "gemini"
            return result
        if self.url:
            result = self._call_generic_backend(prompt, temperature)
            result["_source"] = "generic"
            return result
        if settings.is_production:
            raise LLMUnavailableError("No LLM is configured. Set GEMINI_API_KEY to evaluate submissions.")
        return self._mock_response(prompt, categories=categories)

    def _gemini_models(self):
        # Some model names are listed but not available for generateContent on every
        # account, so a 404 moves on to the next alias. Duplicates are skipped.
        models = [
            settings.gemini_model,
            "gemini-3.5-flash-lite",
            "gemini-3.5-flash",
            "gemini-flash-latest",
        ]
        return list(dict.fromkeys(m for m in models if m))

    def _call_gemini(self, prompt: str, temperature: float) -> Dict[str, Any]:
        payload = {
            "contents": [{"role": "user", "parts": [{"text": prompt}]}],
            "generationConfig": {
                "temperature": temperature,
                "responseMimeType": "application/json",
                "maxOutputTokens": 8192,
            },
        }
        # The key goes in a header, not the URL, so it never appears in error messages or logs.
        headers = {"x-goog-api-key": settings.gemini_api_key, "Content-Type": "application/json"}
        last_error = "no Gemini model configured"
        for model in self._gemini_models():
            endpoint = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"
            try:
                r = requests.post(endpoint, headers=headers, json=payload, timeout=settings.llm_timeout_seconds)
            except requests.RequestException as exc:
                # Timeouts and network errors are not model-specific; trying more models
                # would only multiply the wait past the gateway timeout.
                raise LLMUnavailableError(f"Gemini request failed ({model}): {type(exc).__name__}") from exc
            if r.status_code == 404:
                last_error = f"model {model} not available"
                logger.warning("Gemini model %s not available for generateContent, trying next", model)
                continue
            if r.status_code >= 400:
                raise LLMUnavailableError(f"Gemini returned HTTP {r.status_code} ({model})")
            try:
                text = self._extract_gemini_text(r.json())
                result = self._extract_json({"content": text})
            except (ValueError, KeyError, TypeError) as exc:
                raise LLMUnavailableError(f"Gemini returned an unreadable response ({model}): {exc}") from exc
            return self._ensure_judge_questions(result)
        raise LLMUnavailableError(f"No Gemini model accepted the request: {last_error}")

    def _extract_gemini_text(self, data: Dict[str, Any]) -> str:
        candidates = data.get("candidates", [])
        if not candidates:
            raise ValueError("No candidates in Gemini response")
        content = candidates[0].get("content", {})
        parts = content.get("parts", [])
        return "".join(part.get("text", "") for part in parts)

    def _call_generic_backend(self, prompt: str, temperature: float) -> Dict[str, Any]:
        headers = {"Content-Type": "application/json"}
        if self.token:
            headers["Authorization"] = f"Bearer {self.token}"

        payload = {
            "prompt": prompt,
            "temperature": temperature,
            "response_format": {"type": "json_object"},
        }
        try:
            r = requests.post(self.url, headers=headers, json=payload, timeout=settings.llm_timeout_seconds)
            r.raise_for_status()
            result = self._extract_json(r.json())
        except (requests.RequestException, ValueError, KeyError, TypeError) as exc:
            raise LLMUnavailableError(f"LLM backend request failed: {type(exc).__name__}: {exc}") from exc
        return self._ensure_judge_questions(result)

    def _extract_json(self, data: Dict[str, Any]) -> Dict[str, Any]:
        # Try common wrapper shapes
        if "response" in data and isinstance(data["response"], str):
            return json.loads(data["response"])
        if "choices" in data and data["choices"]:
            content = data["choices"][0].get("message", {}).get("content") or data["choices"][0].get("text", "")
            return json.loads(content)
        if "content" in data and isinstance(data["content"], str):
            return json.loads(data["content"])
        return data

    def _ensure_judge_questions(self, result: Dict[str, Any]) -> Dict[str, Any]:
        if not isinstance(result.get("judge_questions"), list):
            result["judge_questions"] = [
                "Walk us through the biggest trade-off you made in this project.",
                "Which part of the problem statement was hardest to address and why?",
                "If you had one more day, what would you improve or add?",
            ]
        return result

    def _mock_response(
        self,
        prompt: str,
        categories: Optional[Dict[str, int]] = None,
    ) -> Dict[str, Any]:
        """Deterministic fallback when no LLM backend is configured (development only)."""
        seed = int(hashlib.md5(prompt.encode()).hexdigest(), 16)
        rng = random.Random(seed)
        categories = categories or self._default_categories()
        total = sum(categories.values())
        # Vary score with input but keep within plausible SATISFACTORY/EXCELLENT range
        base = rng.randint(520, 820)
        return {
            "total_score": base,
            "category_scores": {
                cat: rng.randint(int(max_ * 0.4), max_) for cat, max_ in categories.items()
            },
            "verdict": "SATISFACTORY" if base < 700 else "EXCELLENT",
            "authenticity_band": "MIXED",
            "authenticity_multiplier": 0.85,
            "overall_assessment": "Fallback assessment because no LLM backend is configured.",
            "key_strengths": ["Coherent structure"],
            "areas_for_improvement": ["Add more problem-specific detail"],
            "red_flags": [],
            "recommendation": "Configure GEMINI_API_KEY or AI_BACKEND_URL for real evaluation.",
            "judge_questions": [
                "Walk us through the biggest trade-off you made in this project.",
                "Which part of the problem statement was hardest to address and why?",
                "If you had one more day, what would you improve or add?",
            ],
            "_source": "mock",
            "_rubric_total": total,
        }

    def _default_categories(self):
        # Avoid circular import; both rubrics use same keys per prompt, so default map
        return {
            "Problem Understanding": 150,
            "Implementation Completeness": 200,
            "Code Quality & Architecture": 150,
            "Innovation & Creativity": 150,
            "Technical Feasibility": 100,
            "Documentation": 100,
            "Commit Authenticity / Effort": 100,
            "Presentation / Demo": 50,
        }
