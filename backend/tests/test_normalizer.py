import pytest
from typer.testing import CliRunner

from backend.app.services.phone.normalizer import PhoneNormalizer
from cli.numdox.main import app

runner = CliRunner()

def test_normalize_indian_number_with_prefix():
    res = PhoneNormalizer.normalize("+919876543210")
    assert res.valid is True
    assert res.e164 == "+919876543210"
    assert res.country == "IN"
    assert res.country_code == 91
    assert res.national_number == "9876543210"
    assert res.type == "MOBILE"
    assert "+91 98765 43210" in res.search_variants
    assert '"9876543210"' in res.search_variants
    assert '"09876543210"' in res.search_variants

def test_normalize_indian_number_raw_fallback_country():
    res = PhoneNormalizer.normalize("9810012345", default_country="IN")
    assert res.valid is True
    assert res.e164 == "+919810012345"
    assert res.country == "IN"
    assert res.country_code == 91
    assert res.national_number == "9810012345"

def test_normalize_us_number():
    res = PhoneNormalizer.normalize("+14155552671")
    assert res.valid is True
    assert res.e164 == "+14155552671"
    assert res.country == "US"
    assert res.country_code == 1

def test_normalize_invalid_number():
    res = PhoneNormalizer.normalize("99999999999999999999")
    assert res.valid is False

def test_search_variants_generation():
    variants = PhoneNormalizer.generate_search_variants(
        e164="+919876543210",
        national="098765 43210",
        international="+91 98765 43210",
        national_number="9876543210",
        country_code="91"
    )
    assert len(variants) > 5
    assert "+919876543210" in variants
    assert '"+919876543210"' in variants
    assert "98765 43210" in variants

def test_cli_version():
    result = runner.invoke(app, ["version"])
    assert result.exit_code == 0
    assert "NUMDOX" in result.output

def test_cli_number_command():
    result = runner.invoke(app, ["number", "+919876543210"])
    assert result.exit_code == 0
    assert "+919876543210" in result.output
    assert "VALID" in result.output

def test_cli_scan_command():
    result = runner.invoke(app, ["scan", "+919810012345"])
    assert result.exit_code == 0
    assert "+919810012345" in result.output
    assert "Complete" in result.output
