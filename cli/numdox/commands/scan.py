import asyncio
import typer
from rich.panel import Panel
from rich.progress import Progress, SpinnerColumn, TextColumn

from backend.app.services.phone.normalizer import PhoneNormalizer
from backend.app.services.phone.service import PhoneIntelligenceService
from cli.numdox.console import console, create_table, print_banner

app = typer.Typer(help="Execute complete OSINT scan workflow on a target phone number.")

@app.callback(invoke_without_command=True)
def main(
    phone_number: str = typer.Argument(..., help="Target phone number"),
    country: str = typer.Option("IN", "--country", "-c", help="Default country code fallback"),
    deep: bool = typer.Option(False, "--deep", "-d", help="Run automated deep reconnaissance on all providers"),
):
    """
    Run full OSINT reconnaissance workflow on a target number.
    """
    print_banner()

    service = PhoneIntelligenceService()

    with Progress(
        SpinnerColumn(spinner_name="dots"),
        TextColumn("[progress.description]{task.description}"),
        console=console,
        transient=True,
    ) as progress:
        task = progress.add_task("[bold bright_cyan]Gathering phone intelligence & carrier signals...", total=None)
        normalized = PhoneNormalizer.normalize(phone_number, default_country=country)
        intel = asyncio.run(service.gather_intelligence(normalized))

    console.print(f"[bold bright_cyan]--- [TARGET ASSESSMENT: {normalized.e164}] ---[/]")
    console.print()

    # Normalization & Telecom Table
    table = create_table("PHASE 1 & 2: TELECOM & NUMBER INTELLIGENCE")
    table.add_column("Property", style="key", no_wrap=True)
    table.add_column("Assessment", style="value")

    table.add_row("E.164 Identity", f"[bold bright_cyan]{normalized.e164}[/]")
    table.add_row("Country / Jurisdiction", f"{intel.location.country_name} ({intel.location.country})")
    table.add_row("Licensed Telecom Circle", intel.carrier.circle or intel.location.region or "[dim]N/A[/]")
    table.add_row("Carrier Network", f"[bold white]{intel.carrier.name or 'Unknown'}[/]")
    table.add_row("Line Classification", f"[bold yellow]{intel.line_type}[/]")
    table.add_row("Timezone", intel.location.timezone or "Asia/Kolkata (IST)")
    table.add_row("Validation Status", "[bold green]VALID[/]" if normalized.valid else "[bold red]INVALID[/]")
    table.add_row("Intelligence Source", intel.source)
    table.add_row("Confidence Level", f"[bold green]{intel.confidence.upper()}[/]")
    table.add_row("Search Permutations", f"{len(normalized.search_variants)} variants generated")

    console.print(table)
    console.print()

    console.print(Panel(
        f"[bold bright_white]E.164 Target: [bright_cyan]{normalized.e164}[/]\n"
        f"Carrier: [bright_yellow]{intel.carrier.name}[/] | Circle: [bright_yellow]{intel.carrier.circle or 'National'}[/]\n"
        f"Confidence: [bright_green]{intel.confidence.upper()}[/] via [dim]{intel.source}[/]\n"
        f"Generated [bright_yellow]{len(normalized.search_variants)}[/] search query permutations ready for Web/GitHub OSINT.[/]",
        title="[bold green][+] Phase 1 & 2 Complete[/]",
        border_style="green",
        expand=False
    ))
    console.print()
