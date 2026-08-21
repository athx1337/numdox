from typing import List, Optional, Dict, Any
from datetime import datetime, timezone
from pydantic import BaseModel, Field

class WebFinding(BaseModel):
    url: str
    title: str
    snippet: str
    matched_variant: str
    source_domain: str
    category: str = Field(default="general", description="directory, document, paste, forum, business, social, news, general")
    timestamp: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    confidence: str = Field(default="public", description="public, observed, inferred")
    metadata: Dict[str, Any] = Field(default_factory=dict)

class WebOSINTResult(BaseModel):
    target_phone: str
    total_findings: int
    domains_discovered: List[str] = Field(default_factory=list)
    findings: List[WebFinding] = Field(default_factory=list)
    search_queries_used: List[str] = Field(default_factory=list)
    providers_consulted: List[str] = Field(default_factory=list)
    dorks_generated: List[Dict[str, str]] = Field(default_factory=list)
