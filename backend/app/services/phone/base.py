from abc import ABC, abstractmethod
from typing import Optional
from backend.app.schemas.phone import NormalizedPhone
from backend.app.schemas.intelligence import PhoneIntelligenceResult

class PhoneIntelProvider(ABC):
    name: str = "base"

    @abstractmethod
    async def lookup(self, phone: NormalizedPhone) -> Optional[PhoneIntelligenceResult]:
        """Perform phone intelligence lookup on normalized target number."""
        pass
