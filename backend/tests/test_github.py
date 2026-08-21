import pytest
from typer.testing import CliRunner

from backend.app.schemas.phone import NormalizedPhone
from backend.app.services.phone.normalizer import PhoneNormalizer
from backend.app.services.github.service import GitHubOSINTService
from cli.numdox.main import app

runner = CliRunner()

@pytest.mark.asyncio
async def test_github_service_structure():
    normalized = PhoneNormalizer.normalize("+919810012345")
    service = GitHubOSINTService()
    result = await service.scan(normalized)
    assert result.target_phone == "+919810012345"
    assert len(result.search_queries_used) >= 2
    assert isinstance(result.code_findings, list)
    assert isinstance(result.user_findings, list)
    assert isinstance(result.pivoted_emails, list)
    assert isinstance(result.pivoted_domains, list)
    assert isinstance(result.pivoted_usernames, list)

def test_cli_github_command():
    result = runner.invoke(app, ["github", "+919810012345"])
    assert result.exit_code == 0
    assert "+919810012345" in result.output
    assert "DISCOVERED ENTITY PIVOTS" in result.output
