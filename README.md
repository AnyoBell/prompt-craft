# Prompt Craft

A four-module course site on using AI well for studying: academic integrity, structuring prompts, what to ask, and studying with AI. Static site plus a small privacy-respecting analytics collector.

```
site/        the course website (plain HTML, no build step) and tracker.js
collector/   Cloudflare Worker + D1 database that receives and stores events
analysis/    analyze.py, a funnel and engagement report
docs/        PRIVACY.md, what is and isn't collected
```

## 1. Publish the site (GitHub Pages)

Repo Settings > Pages > Source: GitHub Actions. Pushing to `main` deploys `site/`.

## 2. Deploy the collector (free Cloudflare tier)

```bash
cd collector
npx wrangler d1 create prompt-craft          # copy the database_id into wrangler.toml
npx wrangler d1 execute prompt-craft --remote --file=schema.sql
npx wrangler secret put EXPORT_TOKEN         # pick a long random string
npx wrangler deploy                          # prints your worker URL
```

Set `ALLOWED_ORIGIN` in `wrangler.toml` to your Pages origin (for example `https://yourname.github.io`) and redeploy.

## 3. Turn tracking on

In `site/index.html`, set the script tag's `data-endpoint` to your worker URL:

```html
<script src="tracker.js" data-endpoint="https://prompt-craft-collector.YOURNAME.workers.dev" defer></script>
```

## 4. Analyze

```bash
pip install -r analysis/requirements.txt
export PC_URL=https://prompt-craft-collector.YOURNAME.workers.dev
export PC_TOKEN=your-export-token
python analysis/analyze.py --out report.txt
```

Or run it on an exported file: `python analysis/analyze.py --file events.json`.

## What gets tracked

Page views, module opens, FAQ opens, prompt-builder use (never the text), sections reached, reserve-button clicks. See `docs/PRIVACY.md`.

## License

Code is MIT. If you want to keep the course wording and worksheets all-rights-reserved while the code stays open, say so here and add a separate content license.
