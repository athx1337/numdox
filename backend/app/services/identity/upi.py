import re
from typing import List, Optional, Dict
from pydantic import BaseModel, Field
from backend.app.schemas.phone import NormalizedPhone

class UPIHandle(BaseModel):
    app: str
    vpa: str
    deep_link: str
    qr_payload: str
    registered_name: Optional[str] = None
    status: str = Field(default="ready_for_verification", description="ready_for_verification, verified, inactive")

class UPINameResult(BaseModel):
    target_phone: str
    is_eligible_india_upi: bool
    handles: List[UPIHandle] = Field(default_factory=list)
    verified_name: Optional[str] = None

class UPINameResolver:
    @staticmethod
    def generate_handles(phone: NormalizedPhone) -> UPINameResult:
        if phone.country_code != 91 or len(phone.national_number) < 10:
            return UPINameResult(target_phone=phone.e164, is_eligible_india_upi=False)

        raw10 = phone.national_number[-10:]
        
        apps = [
            ("PhonePe (Yes Bank)", f"{raw10}@ybl"),
            ("PhonePe (ICICI Bank)", f"{raw10}@ibl"),
            ("Paytm Payments Bank", f"{raw10}@paytm"),
            ("Google Pay (Axis Bank)", f"{raw10}@okaxis"),
            ("Google Pay (HDFC Bank)", f"{raw10}@okhdfcbank"),
            ("Google Pay (ICICI Bank)", f"{raw10}@okicici"),
            ("Google Pay (SBI)", f"{raw10}@oksbi"),
            ("BHIM NPCI Official", f"{raw10}@upi"),
        ]

        handles: List[UPIHandle] = []
        for app_name, vpa in apps:
            deep_link = f"upi://pay?pa={vpa}&pn=Target&mc=0000&mode=02&purpose=00"
            handles.append(UPIHandle(
                app=app_name,
                vpa=vpa,
                deep_link=deep_link,
                qr_payload=deep_link,
                status="ready_for_verification"
            ))

        return UPINameResult(
            target_phone=phone.e164,
            is_eligible_india_upi=True,
            handles=handles,
            verified_name=None
        )
