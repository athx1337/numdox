from typing import Optional, Dict, Any, List
from backend.app.schemas.phone import NormalizedPhone
from backend.app.schemas.intelligence import PhoneIntelligenceResult, CarrierData, LocationData
from backend.app.services.phone.base import PhoneIntelProvider

# 22 Licensed Service Areas (LSA / Telecom Circles in India)
INDIAN_TELECOM_CIRCLES: Dict[str, Dict[str, Any]] = {
    "DL": {"code": "DL", "name": "Delhi NCR", "state": "Delhi", "capital": "New Delhi", "timezone": "Asia/Kolkata"},
    "MUM": {"code": "MUM", "name": "Mumbai", "state": "Maharashtra", "capital": "Mumbai", "timezone": "Asia/Kolkata"},
    "KOL": {"code": "KOL", "name": "Kolkata", "state": "West Bengal", "capital": "Kolkata", "timezone": "Asia/Kolkata"},
    "MH": {"code": "MH", "name": "Maharashtra & Goa", "state": "Maharashtra", "capital": "Pune", "timezone": "Asia/Kolkata"},
    "GJ": {"code": "GJ", "name": "Gujarat & Daman/Diu", "state": "Gujarat", "capital": "Gandhinagar", "timezone": "Asia/Kolkata"},
    "AP": {"code": "AP", "name": "Andhra Pradesh & Telangana", "state": "Telangana", "capital": "Hyderabad", "timezone": "Asia/Kolkata"},
    "KA": {"code": "KA", "name": "Karnataka", "state": "Karnataka", "capital": "Bengaluru", "timezone": "Asia/Kolkata"},
    "TN": {"code": "TN", "name": "Tamil Nadu & Chennai", "state": "Tamil Nadu", "capital": "Chennai", "timezone": "Asia/Kolkata"},
    "KL": {"code": "KL", "name": "Kerala & Lakshadweep", "state": "Kerala", "capital": "Thiruvananthapuram", "timezone": "Asia/Kolkata"},
    "PB": {"code": "PB", "name": "Punjab & Chandigarh", "state": "Punjab", "capital": "Chandigarh", "timezone": "Asia/Kolkata"},
    "HR": {"code": "HR", "name": "Haryana", "state": "Haryana", "capital": "Panchkula", "timezone": "Asia/Kolkata"},
    "UPE": {"code": "UPE", "name": "Uttar Pradesh (East)", "state": "Uttar Pradesh", "capital": "Lucknow", "timezone": "Asia/Kolkata"},
    "UPW": {"code": "UPW", "name": "Uttar Pradesh (West) & Uttarakhand", "state": "Uttar Pradesh", "capital": "Meerut", "timezone": "Asia/Kolkata"},
    "RJ": {"code": "RJ", "name": "Rajasthan", "state": "Rajasthan", "capital": "Jaipur", "timezone": "Asia/Kolkata"},
    "MP": {"code": "MP", "name": "Madhya Pradesh & Chhattisgarh", "state": "Madhya Pradesh", "capital": "Bhopal", "timezone": "Asia/Kolkata"},
    "WB": {"code": "WB", "name": "West Bengal & Sikkim", "state": "West Bengal", "capital": "Siliguri", "timezone": "Asia/Kolkata"},
    "OR": {"code": "OR", "name": "Odisha", "state": "Odisha", "capital": "Bhubaneswar", "timezone": "Asia/Kolkata"},
    "BR": {"code": "BR", "name": "Bihar & Jharkhand", "state": "Bihar", "capital": "Patna", "timezone": "Asia/Kolkata"},
    "AS": {"code": "AS", "name": "Assam", "state": "Assam", "capital": "Guwahati", "timezone": "Asia/Kolkata"},
    "NE": {"code": "NE", "name": "North East (7 States)", "state": "Meghalaya", "capital": "Shillong", "timezone": "Asia/Kolkata"},
    "JK": {"code": "JK", "name": "Jammu & Kashmir & Ladakh", "state": "Jammu & Kashmir", "capital": "Srinagar", "timezone": "Asia/Kolkata"},
    "HP": {"code": "HP", "name": "Himachal Pradesh", "state": "Himachal Pradesh", "capital": "Shimla", "timezone": "Asia/Kolkata"},
}

