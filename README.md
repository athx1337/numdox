<p align="center">
  <img src="public/logo.png" width="110" height="110" alt="NUMDOX Logo" />
</p>

<h1 align="center">numdox.</h1>

<p align="center">
  <strong>Fast, privacy-first phone intelligence and OSINT entity resolution workspace.</strong>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Next.js-15-black?style=flat-square&logo=next.js" alt="Next.js" />
  <img src="https://img.shields.io/badge/TypeScript-5.8-blue?style=flat-square&logo=typescript" alt="TypeScript" />
  <img src="https://img.shields.io/badge/Python-3.11+-3776AB?style=flat-square&logo=python" alt="Python" />
  <img src="https://img.shields.io/badge/Architecture-Modular%20OSINT-00c853?style=flat-square" alt="Modular OSINT" />
  <img src="https://img.shields.io/badge/License-MIT-gray?style=flat-square" alt="License" />
</p>

---

## What is NUMDOX?

**NUMDOX** is a modular phone intelligence engine designed to turn a single phone number into an actionable map of publicly accessible signals. 

Unlike traditional directories that rely entirely on brittle third-party APIs or enforce manual entry, NUMDOX runs an automatic **multi-source intelligence pipeline** across indexed public web pages, GitHub repositories, public documents (PDF, CSV, TXT), and carrier registries.

---

## Core Capabilities

- **Automatic Identity Resolution**: Normalizes numbers into exhaustive search variants (`E.164`, national, international, spaced, hyphenated, quotes) and discovers candidate names from public records.
- **Proximity Entity Extraction**: Extracts names, usernames, emails, and organizations within proximity (`±300 chars`) of phone occurrences and parses Schema.org / JSON-LD structured contact cards.
- **Non-Blocking Fault Tolerance**: Third-party quota exhaustion (e.g. RapidAPI caller ID pools) no longer interrupts scans. The engine marks the directory source as offline and continues running public web, document, and GitHub collectors.
- **Real Data Only**: No simulated or fabricated names. If no public name is found, NUMDOX explicitly reports `NO RELIABLE NAME FOUND`.
- **Clickable Provenance**: Every extracted candidate name is linked to its verifiable public source URL alongside surrounding snippet context.
- **Telecom & Carrier Intelligence**: Identifies carrier routing, line classification (Mobile / VoIP / Landline), licensed circle, and timezones.
- **UPI & Banking Surface (India)**: Generates one-click NPCI banking verification endpoints (PhonePe, Paytm, Google Pay, BHIM).
- **Threat & Reputation**: Scans for public data breach signals and risk spam reputation flags.

---

## Multi-Source Collector Architecture

```
                             [ Target Phone Number ]
                                        │
                             Phone Normalizer & Permutations
                                        │
           ┌────────────────────────────┼────────────────────────────┐
           │                            │                            │
    [ Web Collector ]          [ GitHub Collector ]        [ Document Collector ]
    - DuckDuckGo public index  - GitHub Code & Commits     - Public PDF, CSV, TXT
    - HTML page text parsing   - User Profiles & Gists     - Tabular contact rows
    - Schema.org / JSON-LD     - Web search fallback       - Document metadata
    - Proximity window (±300c) - Author / committer data   - Signatory blocks
           │                            │                            │
           └────────────────────────────┼────────────────────────────┘
                                        │
                            [ Directory Collector ]
                            - Caller ID waterfall pool
                            - Graceful 429 failover
                                        │
                            [ Secondary Pivots ]
                            - Depth <= 2
                            - Discovered usernames / emails
                                        │
                           [ Correlator & Ranking ]
                           - Name clustering & normalization
                           - Independent source weighting
                           - High / Medium / Low confidence
                                        │
                          [ NUMDOX Live Results UI ]
```

---

## Getting Started

### 1. Web Application (Next.js)

```bash
# Clone repository
git clone https://github.com/athx1337/numdox.git
cd numdox

# Install dependencies
npm install

# Run development server
npm run dev

# Open in browser
# http://localhost:3000
```

### 2. Python CLI & Backend

```bash
# Install Python requirements
pip install -r backend/requirements.txt

# Run CLI target scan
python -m cli.numdox.main scan "+919810012345"

# Run identity OSINT lookup
python -m cli.numdox.main identity "+919810012345"
```

---

## Environment Configuration

Create `.env.local` or `.env` in the project root:

```env
# Optional external APIs (NUMDOX runs public collectors without any keys required)
RAPIDAPI_TRUECALLER_KEY=your_rapidapi_key_here
GITHUB_TOKEN=your_github_token_here
NUMVERIFY_API_KEY=your_numverify_key_here
```

---

## Testing & Quality Assurance

```bash
# Run frontend unit tests (Vitest)
npm run test

# TypeScript typecheck
npx tsc --noEmit

# Production build test
npm run build

# Run Python test suite
python -m pytest
```

---

## Ethical & Privacy Notice

NUMDOX is designed strictly for authorized security assessments, OSINT investigations, fraud prevention, and identity verification. NUMDOX only accesses publicly accessible, indexed web data and does not bypass authentication, firewalls, or paywalls.

---

## License

Released under the MIT License.
