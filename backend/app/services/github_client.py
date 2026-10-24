import base64
import time
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple
from urllib.parse import quote, urlparse

import requests

from app.config import settings

GITHUB_API = "https://api.github.com"
MAX_FILES = 80
MAX_FILE_SIZE = 200_000
MAX_SNIPPETS = 5
REQUEST_TIMEOUT = 15
SOURCE_EXTENSIONS = (
    ".py", ".js", ".ts", ".jsx", ".tsx", ".java", ".go", ".rs", ".cpp", ".c", ".h",
    ".md", ".txt", ".json", ".yaml", ".yml", ".toml", ".ipynb", ".r", ".sql",
)
SKIP_EXTENSIONS = (".png", ".jpg", ".jpeg", ".gif", ".svg", ".ico", ".lock", ".exe", ".bin")


class GitHubUnavailableError(RuntimeError):
    """GitHub could not be asked right now (rate limit, bad token, outage).

    This says nothing about the team's repository, so the evaluation must be
    retried later instead of scoring the repo as missing or empty.
    """


def _headers() -> Dict[str, str]:
    h = {"Accept": "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28"}
    if settings.github_token:
        h["Authorization"] = f"Bearer {settings.github_token}"
    return h


def _get(path: str, **params) -> requests.Response:
    """GET from the GitHub API; raise GitHubUnavailableError for problems on GitHub's side."""
    # One retry for connection blips; a second failure means GitHub is really unreachable.
    for attempt in range(2):
        try:
            r = requests.get(f"{GITHUB_API}{path}", headers=_headers(), params=params or None, timeout=REQUEST_TIMEOUT)
            break
        except (requests.ConnectionError, requests.Timeout) as exc:
            if attempt == 1:
                raise GitHubUnavailableError(f"GitHub request failed: {type(exc).__name__}") from exc
            time.sleep(2)
        except requests.RequestException as exc:
            raise GitHubUnavailableError(f"GitHub request failed: {type(exc).__name__}") from exc

    if r.status_code == 401:
        raise GitHubUnavailableError("GitHub rejected the configured GITHUB_TOKEN (expired or revoked).")
    rate_limited = r.status_code == 429 or (
        r.status_code == 403
        and (r.headers.get("x-ratelimit-remaining") == "0" or "rate limit" in r.text.lower())
    )
    if rate_limited:
        reset = r.headers.get("x-ratelimit-reset")
        when = ""
        if reset and reset.isdigit():
            when = " until " + datetime.fromtimestamp(int(reset), tz=timezone.utc).strftime("%H:%M UTC")
        hint = "" if settings.github_token else " Set GITHUB_TOKEN to raise the limit from 60 to 5000 requests per hour."
        raise GitHubUnavailableError(f"GitHub API rate limit reached{when}.{hint}")
    if r.status_code >= 500:
        raise GitHubUnavailableError(f"GitHub returned HTTP {r.status_code}.")
    return r


def parse_github_url(url: str) -> Optional[Tuple[str, str]]:
    parsed = urlparse(url.strip())
    if parsed.netloc.lower() not in ("github.com", "www.github.com"):
        return None
    parts = [p for p in parsed.path.strip("/").split("/") if p]
    if len(parts) < 2:
        return None
    repo = parts[1][:-4] if parts[1].endswith(".git") else parts[1]
    return parts[0], repo


def fetch_repo_meta(owner: str, repo: str) -> Optional[Dict[str, Any]]:
    """Repository metadata (follows renames/transfers). None if missing or not visible to us."""
    r = _get(f"/repos/{owner}/{repo}")
    if r.status_code == 200:
        return r.json()
    return None


def fetch_repo_tree(owner: str, repo: str, branch: str) -> List[Dict[str, Any]]:
    r = _get(f"/repos/{owner}/{repo}/git/trees/{quote(branch, safe='')}", recursive="1")
    return r.json().get("tree", []) if r.status_code == 200 else []


def fetch_readme(owner: str, repo: str) -> str:
    r = _get(f"/repos/{owner}/{repo}/readme")  # the default branch's README
    if r.status_code != 200:
        return ""
    content = r.json().get("content", "")
    return base64.b64decode(content).decode("utf-8", errors="ignore")[:50000]


def fetch_file(owner: str, repo: str, path: str, branch: str) -> str:
    r = _get(f"/repos/{owner}/{repo}/contents/{quote(path)}", ref=branch)
    if r.status_code != 200:
        return ""
    data = r.json()
    if not isinstance(data, dict) or not data.get("content"):
        return ""
    raw = base64.b64decode(data["content"])
    if len(raw) > MAX_FILE_SIZE:
        return ""
    return raw.decode("utf-8", errors="ignore")[:50000]


def fetch_commits(owner: str, repo: str, branch: str) -> List[Dict[str, Any]]:
    r = _get(f"/repos/{owner}/{repo}/commits", sha=branch, per_page="100")
    return r.json() if r.status_code == 200 else []


def summarize_repo(github_url: str) -> Dict[str, Any]:
    """Summarise a repository for the evaluator.

    Returns {"valid": False, "error": ...} when the repository itself is unusable
    (bad URL, missing, private and not shared). Raises GitHubUnavailableError when
    GitHub cannot be asked right now, so the caller can retry rather than score 0.
    """
    parsed = parse_github_url(github_url or "")
    if not parsed:
        return {"valid": False, "error": "Invalid GitHub URL"}
    owner, repo = parsed

    meta = fetch_repo_meta(owner, repo)
    if meta is None:
        return {
            "valid": False,
            "error": "REPOSITORY_NOT_FOUND: the repository does not exist, or it is private and the evaluator's GitHub account has no access",
        }
    # After a transfer or rename GitHub redirects; use the canonical owner/name.
    owner = meta.get("owner", {}).get("login", owner)
    repo = meta.get("name", repo)
    branch = meta.get("default_branch") or "main"

    tree = fetch_repo_tree(owner, repo, branch)
    if not tree:
        return {"valid": False, "error": "EMPTY_REPOSITORY: no files on the default branch"}

    files = [
        item.get("path", "")
        for item in tree[:MAX_FILES]
        if item.get("type") == "blob" and not item.get("path", "").lower().endswith(SKIP_EXTENSIONS)
    ]

    readme = fetch_readme(owner, repo)
    commits = fetch_commits(owner, repo, branch)

    snippets: Dict[str, str] = {}
    for path in files:
        if len(snippets) >= MAX_SNIPPETS:
            break
        if path.lower().endswith(SOURCE_EXTENSIONS) and not path.lower().startswith("readme"):
            content = fetch_file(owner, repo, path, branch)
            if content:
                snippets[path] = content[:3000]

    commit_dates = [c.get("commit", {}).get("committer", {}).get("date", "")[:10] for c in commits if c.get("commit")]
    unique_dates = sorted(set(d for d in commit_dates if d))

    return {
        "valid": True,
        "owner": owner,
        "repo": repo,
        "default_branch": branch,
        "files": files,
        "readme": readme,
        "snippets": snippets,
        "total_commits": len(commits),
        "unique_commit_dates": unique_dates,
        "active_days": len(unique_dates),
    }
