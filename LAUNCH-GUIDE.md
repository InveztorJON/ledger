# Ledger — launch guide

This folder is the complete Ledger app, ready to put online. When it's live, anyone can open your link on their phone, tap **Install**, and use Ledger like an app. It works offline, and there's no app store review.

Time needed: about 45 minutes the first time. No coding.

## What's in this folder

| Item | What it is |
| --- | --- |
| `site/` | The app people use (pages, icons, offline support, privacy policy, terms) |
| `netlify/functions/coach.mjs` | The small server that runs the AI coach and keeps your API key secret |
| `netlify.toml` | Hosting settings: security rules and where things live. Netlify reads it automatically. |
| `QA-REPORT.md` | What was tested and what still needs a human check |
| `LAUNCH-GUIDE.md` | This guide |

## Accounts you need (all have free starting plans)

1. **GitHub** (github.com): stores the app's files.
2. **Netlify** (netlify.com): puts the app online with HTTPS and runs the coach server. Sign up with your GitHub account.
3. **Anthropic Console** (console.anthropic.com): gives you the API key for the AI coach. Add a small amount of credit and **set a monthly spend limit** under Billing/Limits before launch.

## Step 1 — Fill in your details (10 minutes)

Open these files in any text editor and replace everything in [square brackets]:

- `site/privacy.html` — business name and address, contact email, launch date, and the cross-border transfer line (your lawyer should confirm it).
- `site/terms.html` — business name, contact email, launch date, and the liability line (lawyer to confirm).
- `site/app.js` — line 2: put your contact email between the quotes, e.g. `window.LEDGER_CONTACT_EMAIL = 'hello@yourdomain.com';`. It appears in the app for questions and feedback.

## Step 2 — Put the files on GitHub (10 minutes)

1. On github.com, click **New repository**. Name it `ledger`. **Private** is fine. Create it.
2. On the empty repository page, click **uploading an existing file**.
3. Open this `ledger-launch` folder on your computer. Select everything inside it (`site`, `netlify`, `netlify.toml` and the other files) and drag it onto the GitHub page. Folders keep their structure.
4. Click **Commit changes**.

## Step 3 — Put it online with Netlify (10 minutes)

1. On netlify.com, choose **Add new project → Import an existing project → GitHub**, and pick the `ledger` repository.
2. Netlify reads `netlify.toml`, so leave the build settings as they are: no build command, publish directory `site`, functions directory `netlify/functions`. Click **Deploy**.
3. After a minute you'll get a link like `https://something.netlify.app`. The app is live, but the AI coach won't answer until Step 4.

## Step 4 — Switch on the AI coach (5 minutes)

1. In Anthropic Console, create an API key. Copy it; you'll only see it once.
2. In Netlify, open your project → **Project configuration → Environment variables → Add a variable**:
   - Key: `ANTHROPIC_API_KEY`
   - Value: your key
   - Make sure it's available to **Functions**.
3. Go to **Deploys → Trigger deploy → Deploy project** so the coach picks up the key.

Optional settings (same place):

| Variable | Default | What it does |
| --- | --- | --- |
| `COACH_HOURLY_LIMIT` | 20 | Questions each person can ask per hour |
| `COACH_DAILY_LIMIT` | 2000 | Safety cap on questions per day (per server instance) |
| `COACH_MODEL` | `claude-haiku-4-5-20251001` | The Claude model used. Haiku is fast and low cost. |

**Never** put the API key in any file in this folder or on GitHub. It only goes in Netlify's environment variables.

## Step 5 — Check it on real phones (10 minutes)

1. Open your link on an Android phone in Chrome. Tap **Install app** at the top, or use the browser menu → **Add to Home screen**.
2. On an iPhone, open it in Safari → **Share** → **Add to Home Screen**.
3. Upload a real statement, ask the coach a question, then switch on airplane mode and reopen Ledger. It should still open and show your story.
4. Work through "Still to test by hand" in QA-REPORT.md.

## Step 6 — Your own web address (optional)

In Netlify: **Domain management → Add a domain**. You can buy one there, or connect one you own (for example a `.ng` or `.com.ng` domain from a Nigerian registrar). HTTPS is set up automatically.

## Step 7 — Launch

- **Soft launch first:** share the link with 20–50 people you know. Ask them to try one real statement and tell you what broke or confused them.
- **Then go wider:** WhatsApp groups, X, LinkedIn. A short message works: *"I built Ledger: upload your bank statement and see exactly where your money goes. It reads it on your phone. No bank login. Free while in beta: [your link]"*

## Costs to expect

- **Hosting:** Netlify's free plan covers a small launch. Check netlify.com/pricing as you grow.
- **AI coach:** Claude Haiku 4.5 costs $1 per million input tokens and $5 per million output tokens. A typical coach question costs well under one US cent. At 20 questions a month, 1,000 active users would come to roughly $60/month. Your Anthropic spend limit is the safety net.
- **Domain (optional):** a yearly fee from your registrar.

## Before a wide public launch

- [ ] Lawyer reviews the privacy policy, terms and coach wording. In particular: NDPA consent and cross-border transfer (Netlify and Anthropic servers are outside Nigeria), whether NDPC registration applies at your user numbers, and the SEC education-vs-advice line.
- [ ] Business registered with the CAC, and its name used in privacy.html and terms.html.
- [ ] Anthropic spend limit set.
- [ ] Hand-testing items in QA-REPORT.md done.
- [ ] A way for people to reach you (the contact email in app.js).

## Updating the app later

Ask Claude for the change and it will give you updated files. On GitHub, open the file (or folder), upload the new version and commit. Netlify redeploys automatically within a minute, and installed apps update the next time people open them.

## If something goes wrong

| Problem | Fix |
| --- | --- |
| Coach says it can't answer here | `ANTHROPIC_API_KEY` is missing or wasn't picked up. Add it, then Trigger deploy. |
| Coach says too many questions | That person hit the hourly limit. Raise `COACH_HOURLY_LIMIT` if needed. |
| Coach stopped for everyone | Check your Anthropic credit and spend limit. |
| A bank's PDF isn't read | Ask the user to try that bank's Excel/CSV export, and send Claude an anonymised sample layout to add support. |
| Changes don't show up | Wait a minute and reopen the app. Installed apps update on the next open. |
