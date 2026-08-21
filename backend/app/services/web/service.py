import asyncio
from typing import List, Optional, Set
from backend.app.schemas.phone import NormalizedPhone
from backend.app.schemas.web import WebOSINTResult, WebFinding
from backend.app.services.web.base import SearchProvider
from backend.app.services.web.duckduckgo import DuckDuckGoSearchProvider
from backend.app.services.web.dorks import DorkGenerator

class WebOSINTService:
    def __init__(self, providers: Optional[List[SearchProvider]] = None):
        self.providers = providers if providers is not None else [DuckDuckGoSearchProvider()]

    async def scan(self, phone: NormalizedPhone, max_queries: int = 4) -> WebOSINTResult:
        # Select top search variants (e.g. "+919876543210", "9876543210", "+91 98765 43210")
        priority_variants = [
            phone.e164,
            phone.national_number,
            f'"{phone.e164}"',
            f'"{phone.national_number}"',
        ]
        # Keep unique in order
        queries_to_run = list(dict.fromkeys(priority_variants))[:max_queries]

        all_findings: List[WebFinding] = []
        seen_urls: Set[str] = set()
        domains: Set[str] = set()
        providers_consulted: List[str] = [p.name for p in self.providers]

        # Query each variant across providers
        for query in queries_to_run:
            for provider in self.providers:
                try:
                    results = await provider.search(query=query, matched_variant=query, limit=5)
                    for finding in results:
                        if finding.url not in seen_urls:
                            seen_urls.add(finding.url)
                            if finding.source_domain:
                                domains.add(finding.source_domain)
                            all_findings.append(finding)
                except Exception:
                    continue

        dorks = DorkGenerator.generate_dorks(phone)

        return WebOSINTResult(
            target_phone=phone.e164,
            total_findings=len(all_findings),
            domains_discovered=sorted(list(domains)),
            findings=all_findings,
            search_queries_used=queries_to_run,
            providers_consulted=providers_consulted,
            dorks_generated=dorks
        )
