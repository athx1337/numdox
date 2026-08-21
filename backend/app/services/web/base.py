from abc import ABC, abstractmethod
from typing import List
from backend.app.schemas.web import WebFinding

class SearchProvider(ABC):
    name: str = "base_search"

    @abstractmethod
    async def search(self, query: str, matched_variant: str, limit: int = 10) -> List[WebFinding]:
        """Perform search query and return structured public findings."""
        pass
