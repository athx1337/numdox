import typer
from cli.numdox.console import console, print_banner
from cli.numdox.commands.scan import main as scan_cmd
from cli.numdox.commands.number import main as number_cmd
from cli.numdox.commands.web import main as web_cmd
from cli.numdox.commands.github import main as github_cmd
from cli.numdox.commands.identity import main as identity_cmd

app = typer.Typer(
    name="numdox",
    help="NUMDOX — Phone Number OSINT & Intelligence Framework",
    add_completion=False,
    no_args_is_help=True
)

app.command(name="scan", help="Execute complete OSINT scan workflow on a target phone number.")(scan_cmd)
app.command(name="number", help="Normalize, validate, and inspect a phone number with telecom intelligence.")(number_cmd)
app.command(name="web", help="Execute public web OSINT and dork scanning on a target phone number.")(web_cmd)
app.command(name="github", help="Search public GitHub code, commits, and user profiles matching phone variants.")(github_cmd)
app.command(name="name", help="Find public names, aliases, UPI banking handles, and caller identities.")(identity_cmd)
app.command(name="identity", help="Alias for name discovery and entity correlation.")(identity_cmd)

@app.command(name="terminal", help="Launch the animated interactive continuous lookup console.")
def terminal():
    """Launch the animated interactive live lookup tool."""
    from cli.numlookup_tool import main as terminal_main
    terminal_main()

@app.command(name="version")
def version():
    """Display NUMDOX framework version and engine status."""
    print_banner()
    console.print("[bold bright_cyan]NUMDOX OSINT Framework[/] [dim]v0.1.0[/]")
    console.print("[dim]Cybersecurity OSINT & Public Intelligence Platform[/]")
    console.print()

if __name__ == "__main__":
    app()
