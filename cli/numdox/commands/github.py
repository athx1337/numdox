import asyncio
import typer
from rich.panel import Panel
from rich.table import Table
from rich.progress import Progress, SpinnerColumn, TextColumn

from backend.app.services.phone.normalizer import PhoneNormalizer
from backend.app.services.github.service import GitHubOSINTService
from cli.numdox.console import console, create_table, print_banner

app = typer.Typer(help="Search public GitHub code, commits, and user profiles matching phone variants.")

@app.callback(invoke_without_command=True)
def main(
    phone_number: str = typer.Argument(..., help="Target phone number"),
    country: str = typer.Option("IN", "--country", "-c", help="Default country code fallback"),
    token: str = typer.Option("", "--token", "-t", help="GitHub Personal Access Token (for higher rate limits)"),
):
    """
    Search GitHub public repositories and profiles for target phone number and extract pivots.
    """
    print_banner()

    normalized = PhoneNormalizer.normalize(phone_number, default_country=country)
    gh_service = GitHubOSINTService(token=token if token else None)

    with Progress(
        SpinnerColumn(spinner_name="dots"),
        TextColumn("[progress.description]{task.description}"),
        console=console,
        transient=True,
    ) as progress:
        task = progress.add_task("[bold bright_cyan]Scanning GitHub public code, commits & profiles...", total=None)
        gh_result = asyncio.run(gh_service.scan(normalized))

    console.print(f"[bold bright_cyan]--- [GITHUB OSINT & PIVOTS: {normalized.e164}] ---[/]")
    console.print()

    # Code Findings Table
    if gh_result.code_findings:
        code_table = Table(
            title=f"[bold bright_cyan]PUBLIC CODE REPOSITORY MATCHES ({len(gh_result.code_findings)})[/]",
            border_style="bright_blue",
            show_lines=True,
            header_style="bold cyan"
        )
        code_table.add_column("#", style="dim", width=4)
        code_table.add_column("Repository", style="bold yellow", no_wrap=True)
        code_table.add_column("File Path", style="white")
        code_table.add_column("URL", style="blue underline")

        for i, f in enumerate(gh_result.code_findings, start=1):
            code_table.add_row(str(i), f.repository, f.file_path, f.html_url)

        console.print(code_table)
        console.print()

    # User Findings Table
    if gh_result.user_findings:
        user_table = Table(
            title=f"[bold bright_cyan]MATCHED DEVELOPER PROFILES ({len(gh_result.user_findings)})[/]",
            border_style="bright_blue",
            show_lines=True,
            header_style="bold cyan"
        )
        user_table.add_column("#", style="dim", width=4)
        user_table.add_column("Username", style="bold bright_cyan", no_wrap=True)
        user_table.add_column("Name", style="white")
        user_table.add_column("Bio / Details", style="dim")
        user_table.add_column("Profile URL", style="blue underline")

        for i, u in enumerate(gh_result.user_findings, start=1):
            details = f"Bio: {u.bio or 'N/A'} | Location: {u.location or 'N/A'}"
            user_table.add_row(str(i), u.username, u.name or "N/A", details, u.profile_url)

        console.print(user_table)
        console.print()

    # Pivots Summary Panel
    pivots_table = Table(
        title="[bold bright_cyan]DISCOVERED ENTITY PIVOTS[/]",
        border_style="dim bright_blue",
        show_lines=True,
        header_style="bold cyan"
    )
    pivots_table.add_column("Pivot Type", style="key", no_wrap=True)
    pivots_table.add_column("Extracted Values", style="value")

    pivots_table.add_row("Usernames", ", ".join(gh_result.pivoted_usernames) if gh_result.pivoted_usernames else "[dim]None[/]")
    pivots_table.add_row("Emails", ", ".join(gh_result.pivoted_emails) if gh_result.pivoted_emails else "[dim]None[/]")
    pivots_table.add_row("Domains (WebTrace)", ", ".join(gh_result.pivoted_domains) if gh_result.pivoted_domains else "[dim]None[/]")

    console.print(pivots_table)
    console.print()

    if gh_result.rate_limited:
        console.print(Panel(
            "[yellow]Note: GitHub API unauthenticated rate limit reached (60 req/hr).\n"
            "Set GITHUB_TOKEN in your .env file for 5,000 requests/hr rate limits.[/]",
            border_style="yellow",
            expand=False
        ))
        console.print()
