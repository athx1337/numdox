import pytest
from typer.testing import CliRunner

from backend.app.schemas.phone import NormalizedPhone
from backend.app.services.phone.normalizer import PhoneNormalizer
from backend.app.services.phone.dot_india import DoTIndiaIntelProvider
from backend.app.services.phone.libphone import LibphonenumberIntelProvider
from backend.app.services.phone.service import PhoneIntelligenceService
from cli.numdox.main import app

runner = CliRunner()

@pytest.mark.asyncio
async def test_dot_india_provider_airtel():
    normalized = PhoneNormalizer.normalize("+919810012345")
    provider = DoTIndiaIntelProvider()
    res = await provider.lookup(normalized)
    assert res is not None
    assert "Bharti Airtel" in res.carrier.name
    assert res.carrier.circle == "Delhi NCR"
    assert res.location.city == "New Delhi"
    assert res.confidence == "high"

@pytest.mark.asyncio
async def test_dot_india_provider_jio():
    normalized = PhoneNormalizer.normalize("+916380012345")
    provider = DoTIndiaIntelProvider()
    res = await provider.lookup(normalized)
    assert res is not None
    assert "Reliance Jio" in res.carrier.name
    assert "Tamil Nadu" in res.carrier.circle

@pytest.mark.asyncio
async def test_libphonenumber_provider_us():
    normalized = PhoneNormalizer.normalize("+14155552671")
    provider = LibphonenumberIntelProvider()
    res = await provider.lookup(normalized)
    assert res is not None
    assert res.location.country == "US"
    assert res.location.timezone is not None

@pytest.mark.asyncio
async def test_phone_intelligence_service():
    normalized = PhoneNormalizer.normalize("+919810012345")
    service = PhoneIntelligenceService()
    res = await service.gather_intelligence(normalized)
    assert res is not None
    assert res.e164 == "+919810012345"
    assert res.carrier.name is not None
    assert res.location.country == "IN"
    assert res.location.accuracy == "region" # Enforce strict policy: no fake GPS

def test_cli_number_with_intelligence():
    result = runner.invoke(app, ["number", "+919810012345"])
    assert result.exit_code == 0
    assert "+919810012345" in result.output
    assert "Bharti Airtel" in result.output
    assert "Delhi NCR" in result.output

def test_cli_scan_with_intelligence():
    result = runner.invoke(app, ["scan", "+916380012345"])
    assert result.exit_code == 0
    assert "+916380012345" in result.output
    assert "Reliance Jio" in result.output
    assert "Phase 1 & 2 Complete" in result.output
