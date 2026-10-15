"""Check that the configured AI evaluator works, without scoring anything.

Prints the key type (never the key), then makes one small real request.

Usage (local):      python -m scripts.check_llm
Usage (VM/Docker):  sudo docker exec zecathon-backend python -m scripts.check_llm
"""
import sys

from app.config import settings
from app.services.scoring.llm_client import LLMClient, LLMUnavailableError


def describe_key(key: str) -> str:
    if not key:
        return "not set"
    if key.startswith("AQ."):
        kind = "auth key (current format)"
    elif key.startswith("AIza"):
        kind = "legacy standard key (no longer accepted by Google)"
    else:
        kind = "unrecognised format"
    return f"{kind}, {len(key)} characters"


def main() -> None:
    print(f"GEMINI_API_KEY: {describe_key(settings.gemini_api_key)}")
    print(f"GEMINI_MODEL:   {settings.gemini_model}")
    if not settings.gemini_api_key and not settings.ai_backend_url:
        print("FAIL: no LLM configured; evaluations will be refused in production.")
        sys.exit(1)
    client = LLMClient()
    try:
        result = client.complete_json('Reply with exactly this JSON object: {"ok": true}')
    except LLMUnavailableError as exc:
        print(f"FAIL: {exc}")
        sys.exit(1)
    print(f"OK: {result.get('_source')} answered (model: {client.last_model or 'n/a'})")


if __name__ == "__main__":
    main()
