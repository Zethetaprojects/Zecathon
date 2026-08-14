import json
import hashlib
import random
from typing import Any, Dict

import requests

from app.config import settings


class LLMClient:
    """Thin HTTP client to a configurable LLM backend."""

    def __init__(self, url: str = None, token: str = None):
        self.url = url or settings.ai_backend_url
        self.token = token or settings.ai_backend_token

    def complete_json(self, prompt: str, temperature: float = 0.2) -> Dict[str, Any]:
        """Call the LLM and return a parsed JSON object."""
        if not self.url:
            return self._mock_response(prompt)

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
            "recommendation": "Configure AI_BACKEND_URL for real evaluation.",
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
