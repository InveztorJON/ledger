# Ledger

Money-habits coach for Nigeria. Upload a bank statement you already have; Ledger reads it on your phone, shows where your money goes, and coaches you to better habits.

- `site/` — the installable web app (works offline)
- `netlify/functions/coach.mjs` — AI coach server (uses Netlify AI Gateway; an own `ANTHROPIC_API_KEY` also works)
- `netlify/functions/sub.mjs`, `admin.mjs` — Ledger Plus subscriptions and the admin service; `site/admin.html` — admin page
- `netlify.toml` — hosting and security settings
- `LAUNCH-GUIDE.md`, `QA-REPORT.md` — launch steps and test results
- `DEVELOPING.md` — start here: where everything lives and how to keep developing
- Live: https://jonspire-ledger.netlify.app
