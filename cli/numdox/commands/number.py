import asyncio
import typer
from rich.panel import Panel
from rich.table import Table

from backend.app.services.phone.normalizer import PhoneNormalizer
from backend.app.services.phone.service import PhoneIntelligenceService
from cli.numdox.console import console, create_table, print_error

app = typer.Typer(help="Normalize, validate, and inspect a phone number with telecom intelligence.")

@app.callback(invoke_without_command=True)
def main(
    phone_number: str = typer.Argument(..., help="Target phone number (e.g. +919876543210 or 9876543210)"),
    country: str = typer.Option("IN", "--country", "-c", help="Default ISO 2-letter country code if missing prefix"),
):
    """
    Perform deep normalization, E.164 verification, and phone intelligence analysis.
    """
    normalized = PhoneNormalizer.normalize(phone_number, default_country=country)
    service = PhoneIntelligenceService()
    intel = asyncio.run(service.gather_intelligence(normalized))

    status_badge = "[bold green]VALID[/]" if normalized.valid else "[bold red]INVALID / UNKNOWN[/]"
    conf_color = "green" if intel.confidence == "high" else "yellow" if intel.confidence == "medium" else "cyan"

    # Target Intelligence Table
    table = create_table(f"TARGET ASSESSMENT: {normalized.e164}")
    table.add_column("Property", style="key", no_wrap=True)
    table.add_column("Value", style="value")

    table.add_row("E.164 Identity", f"[bold bright_cyan]{normalized.e164}[/]")
    table.add_row("International Format", normalized.international)
    table.add_row("National Format", normalized.national)
    table.add_row("Country / Region", f"{intel.location.country_name} ({intel.location.country})")
    table.add_row("Telecom Circle", intel.carrier.circle or intel.location.region or "[dim]N/A[/]")
    table.add_row("Carrier Network", f"[bold white]{intel.carrier.name or 'Unknown'}[/]")
    table.add_row("Line Classification", f"[bold yellow]{intel.line_type}[/]")
    table.add_row("Timezone", intel.location.timezone or "Asia/Kolkata (IST)")
    table.add_row("MCC / MNC", f"{intel.carrier.mcc or '404'} / {intel.carrier.mnc or '45'}")
    table.add_row("Validity Status", status_badge)
    table.add_row("Intelligence Source", f"[bold dim cyan]{intel.source}[/]")
    table.add_row("Confidence Level", f"[{conf_color}]{intel.confidence.upper()}[/]")

    console.print()
    console.print(table)
    console.print()

    # Search Permutations Table
    variants_table = Table(
        title="[bold bright_cyan]PUBLIC OSINT SEARCH PERMUTATIONS[/]",
        border_style="dim bright_blue",
        show_header=True,
        header_style="bold cyan"
    )
    variants_table.add_column("#", style="dim", width=4)
    variants_table.add_column("Query Permutation", style="bold white")
    variants_table.add_column("Target Type", style="dim cyan")

    for i, variant in enumerate(normalized.search_variants, start=1):
        v_type = "Exact Match" if variant.startswith('"') else "Standard"
        variants_table.add_row(str(i), variant, v_type)

    console.print(variants_table)
    console.print()
