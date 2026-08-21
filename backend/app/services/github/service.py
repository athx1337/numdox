import re
import httpx
from typing import List, Optional, Set
from urllib.parse import urlparse
from backend.app.core.config import settings
from backend.app.schemas.phone import NormalizedPhone
from backend.app.schemas.github import GitHubOSINTResult, GitHubCodeFinding, GitHubUserFinding

class GitHubOSINTService:
    BASE_URL = "https://api.github.com"

    def __init__(self, token: Optional[str] = None):
        self.token = token or settings.GITHUB_TOKEN

    def _get_headers(self) -> dict:
        headers = {
            "Accept": "application/vnd.github.v3+json",
            "User-Agent": "NUMDOX-OSINT-Framework/0.1.0",
        }
        if self.token:
            headers["Authorization"] = f"token {self.token}"
        return headers

    async def scan(self, phone: NormalizedPhone) -> GitHubOSINTResult:
        # Search queries across top variants
        queries = [
            f'"{phone.e164}"',
            f'"{phone.national_number}"',
        ]
        if phone.international != phone.e164:
            queries.append(f'"{phone.international}"')

        code_findings: List[GitHubCodeFinding] = []
        user_findings: List[GitHubUserFinding] = []
        seen_files: Set[str] = set()
        seen_users: Set[str] = set()
        pivoted_emails: Set[str] = set()
        pivoted_domains: Set[str] = set()
        pivoted_usernames: Set[str] = set()
        rate_limited = False
        notes: List[str] = []

        async with httpx.AsyncClient(timeout=8.0) as client:
            headers = self._get_headers()

            for q in queries:
                # 1. Search Code in Public Repositories
                try:
                    code_url = f"{self.BASE_URL}/search/code?q={q}&per_page=5"
                    code_resp = await client.get(code_url, headers=headers)

                    if code_resp.status_code == 403:
                        rate_limited = True
                        notes.append("GitHub API rate limit reached (set GITHUB_TOKEN for 5,000 req/hr)")
                        break
                    elif code_resp.status_code == 200:
                        items = code_resp.json().get("items", [])
                        for item in items:
                            html_url = item.get("html_url", "")
                            if html_url not in seen_files:
                                seen_files.add(html_url)
                                repo_name = item.get("repository", {}).get("full_name", "")
                                owner = item.get("repository", {}).get("owner", {}).get("login", "")
                                if owner:
                                    pivoted_usernames.add(owner)

                                code_findings.append(GitHubCodeFinding(
                                    repository=repo_name,
                                    owner=owner,
                                    file_path=item.get("path", ""),
                                    html_url=html_url,
                                    score=item.get("score", 0.0),
                                ))
                except Exception:
                    pass

                # 2. Search Public Users (e.g. bio or descriptions)
                try:
                    user_url = f"{self.BASE_URL}/search/users?q={q}&per_page=5"
                    user_resp = await client.get(user_url, headers=headers)

                    if user_resp.status_code == 200:
                        items = user_resp.json().get("items", [])
                        for item in items:
                            username = item.get("login")
                            if username and username not in seen_users:
                                seen_users.add(username)
                                pivoted_usernames.add(username)
                                
                                # Fetch user profile details for pivots
                                user_obj = await self._fetch_user_details(client, username, headers)
                                if user_obj:
                                    user_findings.append(user_obj)
                                    if user_obj.email:
                                        pivoted_emails.add(user_obj.email)
                                    for em in user_obj.pivoted_emails:
                                        pivoted_emails.add(em)
                                    for dm in user_obj.pivoted_domains:
                                        pivoted_domains.add(dm)
                except Exception:
                    pass

        return GitHubOSINTResult(
            target_phone=phone.e164,
            total_code_matches=len(code_findings),
            total_user_matches=len(user_findings),
            code_findings=code_findings,
            user_findings=user_findings,
            pivoted_emails=sorted(list(pivoted_emails)),
            pivoted_domains=sorted(list(pivoted_domains)),
            pivoted_usernames=sorted(list(pivoted_usernames)),
            search_queries_used=queries,
            rate_limited=rate_limited,
            notes=notes
        )

    async def _fetch_user_details(self, client: httpx.AsyncClient, username: str, headers: dict) -> Optional[GitHubUserFinding]:
        try:
            resp = await client.get(f"{self.BASE_URL}/users/{username}", headers=headers)
            if resp.status_code != 200:
                return None
            data = resp.json()

            pivoted_emails = set()
            pivoted_domains = set()

            email = data.get("email") or None
            if email:
                pivoted_emails.add(email)

            blog = data.get("blog") or None
            if blog:
                if not blog.startswith("http"):
                    blog = f"http://{blog}"
                parsed = urlparse(blog).netloc.lower()
                if parsed:
                    pivoted_domains.add(parsed)

            return GitHubUserFinding(
                username=username,
                name=data.get("name"),
                profile_url=data.get("html_url", f"https://github.com/{username}"),
                bio=data.get("bio"),
                email=email,
                blog_domain=blog,
                company=data.get("company"),
                location=data.get("location"),
                public_repos=data.get("public_repos", 0),
                pivoted_emails=list(pivoted_emails),
                pivoted_domains=list(pivoted_domains),
            )
        except Exception:
            return None
