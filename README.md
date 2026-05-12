# Humanify — AI Text Humanizer Chrome Extension

One-click rewrite AI-generated content into natural, human-sounding text.

## Features

- **AI Detection** — Analyzes selected text for AI-telltale patterns (overused words, sentence structures, stylistic markers)
- **One-Click Rewriting** — Powered by [Groq API](https://groq.com/) (free, fast inference)
- **Tone Adjustment** — Choose between Casual, Neutral, or Formal voice
- **Privacy-First** — All text processing happens locally or through Groq API; no data stored on third-party servers
- **Daily Free Tier** — 5 rewrites per day, no credit card required

## How It Works

1. **Select** text on any webpage
2. **Click** the Humanify extension icon
3. **Analyze** — See an AI detection score (0-100%)
4. **Choose** your desired tone (Casual / Neutral / Formal)
5. **Humanize** — Get natural, human-sounding text in seconds
6. **Copy** — One-click copy the result

## Setup

### Prerequisites

- [Google Chrome](https://www.google.com/chrome/) (or Chromium-based browser)
- A free [Groq API key](https://console.groq.com/keys)

### Installation

1. Open Chrome and navigate to `chrome://extensions/`
2. Enable **Developer Mode** (toggle in top-right corner)
3. Click **Load unpacked**
4. Select the `Humanify` folder from this repo
5. Click the Humanify icon in the toolbar → **Settings** → paste your Groq API key

### Getting a Groq API Key

1. Visit [console.groq.com](https://console.groq.com/)
2. Sign up / log in (free)
3. Go to **API Keys** → Create a new key
4. Copy the key (starts with `gsk_`)
5. Paste it in Humanify Settings

## Technical Stack

| Layer | Technology | Description |
|-------|-----------|-------------|
| Extension | Manifest V3 | Chrome extension latest standard |
| Backend Logic | Service Worker | Background processing, API calls |
| AI Rewriting | Groq API (Llama 3.3 70B) | Free, fast LLM inference |
| AI Detection | Regex Heuristics | Pattern matching for AI-telltale text |
| UI | Vanilla HTML/CSS/JS | Zero dependencies, lightweight |

## File Structure

```
Humanify/
├── manifest.json       # Extension manifest (Manifest V3)
├── background.js       # Service Worker — API calls, detection, usage tracking
├── content.js          # Content Script — Page interaction
├── popup.html          # Extension popup UI
├── popup.js            # Popup interaction logic
├── popup.css           # Popup styling
├── icons/
│   ├── icon16.png
│   ├── icon48.png
│   └── icon128.png
└── README.md           # This file
```

## AI Detection Methodology

Humanify uses a multi-signal heuristic approach to estimate AI likelihood:

1. **Vocabulary matching** — Detects 30+ AI-overused words/phrases (e.g., "delve into", "tapestry", "furthermore")
2. **Sentence structure analysis** — Checks for AI-typical patterns (e.g., "By leveraging...", em-dash overuse)
3. **Statistical heuristics** — Analyzes sentence length variance and contraction usage
4. **Confidence scoring** — Produces a 0-100% score with confidence adjustments for short texts

> Note: This is a heuristic-based estimate, not a definitive AI detection. For critical use cases, consider dedicated AI detection services.

## Usage Limits

| Plan | Price | Daily Rewrites | Tone Adjustment | History |
|------|-------|---------------|-----------------|---------|
| Free | $0 | 5/day | Yes | No |
| Pro | $9.99/mo | Unlimited | Yes | Yes |

## Target Users

- Content writers humanizing AI drafts
- SEO professionals avoiding AI detection penalties
- Freelancers polishing AI-generated deliverables
- Students improving AI-assisted essays

## Differentiators

- **Low cost** — $9.99/mo vs competitors at $15-30/mo
- **Simple UX** — Select → Analyze → Humanize → Copy (4 clicks)
- **Fast** — Groq API delivers sub-2-second rewrites
- **Privacy** — No account required, no data collection

## Roadmap

- [x] AI detection scoring
- [x] One-click rewriting via Groq API
- [x] Tone adjustment (Casual / Neutral / Formal)
- [x] Daily usage limits (free tier)
- [ ] Pro subscription with Stripe integration
- [ ] Rewrite history with local storage
- [ ] Batch mode (rewrite multiple sections)
- [ ] Custom vocabulary/rule settings
- [ ] Support for Firefox, Edge, Safari

## Development

```bash
# Clone the repo
git clone https://github.com/ZhangNing94/humanify-chrome-extension.git

# Load in Chrome
# chrome://extensions/ → Developer Mode → Load unpacked → select Humanify/

# Set API key in extension popup → Settings
```

## License

MIT