PREFIX_ALLOCATIONS = [
    # Reliance Jio (6xxx series, 70xx, etc.)
    {"prefix": "6000", "operator": "Reliance Jio", "circle": "AS"},
    {"prefix": "6001", "operator": "Reliance Jio", "circle": "NE"},
    {"prefix": "6005", "operator": "Reliance Jio", "circle": "JK"},
    {"prefix": "6200", "operator": "Reliance Jio", "circle": "BR"},
    {"prefix": "6260", "operator": "Reliance Jio", "circle": "MP"},
    {"prefix": "6280", "operator": "Reliance Jio", "circle": "PB"},
    {"prefix": "6281", "operator": "Reliance Jio", "circle": "AP"},
    {"prefix": "6282", "operator": "Reliance Jio", "circle": "KL"},
    {"prefix": "6289", "operator": "Reliance Jio", "circle": "KOL"},
    {"prefix": "6300", "operator": "Reliance Jio", "circle": "AP"},
    {"prefix": "6350", "operator": "Reliance Jio", "circle": "RJ"},
    {"prefix": "6351", "operator": "Reliance Jio", "circle": "GJ"},
    {"prefix": "6360", "operator": "Reliance Jio", "circle": "KA"},
    {"prefix": "6370", "operator": "Reliance Jio", "circle": "OR"},
    {"prefix": "6375", "operator": "Reliance Jio", "circle": "RJ"},
    {"prefix": "6380", "operator": "Reliance Jio", "circle": "TN"},
    {"prefix": "6386", "operator": "Reliance Jio", "circle": "UPE"},
    {"prefix": "6395", "operator": "Reliance Jio", "circle": "UPW"},
    # Bharti Airtel
    {"prefix": "9810", "operator": "Bharti Airtel", "circle": "DL"},
    {"prefix": "9815", "operator": "Bharti Airtel", "circle": "PB"},
    {"prefix": "9816", "operator": "Bharti Airtel", "circle": "HP"},
    {"prefix": "9818", "operator": "Bharti Airtel", "circle": "DL"},
    {"prefix": "9829", "operator": "Bharti Airtel", "circle": "RJ"},
    {"prefix": "9831", "operator": "Bharti Airtel", "circle": "KOL"},
    {"prefix": "9840", "operator": "Bharti Airtel", "circle": "TN"},
    {"prefix": "9841", "operator": "Bharti Airtel", "circle": "TN"},
    {"prefix": "9845", "operator": "Bharti Airtel", "circle": "KA"},
    {"prefix": "9849", "operator": "Bharti Airtel", "circle": "AP"},
    {"prefix": "9860", "operator": "Bharti Airtel", "circle": "MH"},
    {"prefix": "9871", "operator": "Bharti Airtel", "circle": "DL"},
    {"prefix": "9872", "operator": "Bharti Airtel", "circle": "PB"},
    {"prefix": "9876", "operator": "Bharti Airtel", "circle": "PB"},
    {"prefix": "9880", "operator": "Bharti Airtel", "circle": "KA"},
    {"prefix": "9890", "operator": "Bharti Airtel", "circle": "MH"},
    {"prefix": "9892", "operator": "Bharti Airtel", "circle": "MUM"},
    {"prefix": "9894", "operator": "Bharti Airtel", "circle": "TN"},
    {"prefix": "9895", "operator": "Bharti Airtel", "circle": "KL"},
    {"prefix": "9896", "operator": "Bharti Airtel", "circle": "HR"},
    {"prefix": "9897", "operator": "Bharti Airtel", "circle": "UPW"},
    {"prefix": "9898", "operator": "Bharti Airtel", "circle": "GJ"},
    # Vodafone Idea (Vi)
    {"prefix": "9811", "operator": "Vodafone Idea (Vi)", "circle": "DL"},
    {"prefix": "9812", "operator": "Vodafone Idea (Vi)", "circle": "HR"},
    {"prefix": "9814", "operator": "Vodafone Idea (Vi)", "circle": "PB"},
    {"prefix": "9819", "operator": "Vodafone Idea (Vi)", "circle": "MUM"},
    {"prefix": "9820", "operator": "Vodafone Idea (Vi)", "circle": "MUM"},
    {"prefix": "9821", "operator": "Vodafone Idea (Vi)", "circle": "MUM"},
    {"prefix": "9822", "operator": "Vodafone Idea (Vi)", "circle": "MH"},
    {"prefix": "9823", "operator": "Vodafone Idea (Vi)", "circle": "MH"},
    {"prefix": "9824", "operator": "Vodafone Idea (Vi)", "circle": "GJ"},
    {"prefix": "9825", "operator": "Vodafone Idea (Vi)", "circle": "GJ"},
    {"prefix": "9826", "operator": "Vodafone Idea (Vi)", "circle": "MP"},
    {"prefix": "9828", "operator": "Vodafone Idea (Vi)", "circle": "RJ"},
    {"prefix": "9830", "operator": "Vodafone Idea (Vi)", "circle": "KOL"},
    {"prefix": "9833", "operator": "Vodafone Idea (Vi)", "circle": "MUM"},
    {"prefix": "9836", "operator": "Vodafone Idea (Vi)", "circle": "KOL"},
    {"prefix": "9837", "operator": "Vodafone Idea (Vi)", "circle": "UPW"},
    {"prefix": "9838", "operator": "Vodafone Idea (Vi)", "circle": "UPE"},
    {"prefix": "9839", "operator": "Vodafone Idea (Vi)", "circle": "UPE"},
    {"prefix": "9843", "operator": "Vodafone Idea (Vi)", "circle": "TN"},
    {"prefix": "9844", "operator": "Vodafone Idea (Vi)", "circle": "KA"},
    {"prefix": "9846", "operator": "Vodafone Idea (Vi)", "circle": "KL"},
    {"prefix": "9847", "operator": "Vodafone Idea (Vi)", "circle": "KL"},
    {"prefix": "9848", "operator": "Vodafone Idea (Vi)", "circle": "AP"},
    {"prefix": "9850", "operator": "Vodafone Idea (Vi)", "circle": "MH"},
    {"prefix": "9873", "operator": "Vodafone Idea (Vi)", "circle": "DL"},
    {"prefix": "9886", "operator": "Vodafone Idea (Vi)", "circle": "KA"},
    {"prefix": "9891", "operator": "Vodafone Idea (Vi)", "circle": "DL"},
    {"prefix": "9899", "operator": "Vodafone Idea (Vi)", "circle": "DL"},
    # BSNL / MTNL
    {"prefix": "9412", "operator": "BSNL Mobile", "circle": "UPW"},
    {"prefix": "9414", "operator": "BSNL Mobile", "circle": "RJ"},
    {"prefix": "9415", "operator": "BSNL Mobile", "circle": "UPE"},
    {"prefix": "9416", "operator": "BSNL Mobile", "circle": "HR"},
    {"prefix": "9417", "operator": "BSNL Mobile", "circle": "PB"},
    {"prefix": "9418", "operator": "BSNL Mobile", "circle": "HP"},
    {"prefix": "9419", "operator": "BSNL Mobile", "circle": "JK"},
    {"prefix": "9420", "operator": "BSNL Mobile", "circle": "MH"},
    {"prefix": "9424", "operator": "BSNL Mobile", "circle": "MP"},
    {"prefix": "9426", "operator": "BSNL Mobile", "circle": "GJ"},
    {"prefix": "9430", "operator": "BSNL Mobile", "circle": "BR"},
    {"prefix": "9432", "operator": "BSNL Mobile", "circle": "KOL"},
    {"prefix": "9434", "operator": "BSNL Mobile", "circle": "WB"},
    {"prefix": "9435", "operator": "BSNL Mobile", "circle": "AS"},
    {"prefix": "9436", "operator": "BSNL Mobile", "circle": "NE"},
    {"prefix": "9437", "operator": "BSNL Mobile", "circle": "OR"},
    {"prefix": "9440", "operator": "BSNL Mobile", "circle": "AP"},
    {"prefix": "9442", "operator": "BSNL Mobile", "circle": "TN"},
    {"prefix": "9446", "operator": "BSNL Mobile", "circle": "KL"},
    {"prefix": "9448", "operator": "BSNL Mobile", "circle": "KA"},
]

