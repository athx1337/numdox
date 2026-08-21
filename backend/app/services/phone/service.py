import asyncio
from typing import List, Optional
from backend.app.schemas.phone import NormalizedPhone
from backend.app.schemas.intelligence import PhoneIntelligenceResult, CarrierData, LocationData
from backend.app.services.phone.base import PhoneIntelProvider
from backend.app.services.phone.dot_india import DoTIndiaIntelProvider
from backend.app.services.phone.numverify import NumVerifyIntelProvider
from backend.app.services.phone.libphone import LibphonenumberIntelProvider

class PhoneIntelligenceService:
    def __init__(self, providers: Optional[List[PhoneIntelProvider]] = None):
        if providers:
            self.providers = providers
        else:
            self.providers = [
                DoTIndiaIntelProvider(),
                NumVerifyIntelProvider(),
                LibphonenumberIntelProvider(),
            ]

    async def gather_intelligence(self, phone: NormalizedPhone) -> PhoneIntelligenceResult:
        # Execute provider lookups concurrently
        tasks = [provider.lookup(phone) for provider in self.providers]
        results = await asyncio.gather(*tasks, return_exceptions=True)

        valid_results: List[PhoneIntelligenceResult] = []
        providers_consulted: List[str] = []

        for provider, res in zip(self.providers, results):
            providers_consulted.append(provider.name)
            if isinstance(res, PhoneIntelligenceResult):
                valid_results.append(res)

        if not valid_results:
            # Fallback baseline
            return PhoneIntelligenceResult(
                e164=phone.e164,
                valid=phone.valid,
                line_type=phone.type,
                carrier=CarrierData(type=phone.type.lower()),
                location=LocationData(
                    country=phone.country,
                    country_name=phone.country,
                    accuracy="country",
                ),
                confidence="inferred",
                source="Heuristic Baseline",
                providers_consulted=providers_consulted,
                notes=["No external providers returned intelligence; baseline heuristics used."]
            )

        # Merge results, prioritizing high-confidence or specific sources (e.g. DoT for India, NumVerify for live carrier)
        best_result = valid_results[0]
        notes: List[str] = []
        raw_data = {}

        # Prefer live verified provider or DoT Indian specific circle data
        for res in valid_results:
            notes.extend(res.notes)
            raw_data.update(res.raw_provider_data)
            if res.confidence == "high":
                best_result = res
                break

        # Complement missing carrier or location fields across valid results
        carrier_name = best_result.carrier.name
        circle_name = best_result.carrier.circle
        region_name = best_result.location.region
        city_name = best_result.location.city
        timezone_val = best_result.location.timezone

        for res in valid_results:
            if not carrier_name and res.carrier.name:
                carrier_name = res.carrier.name
            if not circle_name and res.carrier.circle:
                circle_name = res.carrier.circle
            if not region_name and res.location.region:
                region_name = res.location.region
            if not city_name and res.location.city:
                city_name = res.location.city
            if not timezone_val and res.location.timezone:
                timezone_val = res.location.timezone

        return PhoneIntelligenceResult(
            e164=phone.e164,
            valid=best_result.valid,
            line_type=best_result.line_type,
            carrier=CarrierData(
                name=carrier_name,
                type=best_result.carrier.type or phone.type.lower(),
                mcc=best_result.carrier.mcc,
                mnc=best_result.carrier.mnc,
                circle=circle_name,
                circle_code=best_result.carrier.circle_code,
                original_network=best_result.carrier.original_network,
                ported=best_result.carrier.ported,
            ),
            location=LocationData(
                country=best_result.location.country,
                country_name=best_result.location.country_name,
                region=region_name,
                region_code=best_result.location.region_code,
                city=city_name,
                timezone=timezone_val,
                accuracy="region", # Strict policy: never pseudo-precise GPS
            ),
            confidence=best_result.confidence,
            source=best_result.source,
            providers_consulted=providers_consulted,
            raw_provider_data=raw_data,
            notes=list(set(notes))
        )
