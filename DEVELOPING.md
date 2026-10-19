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
| Ledger Plus | 2 free statement uploads, then ₦6,000/month (20 uploads per paid month, warning at 80%) by transfer to JONSPIRE LIMITED · UBA · 1029821937 |
| Admin page | https://jonspire-ledger.netlify.app/admin.html (password = `ADMIN_KEY` in Netlify environment variables) |

**Every push to `main` goes live automatically in about a minute.**

## Folder map

- `site/` is the app people use. **This folder is the source of truth; edit it directly.**
  - `index.html` holds the page layout, `app.js` the app logic (statement reading, insights, habits, coach), and `app.css` the styles.
  - `sw.js` is offline support. **Change `VERSION` on line 2 whenever you change app.js, app.css or index.html.** Otherwise installed apps keep the old copy.
  - `privacy.html` and `terms.html` are the legal pages. `vendor/` holds pdf.js 3.11.174 and SheetJS 0.18.5 (Excel), both served by Ledger itself, so the security policy allows scripts from our own site only.
- `netlify/functions/sub.mjs` is the Ledger Plus service at `/api/sub/*` (start, status, proof, cancel, resume, restore).
- `netlify/functions/admin.mjs` is the admin service at `/api/admin/*` (list, proof, AI check, approve, reject). It needs `ADMIN_KEY`.
- `netlify/lib/plan.mjs` holds the plan settings (price, free uploads, monthly cap, warning level, bank account, reminder days) and the subscription rules. **If you change the price or account, change it here and in `window.LEDGER_PLAN` at the top of `site/app.js`, plus `site/terms.html`.** A test fails if the two code copies disagree.
- Subscriptions and receipts are stored in Netlify Blobs (built into Netlify, no setup). `package.json` installs `@netlify/blobs` during Netlify's deploy.
- `site/admin.html` + `site/admin.js` is your admin page.
- `netlify/lib/mail.mjs` and `emails.mjs` send Ledger Plus email through a Gmail account (receipt received, approved, rejected, 80% and 100% usage, admin alert on a new receipt). `netlify/functions/remind.mjs` runs every day at 08:00 Lagos time and emails each subscriber once when their month is 3 days from ending. Email turns on when `MAIL_USER` (the Gmail address) and `MAIL_PASS` (a Google app password) are set in Netlify environment variables; without them email is off and nothing else breaks. Optional: `ADMIN_EMAIL` (where new-receipt alerts go; defaults to `MAIL_USER`).
- `netlify/functions/coach.mjs` is the AI coach server at `/api/coach`. The education-only rules live here, along with rate limits and the origin check. It never logs content.
- `netlify.toml` sets the publish folder, the functions folder and the security headers (CSP).
- `netlify/functions/telegram.mjs` is the Telegram control bot at `/api/telegram`; `netlify/lib/telegram.mjs` holds its Telegram and GitHub helpers. `.github/workflows/telegram.yml` does the work Claude does for it, with instructions in `.github/telegram/`, and `tools/telegram_report.mjs` sends the result back. See "Telegram control bot" below.
- `tests/` holds the test tools:
  - `node tests/test_coach.mjs netlify/functions/coach.mjs` runs the coach unit tests (18). The Anthropic API is mocked.
  - `node tests/test_subs.mjs` runs the Ledger Plus server tests (66, including email) with in-memory storage.
  - `node tests/test_telegram.mjs` runs the Telegram bot tests (48) with Telegram and GitHub mocked.
  - `python tests/plus_test.py http://127.0.0.1:8899` runs the full free-trial → pay → verify → reminder → restore flow in a browser (51). Start `tests/serve.mjs` first; its admin password is `test-admin-key-123`.
  - `python tests/xlsx_test.py http://127.0.0.1:8899` checks that an Excel (.xlsx) statement is read, using the Excel reader hosted in `site/vendor/` (5 checks).
  - `node tests/serve.mjs site 8899` runs a local copy with a mocked coach.
  - `python tests/pwa_test.py http://127.0.0.1:8899` runs the install and offline checks. It needs Playwright.
- `reference/financial-guardian.html` is the single-file version used for the Claude preview. Rebuild it from `site/` with `python tools/make_viewer.py` after changing the app.
- `LAUNCH-GUIDE.md` has the original launch steps; Steps 1–4 are done. `QA-REPORT.md` has the test results and the hand checks still to do.

## Running Ledger Plus day to day

1. Open the admin page each day (or when someone messages you). **Needs review** lists receipts waiting.
2. Press **Run AI check**. It reads the amount, account, date and reference and flags anything that doesn't match.
3. Open your UBA account and confirm the ₦6,000 arrived. Receipts can be faked, so never approve on the screenshot alone.
4. Press **Approve**. The person's month starts immediately and their app unlocks. Optionally send the WhatsApp confirmation.
5. If the money isn't there, press **Reject** and choose a reason. The person sees it in the app and can upload again.
6. **Ending in 3 days** lists people whose month ends soon. They already see a "Renew or cancel" banner in the app; the WhatsApp button sends a reminder too.

Limits to know: the free-trial count lives on the phone (in local storage and a small cookie), so someone who clears all their browser data or uses a new browser gets 2 more free uploads. Closing that gap needs sign-in (for example email or phone codes), which is a bigger change. Reminders reach people by email once `MAIL_USER` and `MAIL_PASS` are set, as well as in the app (and as a phone notification if allowed). There are no SMS reminders. Email is required to subscribe; subscribers from before 7 Oct 2026 who gave no email only see in-app reminders.