class DoTIndiaIntelProvider(PhoneIntelProvider):
    name = "DoT / TRAI India Series"

    async def lookup(self, phone: NormalizedPhone) -> Optional[PhoneIntelligenceResult]:
        if phone.country != "IN" and phone.country_code != 91:
            return None

        raw10 = phone.national_number
        if len(raw10) < 4:
            return None

        prefix4 = raw10[:4]
        match = next((item for item in PREFIX_ALLOCATIONS if item["prefix"] == prefix4), None)

        operator_name = match["operator"] if match else "Indian Mobile Network (GSM/LTE/5G)"
        circle_code = match["circle"] if match else None
        circle_info = INDIAN_TELECOM_CIRCLES.get(circle_code, {}) if circle_code else {}

        circle_name = circle_info.get("name", "India Telecom Circle")
        capital_city = circle_info.get("capital")

        return PhoneIntelligenceResult(
            e164=phone.e164,
            valid=phone.valid,
            line_type=phone.type,
            carrier=CarrierData(
                name=f"{operator_name} ({circle_name})" if circle_name else operator_name,
                type="mobile" if phone.type == "MOBILE" else "landline",
                mcc="404",
                mnc="45",
                circle=circle_name,
                circle_code=circle_code,
                original_network=operator_name,
                ported=False,
            ),
            location=LocationData(
                country="IN",
                country_name="India",
                region=circle_name,
                region_code=circle_code,
                city=capital_city,
                timezone="Asia/Kolkata (IST)",
                accuracy="region", # Strict policy: never claim precise GPS
            ),
            confidence="high" if match else "medium",
            source="DoT / TRAI NNP (India)",
            providers_consulted=[self.name],
            notes=[
                "Resolved via Department of Telecommunications (DoT) National Numbering Plan",
                f"4-digit series allocation prefix: {prefix4}"
            ]
        )
