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
| Ledger Plus | 2 free statement uploads, then ₦10,000/month (20 uploads per paid month, warning at 80%) by transfer to JONSPIRE LIMITED · UBA · 1029821937 |
| Admin page | https://jonspire-ledger.netlify.app/admin.html (password = `ADMIN_KEY` in Netlify environment variables) |

**Every push to `main` goes live automatically in about a minute.**

## Folder map

- `site/` is the app people use. **This folder is the source of truth; edit it directly.**
  - `index.html` holds the page layout, `app.js` the app logic (statement reading, insights, habits, coach), and `app.css` the styles.
  - `sw.js` is offline support. **Change `VERSION` on line 2 whenever you change app.js, app.css or index.html.** Otherwise installed apps keep the old copy.
  - `privacy.html` and `terms.html` are the legal pages. `vendor/` holds pdf.js 3.11.174.
- `netlify/functions/sub.mjs` is the Ledger Plus service at `/api/sub/*` (start, status, proof, cancel, resume, restore).
- `netlify/functions/admin.mjs` is the admin service at `/api/admin/*` (list, proof, AI check, approve, reject). It needs `ADMIN_KEY`.
- `netlify/lib/plan.mjs` holds the plan settings (price, free uploads, monthly cap, warning level, bank account, reminder days) and the subscription rules. **If you change the price or account, change it here and in `window.LEDGER_PLAN` at the top of `site/app.js`, plus `site/terms.html`.** A test fails if the two code copies disagree.
- Subscriptions and receipts are stored in Netlify Blobs (built into Netlify, no setup). `package.json` installs `@netlify/blobs` during Netlify's deploy.
- `site/admin.html` + `site/admin.js` is your admin page.
- `netlify/functions/coach.mjs` is the AI coach server at `/api/coach`. The education-only rules live here, along with rate limits and the origin check. It never logs content.
- `netlify.toml` sets the publish folder, the functions folder and the security headers (CSP).
- `tests/` holds the test tools:
  - `node tests/test_coach.mjs netlify/functions/coach.mjs` runs the coach unit tests (18). The Anthropic API is mocked.
  - `node tests/test_subs.mjs` runs the Ledger Plus server tests (51) with in-memory storage.
  - `python tests/plus_test.py http://127.0.0.1:8899` runs the full free-trial → pay → verify → reminder → restore flow in a browser (47). Start `tests/serve.mjs` first; its admin password is `test-admin-key-123`.
  - `node tests/serve.mjs site 8899` runs a local copy with a mocked coach.
  - `python tests/pwa_test.py http://127.0.0.1:8899` runs the install and offline checks. It needs Playwright.
- `reference/financial-guardian.html` is the single-file version used for the Claude preview. Rebuild it from `site/` with `python tools/make_viewer.py` after changing the app.
- `LAUNCH-GUIDE.md` has the original launch steps; Steps 1–4 are done. `QA-REPORT.md` has the test results and the hand checks still to do.

## Running Ledger Plus day to day

1. Open the admin page each day (or when someone messages you). **Needs review** lists receipts waiting.
2. Press **Run AI check**. It reads the amount, account, date and reference and flags anything that doesn't match.
3. Open your UBA account and confirm the ₦10,000 arrived. Receipts can be faked, so never approve on the screenshot alone.
4. Press **Approve**. The person's month starts immediately and their app unlocks. Optionally send the WhatsApp confirmation.
5. If the money isn't there, press **Reject** and choose a reason. The person sees it in the app and can upload again.
6. **Ending in 3 days** lists people whose month ends soon. They already see a "Renew or cancel" banner in the app; the WhatsApp button sends a reminder too.

Limits to know: the free-trial count lives on the phone, so someone who clears their browser data or uses a new browser gets 2 more free uploads. Closing that gap needs sign-in (for example email or phone codes), which is a bigger change. Reminders reach people when they open the app (and as a phone notification if they allowed it); email or SMS reminders need an email/SMS provider.

## Continuing with Claude

Open a new chat and attach this folder, or give it the GitHub repo `InveztorJON/ledger`. Say what you want changed. Claude can edit, test, and push to GitHub, and Netlify then deploys the change.

## Still to do before a wide launch

1. Test real statements from at least 5 banks (GTBank, Access, Zenith, UBA, First Bank, OPay, Kuda, Moniepoint).
2. Test an Excel (.xlsx) statement.
3. Install on a real Android and a real iPhone. Try a 20+ page PDF on a low-end phone.
4. Get a lawyer to review the privacy policy, terms and coach wording (NDPA, cross-border transfer, SEC education-vs-advice), including the new Ledger Plus terms and refund wording.
5. Keep an eye on Netlify credit usage from the coach.

## Change log

- 7 Oct 2026: Plan change. 2 free uploads (was 5), ₦10,000/month (was ₦1,500), each paid month capped at 20 statement uploads counted on the server, renew-or-cancel prompt at 80% (16 of 20) and at 20 of 20. Renewing a full month starts the new month immediately. Existing ₦1,500 subscribers keep their paid month; renewals cost ₦10,000. Terms and privacy updated.
- 5 Oct 2026: Ledger Plus. 5 free uploads, ₦1,500/month by bank transfer, proof-of-payment upload, admin verification with AI receipt check, one-month periods, renew/cancel reminder 3 days before the end, restore on another phone. Privacy and terms updated.
- 29 Sep 2026: first public deploy. Coach switched to Netlify AI Gateway. Legal pages carry the Jonspire Limited CAC details and jonspirelimited@gmail.com.
