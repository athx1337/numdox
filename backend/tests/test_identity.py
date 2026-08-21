import pytest
from typer.testing import CliRunner

from backend.app.schemas.phone import NormalizedPhone
from backend.app.schemas.web import WebFinding
from backend.app.schemas.github import GitHubUserFinding
from backend.app.services.phone.normalizer import PhoneNormalizer
from backend.app.services.identity.extractor import IdentityExtractor
from cli.numdox.main import app

runner = CliRunner()

def test_extract_names_from_web_findings():
    findings = [
        WebFinding(
            url="https://example.com/team",
            title="Dr. Amit Sharma Contact Details",
            snippet="Call Dr. Amit Sharma at +919810012345 for consultations.",
            matched_variant="+919810012345",
            source_domain="example.com"
        )
    ]
    evidences = IdentityExtractor.extract_names_from_web_findings(findings)
    assert len(evidences) >= 1
    assert any("Amit Sharma" in ev.name for ev in evidences)

def test_extract_names_from_github():
    users = [
        GitHubUserFinding(
            username="amitsharma",
            name="Amit Sharma",
            profile_url="https://github.com/amitsharma",
            bio="Security Engineer",
            email="amit@example.com"
        )
    ]
    evidences = IdentityExtractor.extract_names_from_github(users)
    assert len(evidences) == 1
    assert evidences[0].name == "Amit Sharma"
    assert evidences[0].confidence == "high"

@pytest.mark.asyncio
async def test_compile_identity_indian_upi():
    phone = PhoneNormalizer.normalize("+919810012345")
    identity = await IdentityExtractor.compile_identity(phone=phone)
    assert identity.upi_result is not None
    assert len(identity.upi_result.handles) >= 4
    vpas = [u.vpa for u in identity.upi_result.handles]
    assert "9810012345@ybl" in vpas
    assert "9810012345@paytm" in vpas
    assert "9810012345@okaxis" in vpas
    assert "truecaller.com/search/in/+919810012345" in identity.truecaller_search_url

def test_cli_name_command():
    result = runner.invoke(app, ["name", "+919810012345"])
    assert result.exit_code == 0
    assert "+919810012345" in result.output
    assert "UPI BENEFICIARY NAME RESOLUTION HANDLES" in result.output

def test_cli_identity_command():
    result = runner.invoke(app, ["identity", "+919810012345"])
    assert result.exit_code == 0
    assert "+919810012345" in result.output
