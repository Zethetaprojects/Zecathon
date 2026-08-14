import json
import hashlib
import random
from typing import Any, Dict

import requests

from app.config import settings


class LLMClient:
    """Thin HTTP client that prefers Gemini 2.5 Flash, falls back to a configurable
    generic LLM backend, and finally to a deterministic mock for offline testing."""

    def __init__(self, url: str = None, token: str = None):
        self.url = url or settings.ai_backend_url
        self.token = token or settings.ai_backend_token

    def complete_json(self, prompt: str, temperature: float = 0.2) -> Dict[str, Any]:
        """Call the LLM and return a parsed JSON object."""
        if settings.gemini_api_key:
            return self._call_gemini(prompt, temperature)
        if self.url:
            return self._call_generic_backend(prompt, temperature)
        return self._mock_response(prompt)

    def _call_gemini(self, prompt: str, temperature: float) -> Dict[str, Any]:
        model = settings.gemini_model
        endpoint = (
            f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"
            f"?key={settings.gemini_api_key}"
        )
        payload = {
            "contents": [
                {
                    "role": "user",
                    "parts": [{"text": prompt}],
                }
            ],
            "generationConfig": {
                "temperature": temperature,
                "responseMimeType": "application/json",
                "maxOutputTokens": 8192,
            },
        }
        try:
            r = requests.post(endpoint, json=payload, timeout=180)
            r.raise_for_status()
            data = r.json()
            text = self._extract_gemini_text(data)
            return self._extract_json({"content": text})
        except Exception as exc:
            return self._mock_response(prompt, error=f"Gemini call failed: {exc}")

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
            r = requests.post(self.url, headers=headers, json=payload, timeout=120)
            r.raise_for_status()
            data = r.json()
        except Exception as exc:
            return self._mock_response(prompt, error=str(exc))

        return self._extract_json(data)

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

    def _mock_response(self, prompt: str, error: str = None) -> Dict[str, Any]:
        """Deterministic fallback when no LLM backend is configured."""
        seed = int(hashlib.md5(prompt.encode()).hexdigest(), 16)
        rng = random.Random(seed)
        # Vary score with input but keep within plausible SATISFACTORY/EXCELLENT range
        base = rng.randint(520, 820)
        return {
            "total_score": base,
            "category_scores": {cat: rng.randint(int(max_ * 0.4), max_) for cat, max_ in self._categories().items()},
            "verdict": "SATISFACTORY" if base < 700 else "EXCELLENT",
            "authenticity_band": "MIXED",
            "authenticity_multiplier": 0.85,
            "overall_assessment": "Fallback assessment because no LLM backend is configured.",
            "key_strengths": ["Coherent structure"],
            "areas_for_improvement": ["Add more problem-specific detail"],
            "red_flags": [],
            "recommendation": "Configure GEMINI_API_KEY or AI_BACKEND_URL for real evaluation.",
            "_mock": True,
            "_error": error,
        }

    def _categories(self):
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
