import re
from typing import List, Optional
import phonenumbers
from phonenumbers import PhoneNumberFormat, PhoneNumberType

from backend.app.schemas.phone import NormalizedPhone

NUMBER_TYPE_MAP = {
    PhoneNumberType.FIXED_LINE: "FIXED_LINE",
    PhoneNumberType.MOBILE: "MOBILE",
    PhoneNumberType.FIXED_LINE_OR_MOBILE: "FIXED_LINE_OR_MOBILE",
    PhoneNumberType.TOLL_FREE: "TOLL_FREE",
    PhoneNumberType.PREMIUM_RATE: "PREMIUM_RATE",
    PhoneNumberType.SHARED_COST: "SHARED_COST",
    PhoneNumberType.VOIP: "VOIP",
    PhoneNumberType.PERSONAL_NUMBER: "PERSONAL_NUMBER",
    PhoneNumberType.PAGER: "PAGER",
    PhoneNumberType.UAN: "UAN",
    PhoneNumberType.VOICEMAIL: "VOICEMAIL",
    PhoneNumberType.UNKNOWN: "UNKNOWN",
}

class PhoneNormalizer:
    @staticmethod
    def normalize(raw_input: str, default_country: str = "IN") -> NormalizedPhone:
        cleaned_input = raw_input.strip()
        default_region = default_country.upper() if default_country else "IN"

        # If user passed number with no +, and provided default region, parse with region
        try:
            parsed = phonenumbers.parse(cleaned_input, default_region)
        except phonenumbers.NumberParseException as e:
            # Return invalid fallback
            return NormalizedPhone(
                input=raw_input,
                e164=raw_input,
                international=raw_input,
                national=raw_input,
                rfc3966=f"tel:{raw_input}",
                country=default_region,
                country_code=0,
                national_number=re.sub(r"[^\d]", "", raw_input),
                type="UNKNOWN",
                valid=False,
                possible=False,
                search_variants=PhoneNormalizer.generate_search_variants(cleaned_input, "", "", ""),
                metadata={"error": str(e)},
            )

        is_valid = phonenumbers.is_valid_number(parsed)
        is_possible = phonenumbers.is_possible_number(parsed)
        num_type_enum = phonenumbers.number_type(parsed)
        line_type = NUMBER_TYPE_MAP.get(num_type_enum, "UNKNOWN")

        country_iso = phonenumbers.region_code_for_number(parsed) or default_region
        country_code = parsed.country_code
        national_number_str = str(parsed.national_number)

        e164 = phonenumbers.format_number(parsed, PhoneNumberFormat.E164)
        international = phonenumbers.format_number(parsed, PhoneNumberFormat.INTERNATIONAL)
        national = phonenumbers.format_number(parsed, PhoneNumberFormat.NATIONAL)
        rfc3966 = phonenumbers.format_number(parsed, PhoneNumberFormat.RFC3966)

        search_variants = PhoneNormalizer.generate_search_variants(
            e164=e164,
            national=national,
            international=international,
            national_number=national_number_str,
            country_code=str(country_code)
        )

        return NormalizedPhone(
            input=raw_input,
            e164=e164,
            international=international,
            national=national,
            rfc3966=rfc3966,
            country=country_iso,
            country_code=country_code,
            national_number=national_number_str,
            type=line_type,
            valid=is_valid,
            possible=is_possible,
            search_variants=search_variants,
            metadata={
                "extension": parsed.extension or None,
                "raw_input": raw_input,
            }
        )

    @staticmethod
    def generate_search_variants(
        e164: str,
        national: str,
        international: str,
        national_number: str,
        country_code: str = "91"
    ) -> List[str]:
        variants = set()

        if e164:
            variants.add(e164)
            variants.add(f'"{e164}"')
            variants.add(e164.replace("+", ""))

        if national_number:
            variants.add(national_number)
            variants.add(f'"{national_number}"')
            # Leading zero national variant (common in India/UK/Europe)
            variants.add(f"0{national_number}")
            variants.add(f'"0{national_number}"')

        if international:
            variants.add(international)
            variants.add(f'"{international}"')
            variants.add(international.replace(" ", "-"))
            variants.add(international.replace(" ", ""))

        if national:
            variants.add(national)
            variants.add(f'"{national}"')
            variants.add(national.replace(" ", "-"))

        # Space separated 5-5 split (e.g. "+91 98765 43210", "98765 43210" for 10-digit numbers)
        if len(national_number) == 10:
            part1 = national_number[:5]
            part2 = national_number[5:]
            variants.add(f"{part1} {part2}")
            variants.add(f"{part1}-{part2}")
            if country_code:
                variants.add(f"+{country_code} {part1} {part2}")
                variants.add(f"+{country_code}-{part1}-{part2}")
                variants.add(f'"+{country_code} {part1} {part2}"')

        # Clean list in sorted order with quotes and clean formats first
        ordered_variants = sorted(list(variants), key=lambda x: (len(x), x))
        return ordered_variants
