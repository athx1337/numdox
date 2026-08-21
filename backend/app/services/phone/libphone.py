from typing import Optional
import phonenumbers
from phonenumbers import geocoder, timezone, carrier
from backend.app.schemas.phone import NormalizedPhone
from backend.app.schemas.intelligence import PhoneIntelligenceResult, CarrierData, LocationData
from backend.app.services.phone.base import PhoneIntelProvider

class LibphonenumberIntelProvider(PhoneIntelProvider):
    name = "Libphonenumber (Offline)"

    async def lookup(self, phone: NormalizedPhone) -> Optional[PhoneIntelligenceResult]:
        try:
            parsed = phonenumbers.parse(phone.e164, None)
            
            # Geocoding description
            geo_desc = geocoder.description_for_number(parsed, "en") or None
            # Timezones
            time_zones = timezone.time_zones_for_number(parsed)
            tz_str = ", ".join(time_zones) if time_zones else "UTC"
            # Carrier (for regions supported in libphonenumber carrier db)
            carrier_name = carrier.name_for_number(parsed, "en") or None

            return PhoneIntelligenceResult(
                e164=phone.e164,
                valid=phone.valid,
                line_type=phone.type,
                carrier=CarrierData(
                    name=carrier_name,
                    type=phone.type.lower(),
                ),
                location=LocationData(
                    country=phone.country,
                    country_name=geo_desc or phone.country,
                    region=geo_desc,
                    timezone=tz_str,
                    accuracy="country" if not geo_desc else "region",
                ),
                confidence="low" if not carrier_name else "medium",
                source="Libphonenumber Engine",
                providers_consulted=[self.name],
                notes=[f"Standard international ITU/E.164 mapping (Timezone: {tz_str})"]
            )
        except Exception:
            return None
