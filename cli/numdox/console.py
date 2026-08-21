import sys
import io
from rich.console import Console
from rich.theme import Theme
from rich.panel import Panel
from rich.table import Table
from rich.text import Text
from rich.align import Align

# Ensure UTF-8 output on Windows
if sys.platform == "win32":
    try:
        if hasattr(sys.stdout, "reconfigure"):
            sys.stdout.reconfigure(encoding="utf-8", errors="replace")
        if hasattr(sys.stderr, "reconfigure"):
            sys.stderr.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

custom_theme = Theme({
    "info": "dim cyan",
    "warning": "yellow",
    "danger": "bold red",
    "success": "bold green",
    "primary": "bold bright_cyan",
    "dim": "dim white",
    "code": "bold bright_white on grey15",
    "key": "dim cyan",
    "value": "bold white",
    "accent": "bold magenta",
})

console = Console(theme=custom_theme, force_terminal=True if sys.stdout.isatty() else None)

BANNER = r"""
 [bold bright_cyan]███╗   ██╗██╗   ██╗███╗   ███╗██████╗  ██████╗ ██╗  ██╗[/]
 [bold bright_cyan]████╗  ██║██║   ██║████╗ ████║██╔══██╗██╔═══██╗╚██╗██╔╝[/]
 [bold cyan]██╔██╗ ██║██║   ██║██╔████╔██║██║  ██║██║   ██║ ╚███╔╝ [/]
 [bold cyan]██║╚██╗██║██║   ██║██║╚██╔╝██║██║  ██║██║   ██║ ██╔██╗ [/]
 [bold dim cyan]██║ ╚████║╚██████╔╝██║ ╚═╝ ██║██████╔╝╚██████╔╝██╔╝ ██╗[/]
 [bold dim cyan]╚═╝  ╚═══╝ ╚═════╝ ╚═╝     ╚═╝╚═════╝  ╚═════╝ ╚═╝  ╚═╝[/]
 [dim]-- Phone Number OSINT & Public Intelligence Framework --[/]
"""

def print_banner():
    console.print(Align.center(BANNER))
    console.print()

def print_error(message: str):
    console.print(Panel(f"[danger]ERROR:[/] {message}", border_style="red", expand=False))

def print_success(message: str):
    console.print(Panel(f"[success]SUCCESS:[/] {message}", border_style="green", expand=False))

def create_table(title: str) -> Table:
    table = Table(
        title=f"[bold bright_cyan]{title}[/]",
        border_style="bright_blue",
        header_style="bold cyan",
        show_lines=True,
        expand=False
    )
    return table
