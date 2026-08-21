import pytest
from typer.testing import CliRunner

from backend.app.services.phone.normalizer import PhoneNormalizer
from backend.app.services.web.dorks import DorkGenerator
from backend.app.services.web.duckduckgo import DuckDuckGoSearchProvider
from backend.app.services.web.service import WebOSINTService
from cli.numdox.main import app

runner = CliRunner()

def test_dork_generator():
    normalized = PhoneNormalizer.normalize("+919810012345")
    dorks = DorkGenerator.generate_dorks(normalized)
    assert len(dorks) >= 5
    categories = [d["category"] for d in dorks]
    assert "Public Document / PDF Leaks" in categories
    assert "Paste & Dump Repositories" in categories
    assert "Code & Developer Repositories" in categories
    assert "+919810012345" in dorks[0]["dork"]

def test_category_classification():
    provider = DuckDuckGoSearchProvider()
    assert provider._classify_category("https://pastebin.com/raw/xyz", "") == "paste"
    assert provider._classify_category("https://example.com/invoice.pdf", "") == "document"
    assert provider._classify_category("https://github.com/user/repo", "") == "code"
    assert provider._classify_category("https://linkedin.com/in/user", "") == "social"
    assert provider._classify_category("https://example.com/page", "") == "general"

@pytest.mark.asyncio
async def test_web_osint_service_structure():
    normalized = PhoneNormalizer.normalize("+919810012345")
    service = WebOSINTService()
    result = await service.scan(normalized, max_queries=1)
    assert result.target_phone == "+919810012345"
    assert len(result.dorks_generated) >= 5
    assert isinstance(result.domains_discovered, list)
    assert isinstance(result.findings, list)

def test_cli_web_command_dorks():
    result = runner.invoke(app, ["web", "+919810012345", "--dorks"])
    assert result.exit_code == 0
    assert "AUTOMATED OSINT INVESTIGATION DORKS" in result.output
    assert "Public Document / PDF Leaks" in result.output

def test_cli_web_command_standard():
    result = runner.invoke(app, ["web", "+919810012345"])
    assert result.exit_code == 0
    assert "+919810012345" in result.output
