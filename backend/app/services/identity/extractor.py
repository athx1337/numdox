import re
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field
from backend.app.schemas.phone import NormalizedPhone
from backend.app.schemas.web import WebFinding
from backend.app.schemas.github import GitHubUserFinding
from backend.app.services.identity.truecaller import TruecallerClient, TruecallerProfile
from backend.app.services.identity.upi import UPINameResolver, UPINameResult

class NameEvidence(BaseModel):
    name: str
    source: str
    confidence: str = Field(default="medium", description="high, medium, low")
    evidence_type: str = Field(default="public_web", description="truecaller_live, upi_verified, github_profile, public_web, operator_recorded")
    snippet: Optional[str] = None
    url: Optional[str] = None

class IdentityDiscoveryResult(BaseModel):
    target_phone: str
    primary_name: Optional[str] = None
    aliases: List[str] = Field(default_factory=list)
    names_discovered: List[NameEvidence] = Field(default_factory=list)
    truecaller_profile: Optional[TruecallerProfile] = None
    upi_result: Optional[UPINameResult] = None
    truecaller_search_url: str
    google_search_url: str
    whatsapp_chat_url: str
    confidence_score: float = 0.0

class IdentityExtractor:
    IGNORE_TERMS = {
        "contact", "phone", "number", "mobile", "whatsapp", "call", "sms", "india", "delhi",
        "mumbai", "telecom", "airtel", "jio", "vodafone", "bsnl", "support", "help", "customer",
        "service", "privacy", "policy", "terms", "about", "home", "search", "results", "login",
        "sign", "register", "download", "free", "online", "view", "details", "page", "website"
    }

    @classmethod
    def extract_names_from_web_findings(cls, findings: List[WebFinding]) -> List[NameEvidence]:
        evidences: List[NameEvidence] = []
        name_pattern = re.compile(r'\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,2})\b')
        explicit_contact_pattern = re.compile(r'(?:contact(?:\s+person)?|owner|posted\s+by|name|author|signatory|proprietor)\s*[:\-–]\s*([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,2})', re.IGNORECASE)

        for finding in findings:
            text = f"{finding.title} {finding.snippet}"

            # 1. Check for explicit contact/owner labels
            for m in explicit_contact_pattern.finditer(text):
                candidate = m.group(1).strip()
                words = candidate.lower().split()
                if any(w in cls.IGNORE_TERMS for w in words):
                    continue
                if len(candidate) < 4 or len(candidate) > 30:
                    continue

                evidences.append(NameEvidence(
                    name=candidate,
                    source=finding.source_domain or "Public Web",
                    confidence="high",
                    evidence_type="public_web",
                    snippet=finding.snippet[:120],
                    url=finding.url
                ))

            # 2. General proper noun mentions in snippet
            matches = name_pattern.findall(text)
            for candidate in matches:
                words = candidate.lower().split()
                if any(w in cls.IGNORE_TERMS for w in words):
                    continue
                if len(candidate) < 4 or len(candidate) > 30:
                    continue

                # Avoid duplicate within the same finding
                if not any(e.name.lower() == candidate.lower() for e in evidences):
                    evidences.append(NameEvidence(
                        name=candidate.strip(),
                        source=finding.source_domain or "Public Web",
                        confidence="medium" if finding.category in ["social", "business"] else "low",
                        evidence_type="public_web",
                        snippet=finding.snippet[:120],
                        url=finding.url
                    ))
        return evidences

    @classmethod
    def extract_names_from_github(cls, users: List[GitHubUserFinding]) -> List[NameEvidence]:
        evidences: List[NameEvidence] = []
        for u in users:
            if u.name:
                evidences.append(NameEvidence(
                    name=u.name.strip(),
                    source=f"GitHub (@{u.username})",
                    confidence="high",
                    evidence_type="github_profile",
                    snippet=f"Bio: {u.bio or 'N/A'} | Location: {u.location or 'N/A'}",
                    url=u.profile_url
                ))
            elif u.username:
                evidences.append(NameEvidence(
                    name=u.username.strip(),
                    source="GitHub Profile",
                    confidence="medium",
                    evidence_type="github_profile",
                    snippet=f"GitHub Username: {u.username}",
                    url=u.profile_url
                ))
        return evidences

    @classmethod
    async def compile_identity(
        cls,
        phone: NormalizedPhone,
        web_findings: Optional[List[WebFinding]] = None,
        github_users: Optional[List[GitHubUserFinding]] = None,
        operator_name: Optional[str] = None,
        truecaller_token: Optional[str] = None,
    ) -> IdentityDiscoveryResult:
        all_evidences: List[NameEvidence] = []

        # 1. Operator Recorded Name
        if operator_name:
            all_evidences.append(NameEvidence(
                name=operator_name.strip(),
                source="Operator Verified (Observed)",
                confidence="high",
                evidence_type="operator_recorded",
                snippet="Confirmed by operator investigation"
            ))

        # 2. Live Truecaller API lookup
        tc_client = TruecallerClient(auth_token=truecaller_token)
        tc_profile = await tc_client.lookup(phone)
        if tc_profile and tc_profile.name:
            all_evidences.append(NameEvidence(
                name=tc_profile.name.strip(),
                source=tc_profile.source,
                confidence="high",
                evidence_type="truecaller_live",
                snippet=f"Verified: {tc_profile.is_verified} | Carrier: {tc_profile.carrier or 'N/A'}"
            ))

        # 3. GitHub Public Name Correlation
        if github_users:
            all_evidences.extend(cls.extract_names_from_github(github_users))

        # 4. Public Web Snippet Name Extraction
        if web_findings:
            all_evidences.extend(cls.extract_names_from_web_findings(web_findings))

        # Deduplicate
        seen_names = set()
        unique_evidences: List[NameEvidence] = []
        for ev in all_evidences:
            normalized_name = ev.name.lower().strip()
            if normalized_name not in seen_names:
                seen_names.add(normalized_name)
                unique_evidences.append(ev)

        # Primary name selection
        primary_name = unique_evidences[0].name if unique_evidences else None
        aliases = [ev.name for ev in unique_evidences[1:6]]

        # UPI VPA handles (India)
        upi_result = UPINameResolver.generate_handles(phone)

        raw10 = phone.national_number[-10:] if len(phone.national_number) >= 10 else phone.national_number
        truecaller_url = f"https://www.truecaller.com/search/in/+91{raw10}" if phone.country_code == 91 else f"https://www.truecaller.com/search/global/{phone.e164}"
        google_url = f"https://www.google.com/search?q=%22{phone.e164}%22+OR+%22{phone.national_number}%22"
        whatsapp_url = f"https://wa.me/{phone.e164.replace('+', '')}"

        return IdentityDiscoveryResult(
            target_phone=phone.e164,
            primary_name=primary_name,
            aliases=aliases,
            names_discovered=unique_evidences,
            truecaller_profile=tc_profile,
            upi_result=upi_result,
            truecaller_search_url=truecaller_url,
            google_search_url=google_url,
            whatsapp_chat_url=whatsapp_url,
            confidence_score=0.95 if (operator_name or tc_profile) else (0.75 if primary_name else 0.0)
        )
