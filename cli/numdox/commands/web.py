import asyncio
import typer
from rich.panel import Panel
from rich.table import Table
from rich.progress import Progress, SpinnerColumn, TextColumn

from backend.app.services.phone.normalizer import PhoneNormalizer
from backend.app.services.web.service import WebOSINTService
from cli.numdox.console import console, create_table, print_banner

app = typer.Typer(help="Execute public web OSINT and dork scanning on a target phone number.")

@app.callback(invoke_without_command=True)
def main(
    phone_number: str = typer.Argument(..., help="Target phone number"),
    country: str = typer.Option("IN", "--country", "-c", help="Default country code fallback"),
    dorks: bool = typer.Option(False, "--dorks", "-d", help="Display investigation dorks only"),
):
    """
    Search public indexed web sources across number permutations.
    """
    print_banner()

    normalized = PhoneNormalizer.normalize(phone_number, default_country=country)
    web_service = WebOSINTService()

    if not dorks:
        with Progress(
            SpinnerColumn(spinner_name="dots"),
            TextColumn("[progress.description]{task.description}"),
            console=console,
            transient=True,
        ) as progress:
            task = progress.add_task("[bold bright_cyan]Scanning public search indices across variants...", total=None)
            web_result = asyncio.run(web_service.scan(normalized))
    else:
        web_result = asyncio.run(web_service.scan(normalized, max_queries=0))

    console.print(f"[bold bright_cyan]--- [PUBLIC WEB OSINT: {normalized.e164}] ---[/]")
    console.print()

    # Findings Table
    if web_result.findings:
        findings_table = Table(
            title=f"[bold bright_cyan]PUBLIC WEB FINDINGS ({len(web_result.findings)})[/]",
            border_style="bright_blue",
            show_lines=True,
            header_style="bold cyan"
        )
        findings_table.add_column("#", style="dim", width=4)
        findings_table.add_column("Source Domain", style="bold yellow", no_wrap=True)
        findings_table.add_column("Title & Snippet", style="white")
        findings_table.add_column("Category", style="dim cyan", no_wrap=True)

        for i, f in enumerate(web_result.findings, start=1):
            body_text = f"[bold bright_white]{f.title}[/]\n[dim]{f.snippet[:120]}...[/]\n[blue underline]{f.url}[/]"
            findings_table.add_row(str(i), f.source_domain, body_text, f.category.upper())

        console.print(findings_table)
        console.print()
    else:
        console.print(Panel(
            "[dim]No immediate automated public search hits returned from direct search queries.\n"
            "Use the targeted search dorks below for deep manual reconnaissance.[/]",
            title="[yellow]Search Status[/]",
            border_style="yellow",
            expand=False
        ))
        console.print()

    # Dorks Table
    dorks_table = Table(
        title="[bold bright_cyan]AUTOMATED OSINT INVESTIGATION DORKS[/]",
        border_style="dim bright_blue",
        show_lines=True,
        header_style="bold cyan"
    )
    dorks_table.add_column("Category", style="key", no_wrap=True)
    dorks_table.add_column("Target Query / Dork String", style="bold white")
    dorks_table.add_column("Purpose", style="dim")

    for d in web_result.dorks_generated:
        dorks_table.add_row(d["category"], d["dork"], d["purpose"])

    console.print(dorks_table)
    console.print()
