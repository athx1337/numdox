import asyncio
import typer
from rich.panel import Panel
from rich.table import Table
from rich.progress import Progress, SpinnerColumn, TextColumn

from backend.app.services.phone.normalizer import PhoneNormalizer
from backend.app.services.web.service import WebOSINTService
from backend.app.services.github.service import GitHubOSINTService
from backend.app.services.identity.extractor import IdentityExtractor
from cli.numdox.console import console, print_banner

app = typer.Typer(help="Find public names, aliases, UPI banking handles, and caller identities for a phone number.")

@app.callback(invoke_without_command=True)
def main(
    phone_number: str = typer.Argument(..., help="Target phone number"),
    country: str = typer.Option("IN", "--country", "-c", help="Default country code fallback"),
    record_name: str = typer.Option("", "--record", "-r", help="Record an operator-verified name"),
    truecaller_token: str = typer.Option("", "--truecaller-token", "-t", help="Truecaller API Bearer Token"),
):
    """
    Find names, aliases, UPI banking handles, and public identity signals.
    """
    print_banner()

    normalized = PhoneNormalizer.normalize(phone_number, default_country=country)
    web_service = WebOSINTService()
    github_service = GitHubOSINTService()

    with Progress(
        SpinnerColumn(spinner_name="dots"),
        TextColumn("[progress.description]{task.description}"),
        console=console,
        transient=True,
    ) as progress:
        task = progress.add_task("[bold bright_cyan]Correlating public web, Truecaller, GitHub, and UPI signals...", total=None)
        web_res = asyncio.run(web_service.scan(normalized))
        gh_res = asyncio.run(github_service.scan(normalized))

        identity_res = asyncio.run(IdentityExtractor.compile_identity(
            phone=normalized,
            web_findings=web_res.findings,
            github_users=gh_res.user_findings,
            operator_name=record_name if record_name else None,
            truecaller_token=truecaller_token if truecaller_token else None
        ))

    console.print(f"[bold bright_cyan]--- [PERSON IDENTITY & NAME DISCOVERY: {normalized.e164}] ---[/]")
    console.print()

    # Primary Name Banner
    if identity_res.primary_name:
        console.print(Panel(
            f"[bold bright_green]{identity_res.primary_name}[/]\n"
            f"[dim]Confidence Score: {int(identity_res.confidence_score * 100)}% | Primary Identified Entity[/]",
            title="[bold bright_cyan]RESOLVED PERSON NAME[/]",
            border_style="bright_green",
            expand=False
        ))
        console.print()

    # Discovered Names Table
    if identity_res.names_discovered:
        names_table = Table(
            title=f"[bold bright_cyan]DISCOVERED NAMES & ALIASES ({len(identity_res.names_discovered)})[/]",
            border_style="bright_blue",
            show_lines=True,
            header_style="bold cyan"
        )
        names_table.add_column("#", style="dim", width=4)
        names_table.add_column("Discovered Name / Alias", style="bold bright_white", no_wrap=True)
        names_table.add_column("Source Provenance", style="bold yellow", no_wrap=True)
        names_table.add_column("Confidence", style="dim cyan", no_wrap=True)
        names_table.add_column("Context / Snippet", style="dim")

        for i, item in enumerate(identity_res.names_discovered, start=1):
            names_table.add_row(
                str(i),
                item.name,
                item.source,
                item.confidence.upper(),
                item.snippet or "N/A"
            )

        console.print(names_table)
        console.print()
    else:
        console.print(Panel(
            "[dim]No direct name mentions extracted automatically from basic search indexing.\n"
            "Use the verified banking UPI handles and Truecaller verification channels below.[/]",
            title="[yellow]Automated Identity Status[/]",
            border_style="yellow",
            expand=False
        ))
        console.print()

    # UPI Banking Handles Table (India)
    if identity_res.upi_result and identity_res.upi_result.is_eligible_india_upi:
        upi_table = Table(
            title="[bold bright_cyan]UPI BENEFICIARY NAME RESOLUTION HANDLES (INDIA)[/]",
            border_style="dim bright_blue",
            show_lines=True,
            header_style="bold cyan"
        )
        upi_table.add_column("App / PSP Provider", style="key", no_wrap=True)
        upi_table.add_column("VPA Virtual Address", style="bold bright_green", no_wrap=True)
        upi_table.add_column("Resolution Workflow", style="dim")

        for u in identity_res.upi_result.handles:
            upi_table.add_row(u.app, u.vpa, f"Enter VPA in {u.app} to verify official KYC registered name")

        console.print(upi_table)
        console.print()

    # External Verification Channels
    channels_table = Table(
        title="[bold bright_cyan]OFFICIAL CALLER ID & VERIFICATION ENDPOINTS[/]",
        border_style="dim bright_blue",
        show_lines=True,
        header_style="bold cyan"
    )
    channels_table.add_column("Channel", style="key", no_wrap=True)
    channels_table.add_column("Inspection URL", style="blue underline")

    channels_table.add_row("Truecaller Public Search", identity_res.truecaller_search_url)
    channels_table.add_row("WhatsApp Direct Profile", identity_res.whatsapp_chat_url)
    channels_table.add_row("Google Search Indexed Quotes", identity_res.google_search_url)

    console.print(channels_table)
    console.print()
