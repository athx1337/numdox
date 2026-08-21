from typing import List, Dict
from urllib.parse import quote_plus
from backend.app.schemas.phone import NormalizedPhone

class DorkGenerator:
    @staticmethod
    def generate_dorks(phone: NormalizedPhone) -> List[Dict[str, str]]:
        num_raw = phone.national_number
        e164 = phone.e164
        int_fmt = phone.international

        dorks = [
            {
                "category": "Exact Identifier Matches",
                "dork": f'"{e164}" OR "{num_raw}" OR "{int_fmt}"',
                "purpose": "Find exact public indexed web occurrences",
                "google_url": f"https://www.google.com/search?q={quote_plus(f'\"{e164}\" OR \"{num_raw}\"')}",
                "ddg_url": f"https://duckduckgo.com/?q={quote_plus(f'\"{e164}\" OR \"{num_raw}\"')}",
            },
            {
                "category": "Public Document / PDF Leaks",
                "dork": f'filetype:pdf OR filetype:xlsx OR filetype:docx ("{e164}" OR "{num_raw}")',
                "purpose": "Discover publicly indexed PDFs, spreadsheets, and invoices",
                "google_url": f"https://www.google.com/search?q={quote_plus(f'filetype:pdf (\"{e164}\" OR \"{num_raw}\")')}",
                "ddg_url": f"https://duckduckgo.com/?q={quote_plus(f'filetype:pdf (\"{e164}\" OR \"{num_raw}\")')}",
            },
            {
                "category": "Paste & Dump Repositories",
                "dork": f'site:pastebin.com OR site:justpaste.it OR site:rentry.co ("{e164}" OR "{num_raw}")',
                "purpose": "Check public paste sites and text dumps",
                "google_url": f"https://www.google.com/search?q={quote_plus(f'site:pastebin.com OR site:justpaste.it (\"{e164}\" OR \"{num_raw}\")')}",
                "ddg_url": f"https://duckduckgo.com/?q={quote_plus(f'site:pastebin.com OR site:justpaste.it (\"{e164}\" OR \"{num_raw}\")')}",
            },
            {
                "category": "Code & Developer Repositories",
                "dork": f'site:github.com OR site:gitlab.com OR site:gist.github.com ("{e164}" OR "{num_raw}")',
                "purpose": "Find exposed developer configs, source commits, and contact profiles",
                "google_url": f"https://www.google.com/search?q={quote_plus(f'site:github.com (\"{e164}\" OR \"{num_raw}\")')}",
                "ddg_url": f"https://duckduckgo.com/?q={quote_plus(f'site:github.com (\"{e164}\" OR \"{num_raw}\")')}",
            },
            {
                "category": "Public Profiles & Social Footprint",
                "dork": f'site:linkedin.com/in/ OR site:twitter.com OR site:facebook.com ("{e164}" OR "{num_raw}")',
                "purpose": "Identify associated public social & professional profiles",
                "google_url": f"https://www.google.com/search?q={quote_plus(f'site:linkedin.com/in (\"{e164}\" OR \"{num_raw}\")')}",
                "ddg_url": f"https://duckduckgo.com/?q={quote_plus(f'site:linkedin.com/in (\"{e164}\" OR \"{num_raw}\")')}",
            },
            {
                "category": "Business & Directory Listings",
                "dork": f'site:indiamart.com OR site:justdial.com OR site:tradeindia.com ("{num_raw}")',
                "purpose": "Inspect business registrations, vendor listings, and merchant records",
                "google_url": f"https://www.google.com/search?q={quote_plus(f'site:indiamart.com OR site:justdial.com \"{num_raw}\"')}",
                "ddg_url": f"https://duckduckgo.com/?q={quote_plus(f'site:indiamart.com OR site:justdial.com \"{num_raw}\"')}",
            }
        ]
        return dorks
