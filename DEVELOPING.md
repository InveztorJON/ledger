# Developing Ledger

Ledger is a product of Jonspire Limited (RC 9187600), Lagos, Nigeria.

## Where things live

| What | Where |
| --- | --- |
| Live app | https://jonspire-ledger.netlify.app (Public) |
| Code | GitHub: `InveztorJON/ledger`, branch `main` (private) |
| Hosting | Netlify project `jonspire-ledger`, Jonspire team |
| AI coach | Netlify's built-in AI service (AI Gateway). Usage is billed to Netlify credits. No Anthropic key needed. |
| Contact email | jonspirelimited@gmail.com (terms, privacy, and `site/app.js` line 2) |

**Every push to `main` goes live automatically in about a minute.**

## Folder map

- `site/` is the app people use. **This folder is the source of truth; edit it directly.**
  - `index.html` holds the page layout, `app.js` the app logic (statement reading, insights, habits, coach), and `app.css` the styles.
  - `sw.js` is offline support. **Change `VERSION` on line 2 whenever you change app.js, app.css or index.html.** Otherwise installed apps keep the old copy.
  - `privacy.html` and `terms.html` are the legal pages. `vendor/` holds pdf.js 3.11.174.
- `netlify/functions/coach.mjs` is the AI coach server at `/api/coach`. The education-only rules live here, along with rate limits and the origin check. It never logs content.
- `netlify.toml` sets the publish folder, the functions folder and the security headers (CSP).
- `tests/` holds the test tools:
  - `node tests/test_coach.mjs netlify/functions/coach.mjs` runs the coach unit tests (18). The Anthropic API is mocked.
  - `node tests/serve.mjs site 8899` runs a local copy with a mocked coach.
  - `python tests/pwa_test.py http://127.0.0.1:8899` runs the install and offline checks. It needs Playwright.
- `reference/financial-guardian.html` is the original single-file prototype. It is reference only and no longer used to build the site.
- `LAUNCH-GUIDE.md` has the original launch steps; Steps 1–4 are done. `QA-REPORT.md` has the test results and the hand checks still to do.

## Continuing with Claude

Open a new chat and attach this folder, or give it the GitHub repo `InveztorJON/ledger`. Say what you want changed. Claude can edit, test, and push to GitHub, and Netlify then deploys the change.

## Still to do before a wide launch

1. Test real statements from at least 5 banks (GTBank, Access, Zenith, UBA, First Bank, OPay, Kuda, Moniepoint).
2. Test an Excel (.xlsx) statement.
3. Install on a real Android and a real iPhone. Try a 20+ page PDF on a low-end phone.
4. Get a lawyer to review the privacy policy, terms and coach wording (NDPA, cross-border transfer, SEC education-vs-advice).
5. Keep an eye on Netlify credit usage from the coach.

## Change log

- 29 Sep 2026: first public deploy. Coach switched to Netlify AI Gateway. Legal pages carry the Jonspire Limited CAC details and jonspirelimited@gmail.com.
