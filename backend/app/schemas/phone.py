from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field

class NormalizedPhone(BaseModel):
    input: str
    e164: str
    international: str
    national: str
    rfc3966: str
    country: str = Field(description="ISO 3166-1 alpha-2 country code")
    country_code: int = Field(description="Numeric country calling code")
    national_number: str
    type: str = Field(description="MOBILE, FIXED_LINE, VOIP, TOLL_FREE, etc.")
    valid: bool
    possible: bool
    search_variants: List[str] = Field(default_factory=list, description="Public OSINT search permutations")
    metadata: Dict[str, Any] = Field(default_factory=dict)
