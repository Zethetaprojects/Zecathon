import base64
import re
from typing import Any, Dict, List, Optional, Tuple
from urllib.parse import urlparse

import requests

from app.config import settings

GITHUB_API = "https://api.github.com"
MAX_FILES = 80
MAX_FILE_SIZE = 200_000
DEFAULT_BRANCHES = ["main", "master"]


def _headers():
    h = {"Accept": "application/vnd.github+json"}
    if settings.github_token:
        h["Authorization"] = f"Bearer {settings.github_token}"
    return h


def parse_github_url(url: str) -> Optional[Tuple[str, str]]:
    parsed = urlparse(url)
    if parsed.netloc not in ("github.com", "www.github.com"):
        return None
    parts = [p for p in parsed.path.strip("/").split("/") if p]
    if len(parts) < 2:
        return None
    return parts[0], parts[1]


def fetch_repo_tree(owner: str, repo: str) -> List[Dict[str, Any]]:
    for branch in DEFAULT_BRANCHES:
        r = requests.get(
            f"{GITHUB_API}/repos/{owner}/{repo}/git/trees/{branch}?recursive=1",
            headers=_headers(),
            timeout=30,
        )
        if r.status_code == 200:
            return r.json().get("tree", [])
    return []


def fetch_readme(owner: str, repo: str) -> str:
    for branch in DEFAULT_BRANCHES:
        r = requests.get(
            f"{GITHUB_API}/repos/{owner}/{repo}/readme?ref={branch}",
            headers=_headers(),
            timeout=30,
        )
        if r.status_code == 200:
            data = r.json()
            content = data.get("content", "")
            return base64.b64decode(content).decode("utf-8", errors="ignore")[:50000]
    return ""


def fetch_file(owner: str, repo: str, path: str) -> str:
    for branch in DEFAULT_BRANCHES:
        r = requests.get(
            f"{GITHUB_API}/repos/{owner}/{repo}/contents/{path}?ref={branch}",
            headers=_headers(),
            timeout=30,
        )
        if r.status_code == 200:
            data = r.json()
            if isinstance(data, dict) and data.get("content"):
                raw = base64.b64decode(data["content"])
                if len(raw) > MAX_FILE_SIZE:
                    return ""
                return raw.decode("utf-8", errors="ignore")[:50000]
    return ""


def fetch_commits(owner: str, repo: str) -> List[Dict[str, Any]]:
    r = requests.get(
        f"{GITHUB_API}/repos/{owner}/{repo}/commits?per_page=100",
        headers=_headers(),
        timeout=30,
    )
    if r.status_code != 200:
        return []
    return r.json()


def summarize_repo(github_url: str) -> Dict[str, Any]:
    parsed = parse_github_url(github_url)
    if not parsed:
        return {"valid": False, "error": "Invalid GitHub URL"}
    owner, repo = parsed
    tree = fetch_repo_tree(owner, repo)
    if not tree:
        return {"valid": False, "error": "Could not fetch repository tree"}

    files = []
    for item in tree[:MAX_FILES]:
        if item.get("type") != "blob":
            continue
        path = item.get("path", "")
        if any(path.endswith(ext) for ext in [".png", ".jpg", ".jpeg", ".gif", ".svg", ".ico", ".lock", ".exe", ".bin"]):
            continue
        files.append(path)

    readme = fetch_readme(owner, repo)
    commits = fetch_commits(owner, repo)

    # fetch a few key files (first 5 source/config files)
    snippets = {}
    for path in files[:10]:
        if any(path.endswith(ext) for ext in [".py", ".js", ".ts", ".jsx", ".tsx", ".java", ".go", ".rs", ".cpp", ".c", ".h", ".md", ".txt", ".json", ".yaml", ".yml", ".toml"]):
            content = fetch_file(owner, repo, path)
            if content:
                snippets[path] = content[:3000]
            if len(snippets) >= 5:
                break

    commit_dates = [c.get("commit", {}).get("committer", {}).get("date", "")[:10] for c in commits if c.get("commit")]
    unique_dates = sorted(set(commit_dates))

    return {
        "valid": True,
        "owner": owner,
        "repo": repo,
        "files": files,
        "readme": readme,
        "snippets": snippets,
        "total_commits": len(commits),
        "unique_commit_dates": unique_dates,
        "active_days": len(unique_dates),
    }
