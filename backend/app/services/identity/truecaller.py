import httpx
from typing import Optional, Dict, Any, List
from pydantic import BaseModel, Field
from backend.app.core.config import settings
from backend.app.schemas.phone import NormalizedPhone

class TruecallerProfile(BaseModel):
    name: Optional[str] = None
    alt_name: Optional[str] = None
    email: Optional[str] = None
    city: Optional[str] = None
    country_code: Optional[str] = None
    carrier: Optional[str] = None
    spam_score: int = 0
    is_verified: bool = False
    is_business: bool = False
    source: str = "Truecaller Live API"
    raw_data: Dict[str, Any] = Field(default_factory=dict)

class TruecallerClient:
    def __init__(self, auth_token: Optional[str] = None, rapidapi_key: Optional[str] = None):
        self.auth_token = auth_token or settings.TRUECALLER_AUTH_TOKEN
        self.rapidapi_key = rapidapi_key or settings.RAPIDAPI_TRUECALLER_KEY

    async def lookup(self, phone: NormalizedPhone) -> Optional[TruecallerProfile]:
        clean_digits = phone.e164.replace("+", "")
        raw10 = phone.national_number[-10:] if len(phone.national_number) >= 10 else clean_digits
        country_code = phone.country or "IN"
        prefix = str(phone.country_code) if phone.country_code else "91"

        # 1. Official Truecaller Direct Bearer Token (if provided)
        if self.auth_token:
            try:
                url = "https://search5-noneu.truecaller.com/v2/search"
                headers = {
                    "Authorization": f"Bearer {self.auth_token}",
                    "User-Agent": "Truecaller/13.35.6 (Android;13)",
                    "Accept": "application/json",
                }
                params = {"q": phone.e164, "countryCode": country_code.lower(), "type": 4}
                async with httpx.AsyncClient(timeout=6.0) as client:
                    resp = await client.get(url, headers=headers, params=params)
                    if resp.status_code == 200:
                        data = resp.json()
                        items = data.get("data", [])
                        if items:
                            item = items[0]
                            name = item.get("name")
                            if name:
                                return TruecallerProfile(
                                    name=name.strip(),
                                    alt_name=item.get("altName"),
                                    email=(item.get("internetAddresses") or [{}])[0].get("id"),
                                    city=(item.get("addresses") or [{}])[0].get("city"),
                                    country_code=country_code,
                                    carrier=(item.get("phones") or [{}])[0].get("carrier"),
                                    spam_score=item.get("spamScore", 0),
                                    is_verified=True,
                                    source="Truecaller Direct Auth",
                                    raw_data=item
                                )
            except Exception:
                pass

        # 2. RapidAPI Multi-Endpoint Waterfall Pool
        if self.rapidapi_key:
            pool_endpoints = [
                # Endpoint 1: ViewCaller (DataCrawler)
                {
                    "name": "ViewCaller RapidAPI",
                    "url": f"https://viewcaller.p.rapidapi.com/api/v1/search?code={prefix}&number={raw10}",
                    "headers": {"x-rapidapi-host": "viewcaller.p.rapidapi.com", "x-rapidapi-key": self.rapidapi_key},
                    "method": "GET",
                    "parser": self._parse_viewcaller
                },
                # Endpoint 2: Truecaller Data2
                {
                    "name": "Truecaller-Data2 RapidAPI",
                    "url": f"https://truecaller-data2.p.rapidapi.com/search/{clean_digits}",
                    "headers": {"x-rapidapi-host": "truecaller-data2.p.rapidapi.com", "x-rapidapi-key": self.rapidapi_key},
                    "method": "GET",
                    "parser": self._parse_data2
                },
                # Endpoint 3: Truecaller4 (getDetails)
                {
                    "name": "Truecaller4 RapidAPI",
                    "url": f"https://truecaller4.p.rapidapi.com/api/v1/getDetails?phone={clean_digits}&countryCode={country_code}",
                    "headers": {"x-rapidapi-host": "truecaller4.p.rapidapi.com", "x-rapidapi-key": self.rapidapi_key},
                    "method": "GET",
                    "parser": self._parse_tc4
                },
                # Endpoint 4: Truecaller-API11 (POST)
                {
                    "name": "Truecaller-API11 RapidAPI",
                    "url": "https://truecaller-api11.p.rapidapi.com/v2.php",
                    "headers": {"x-rapidapi-host": "truecaller-api11.p.rapidapi.com", "x-rapidapi-key": self.rapidapi_key},
                    "method": "POST",
                    "data": {"phone": raw10, "countryCode": country_code.lower()},
                    "parser": self._parse_api11
                },
            ]

            async with httpx.AsyncClient(timeout=6.0) as client:
                for ep in pool_endpoints:
                    try:
                        if ep["method"] == "GET":
                            resp = await client.get(ep["url"], headers=ep["headers"])
                        else:
                            resp = await client.post(ep["url"], headers=ep["headers"], data=ep.get("data"))

                        if resp.status_code == 200:
                            data = resp.json()
                            profile = ep["parser"](data, country_code, ep["name"])
                            if profile and profile.name:
                                return profile
                    except Exception:
                        continue

        return None

    def _parse_viewcaller(self, data: dict, country_code: str, source_name: str) -> Optional[TruecallerProfile]:
        items = data.get("data", [])
        if items and isinstance(items, list):
            item = items[0]
            name = item.get("name")
            if name:
                return TruecallerProfile(
                    name=name.strip(),
                    spam_score=item.get("spamCounter", 0),
                    country_code=country_code,
                    source=source_name,
                    raw_data=item
                )
        return None

    def _parse_data2(self, data: dict, country_code: str, source_name: str) -> Optional[TruecallerProfile]:
        item = data.get("data", {})
        basic = item.get("basicInfo", {})
        name = basic.get("name")
        if name:
            addr = item.get("addressInfo", {})
            return TruecallerProfile(
                name=name.strip(),
                city=addr.get("city"),
                country_code=country_code,
                source=source_name,
                raw_data=item
            )
        return None

    def _parse_tc4(self, data: dict, country_code: str, source_name: str) -> Optional[TruecallerProfile]:
        items = data.get("data", [])
        if items and isinstance(items, list):
            item = items[0]
            name = item.get("name")
            if name:
                return TruecallerProfile(
                    name=name.strip(),
                    country_code=country_code,
                    source=source_name,
                    raw_data=item
                )
        return None

    def _parse_api11(self, data: dict, country_code: str, source_name: str) -> Optional[TruecallerProfile]:
        lookup = data.get("truecaller_lookup", {})
        name = lookup.get("name") or lookup.get("caller_name")
        if name:
            return TruecallerProfile(
                name=name.strip(),
                carrier=lookup.get("carrier"),
                city=lookup.get("location"),
                country_code=country_code,
                source=source_name,
                raw_data=data
            )
        return None
