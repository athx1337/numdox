import httpx
from typing import Optional
from backend.app.core.config import settings
from backend.app.schemas.phone import NormalizedPhone
from backend.app.schemas.intelligence import PhoneIntelligenceResult, CarrierData, LocationData
from backend.app.services.phone.base import PhoneIntelProvider

class NumVerifyIntelProvider(PhoneIntelProvider):
    name = "NumVerify"

    async def lookup(self, phone: NormalizedPhone) -> Optional[PhoneIntelligenceResult]:
        api_key = settings.NUMVERIFY_API_KEY
        if not api_key:
            return None

        clean_number = phone.e164.replace("+", "")
        url = f"http://apilayer.net/api/validate?access_key={api_key}&number={clean_number}"

        try:
            async with httpx.AsyncClient(timeout=settings.REQUEST_TIMEOUT_SECONDS) as client:
                response = await client.get(url)
                if response.status_code != 200:
                    return None

                data = response.json()
                if not data.get("valid"):
                    return None

                carrier_name = data.get("carrier") or None
                line_type = (data.get("line_type") or phone.type).upper()
                location_name = data.get("location") or None
                country_name = data.get("country_name") or phone.country

                return PhoneIntelligenceResult(
                    e164=phone.e164,
                    valid=bool(data.get("valid")),
                    line_type=line_type,
                    carrier=CarrierData(
                        name=carrier_name,
                        type=data.get("line_type"),
                        original_network=carrier_name,
                    ),
                    location=LocationData(
                        country=data.get("country_code", phone.country),
                        country_name=country_name,
                        region=location_name,
                        city=location_name,
                        accuracy="region",
                    ),
                    confidence="high",
                    source="NumVerify API",
                    providers_consulted=[self.name],
                    raw_provider_data={"numverify": data},
                    notes=[f"Verified live via NumVerify (Line: {line_type}, Carrier: {carrier_name})"]
                )
        except Exception:
            return None
