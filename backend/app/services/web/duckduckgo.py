import re
import httpx
from typing import List
from urllib.parse import urlparse, unquote
from backend.app.schemas.web import WebFinding
from backend.app.services.web.base import SearchProvider

CATEGORY_PATTERNS = {
    "paste": [r"pastebin\.com", r"justpaste\.it", r"rentry\.co", r"ghostbin", r"dpaste"],
    "document": [r"\.pdf($|\?)", r"\.xlsx?($|\?)", r"\.docx?($|\?)", r"\.csv($|\?)"],
    "code": [r"github\.com", r"gitlab\.com", r"bitbucket\.org", r"sourceforge\.net"],
    "social": [r"linkedin\.com", r"twitter\.com", r"x\.com", r"facebook\.com", r"instagram\.com"],
    "business": [r"indiamart\.com", r"justdial\.com", r"tradeindia\.com", r"zaubacorp\.com"],
    "forum": [r"reddit\.com", r"quora\.com", r"stackoverflow\.com", r"t\.me"],
}

class DuckDuckGoSearchProvider(SearchProvider):
    name = "DuckDuckGo (Public Search)"

    async def search(self, query: str, matched_variant: str, limit: int = 10) -> List[WebFinding]:
        findings: List[WebFinding] = []
        url = "https://html.duckduckgo.com/html/"
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.5",
        }
        data = {"q": query}

        try:
            async with httpx.AsyncClient(timeout=8.0, follow_redirects=True) as client:
                response = await client.post(url, headers=headers, data=data)
                if response.status_code != 200:
                    return findings

                html = response.text
                # Match result blocks: <a class="result__url" href="..."> and <a class="result__snippet" ...>
                # Using regex for fast, zero-dependency HTML parsing
                link_pattern = re.compile(r'<a[^>]+class="result__snippet[^>]*href="([^"]+)"[^>]*>(.*?)</a>', re.DOTALL)
                title_pattern = re.compile(r'<a[^>]+class="result__url[^>]*href="([^"]+)"[^>]*>(.*?)</a>', re.DOTALL)
                
                # Extract results
                matches = re.findall(r'<div class="result__body">(.*?)</div>\s*</div>', html, re.DOTALL)
                
                for block in matches[:limit]:
                    href_match = re.search(r'<a[^>]+class="result__snippet[^>]*href="([^"]+)"', block) or re.search(r'<a[^>]+class="result__url[^>]*href="([^"]+)"', block)
                    title_match = re.search(r'<h2[^>]*>\s*<a[^>]*>(.*?)</a>', block, re.DOTALL) or re.search(r'<a[^>]+class="result__title[^>]*>(.*?)</a>', block, re.DOTALL)
                    snippet_match = re.search(r'<a[^>]+class="result__snippet[^>]*>(.*?)</a>', block, re.DOTALL)

                    if not href_match:
                        continue

                    raw_href = href_match.group(1)
                    # Extract target URL from DDG redirect url if present (/l/?uddg=...)
                    if "uddg=" in raw_href:
                        uddg_match = re.search(r'uddg=([^&]+)', raw_href)
                        final_url = unquote(uddg_match.group(1)) if uddg_match else raw_href
                    else:
                        final_url = raw_href

                    if not final_url.startswith("http"):
                        continue

                    title_text = re.sub(r'<[^>]+>', '', title_match.group(1)).strip() if title_match else "Public Web Result"
                    snippet_text = re.sub(r'<[^>]+>', '', snippet_match.group(1)).strip() if snippet_match else ""

                    domain = urlparse(final_url).netloc.lower()
                    category = self._classify_category(final_url, snippet_text)

                    findings.append(WebFinding(
                        url=final_url,
                        title=title_text,
                        snippet=snippet_text,
                        matched_variant=matched_variant,
                        source_domain=domain,
                        category=category,
                        confidence="public",
                        metadata={"query": query}
                    ))
        except Exception:
            pass

        return findings

    def _classify_category(self, url: str, snippet: str) -> str:
        url_lower = url.lower()
        for cat, patterns in CATEGORY_PATTERNS.items():
            for pat in patterns:
                if re.search(pat, url_lower):
                    return cat
        return "general"
