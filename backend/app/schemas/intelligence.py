from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field

class CarrierData(BaseModel):
    name: Optional[str] = None
    type: Optional[str] = None
    mcc: Optional[str] = None
    mnc: Optional[str] = None
    circle: Optional[str] = None
    circle_code: Optional[str] = None
    original_network: Optional[str] = None
    ported: Optional[bool] = None

class LocationData(BaseModel):
    country: str
    country_name: str
    region: Optional[str] = None
    region_code: Optional[str] = None
    city: Optional[str] = None
    timezone: Optional[str] = None
    accuracy: str = Field(default="region", description="country, region, or city - NEVER pseudo-precise GPS")

class PhoneIntelligenceResult(BaseModel):
    e164: str
    valid: bool
    line_type: str
    carrier: CarrierData
    location: LocationData
    confidence: str = Field(default="low", description="low, medium, high, observed, inferred")
    source: str = Field(description="Primary provider responsible for best result")
    providers_consulted: List[str] = Field(default_factory=list)
    raw_provider_data: Dict[str, Any] = Field(default_factory=dict)
    notes: List[str] = Field(default_factory=list)