## Continuing with Claude

Open a new chat and attach this folder, or give it the GitHub repo `InveztorJON/ledger`. Say what you want changed. Claude can edit, test, and push to GitHub, and Netlify then deploys the change.

## Telegram control bot

Change the website and draft social posts from Telegram, without a computer.

- **Send any message** (for example *"Make the Ledger Plus button say Start free"*). Claude makes the change on GitHub, runs the tests and sends you a preview link in 1–5 minutes. Send more messages and they are added to the same change.
- **Tap ✅ Publish** to put it live (about a minute later), or **🗑 Discard**. Nothing goes live without your tap, and a change with failing tests cannot be published.
- **/post** *your idea* drafts posts for X, LinkedIn, TikTok and YouTube. X and LinkedIn get a button that opens the app with the post filled in; TikTok and YouTube get a script plus a caption and title to paste when you upload the video. Posting is always done by you, from the Jonspire accounts on your phone.
- **/status**, **/publish**, **/discard**, **/help**.
- Only Telegram IDs in `TELEGRAM_ALLOWED_IDS` can use it. Anyone else is told it is private. Message text is never logged.
- Save Netlify credits: send several changes, then publish once. Each publish is one production deploy.

### Setting it up (once, about 20 minutes, works from a phone browser)

1. **Bot:** in Telegram, message **@BotFather**, send `/newbot`, pick a name, and copy the token. Then message **@userinfobot** and copy your numeric ID.
2. **Claude for GitHub:** you need `CLAUDE_CODE_OAUTH_TOKEN`, which uses your Claude Pro/Max plan at no extra cost. Create it once by running `claude setup-token` in a terminal where Claude Code is installed (this one step needs a computer, about 2 minutes). Alternatively, create `ANTHROPIC_API_KEY` at console.anthropic.com instead, which is billed per use.
3. **GitHub** (github.com/InveztorJON/ledger; on a phone use "Desktop site"):
   - Settings → Secrets and variables → Actions → New repository secret: `TELEGRAM_BOT_TOKEN`, and `CLAUDE_CODE_OAUTH_TOKEN` (or `ANTHROPIC_API_KEY`).
   - Settings → Actions → General → Workflow permissions → tick **Allow GitHub Actions to create and approve pull requests** → Save.
   - Your profile → Settings → Developer settings → Personal access tokens → **Fine-grained tokens** → Generate: Repository access *Only select repositories* → `InveztorJON/ledger`; Permissions → Repository → **Contents: Read and write**, **Pull requests: Read and write**. Copy it.
4. **Netlify** (Project configuration → Environment variables): add `TELEGRAM_BOT_TOKEN`, `TELEGRAM_ALLOWED_IDS` (your ID from step 1) and `LEDGER_GITHUB_TOKEN` (the GitHub token from step 3). Then Deploys → Trigger deploy (or merge a change, which deploys anyway).
5. Open the admin page, sign in and tap **Connect Telegram bot**. Then send your bot `/help`.

If a request fails, the bot sends a link to the GitHub run. If GitHub tokens expire, make a new one and update `LEDGER_GITHUB_TOKEN`.

## Still to do before a wide launch

1. Test real statements from at least 5 banks (GTBank, Access, Zenith, UBA, First Bank, OPay, Kuda, Moniepoint).
2. Test an Excel (.xlsx) statement.
3. Install on a real Android and a real iPhone. Try a 20+ page PDF on a low-end phone.
4. Get a lawyer to review the privacy policy, terms and coach wording (NDPA, cross-border transfer, SEC education-vs-advice), including the new Ledger Plus terms and refund wording.
5. Keep an eye on Netlify credit usage from the coach.

## Change log

- 19 Oct 2026: Telegram control bot. Change the site and draft social posts (X, LinkedIn, TikTok, YouTube) from Telegram; every change is previewed and published only on your tap. Admin page has a "Connect Telegram bot" button.

- 14 Oct 2026: Price cut. Ledger Plus is now ₦6,000/month (was ₦10,000). Same plan otherwise: 2 free uploads, 20 uploads per paid month, warning at 16. Existing subscribers keep their current paid month; renewals are ₦6,000.
- 7 Oct 2026 (email): Email for Ledger Plus via Gmail (receipts, approval, rejection, 80% and 100% usage, daily 3-day renewal reminder, admin alert). Email now required to subscribe. Privacy and terms updated.
- 7 Oct 2026 (later): Security headers tightened (no outside script or connection sources; added COOP, CORP, upgrade-insecure-requests, HSTS subdomains). Excel reader now self-hosted. Offline paid uploads are queued and sent when back online. Free-trial count also kept in a first-party cookie.
- 7 Oct 2026: Plan change. 2 free uploads (was 5), ₦10,000/month (was ₦1,500), each paid month capped at 20 statement uploads counted on the server, renew-or-cancel prompt at 80% (16 of 20) and at 20 of 20. Renewing a full month starts the new month immediately. Existing ₦1,500 subscribers keep their paid month; renewals cost ₦10,000. Terms and privacy updated.
- 5 Oct 2026: Ledger Plus. 5 free uploads, ₦1,500/month by bank transfer, proof-of-payment upload, admin verification with AI receipt check, one-month periods, renew/cancel reminder 3 days before the end, restore on another phone. Privacy and terms updated.
- 29 Sep 2026: first public deploy. Coach switched to Netlify AI Gateway. Legal pages carry the Jonspire Limited CAC details and jonspirelimited@gmail.com.
