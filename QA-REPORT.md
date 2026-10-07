# Ledger MVP — QA report

**Result: ready for a soft launch.** 94 of 94 automated checks pass on the built app. Five items still need a human with real phones and real statements (listed at the end) before a wide public launch.

Tested on 29 September 2026 in Chromium (desktop 1320px, phone 360–390px, light and dark), against the exact files in `site/`.

## Summary

| Suite | Result |
| --- | --- |
| App behaviour (statements, insights, habits, privacy, accessibility) | 58 of 58 |
| Installable app (install, offline, coach, legal pages, security policy) | 18 of 18 |
| AI coach server function | 18 of 18 |

## Bugs found and fixed during QA

| Bug | Impact | Fix |
| --- | --- | --- |
| Amounts written with a "+" sign (common in fintech-app statements) were misread | Income could be overstated by the balance amount | Parser now reads "+" as money in |
| On phones, upload progress and errors were hidden when uploading from Home | People would see nothing happen on a bad file | Upload switches to the Statements tab so status is always visible |
| Some small buttons were under 44px tall on phones | Harder to tap | All tap targets are at least 44px on touch screens |
| Two text colours were slightly below the 4.5:1 contrast standard in light mode | Harder to read for some people | Colours darkened |
| Privacy switches couldn't be clicked directly on the switch | Toggle only worked on its label | Fixed |
| Habit score didn't refresh after a check-in | Score looked stale until next upload | Refreshes immediately |
| "Download my data" didn't work outside Claude | Users couldn't export | Standard download in the public app |

## 1. App behaviour — 58 of 58

| Area | Passed | Checks |
| --- | --- | --- |
| Boot | 2 of 2 | First load shows sample story; Sample banner visible |
| Data | 1 of 1 | Sample balance never negative |
| Navigation | 4 of 4 | Home, Grow, Coach and Me all render |
| Consent | 2 of 2 | Consent shown before first upload; File picker opens after consent |
| Statement reading | 9 of 9 | GTBank-style PDF (remarks column last); Access-style PDF (wrapped narrations); OPay-style PDF (newest first, +/− amounts); UBA-style CSV (Withdrawals/Lodgements); Kuda-style CSV (Money In/Money out); US-format dates; wrong PDF password; password-protected PDF — each 162 of 162 transactions with totals exact to the kobo |
| Privacy | 1 of 1 | PDF password never stored |
| Errors | 3 of 3 | Scanned (image-only) PDF, corrupted file, and a non-statement text file each give a clear message |
| Performance | 2 of 2 | 5,000-transaction file read in under 4 seconds; Home draws in under 1 second |
| Duplicates | 3 of 3 | Same file twice rejected; overlapping statement adds only new rows; both statements listed |
| Security | 2 of 2 | Hostile code hidden in transaction descriptions never runs; shown as plain text |
| Tagging | 2 of 2 | Retag applies to similar transactions; tags persist |
| Check-in | 2 of 2 | XP awarded and saved; streak counts consecutive days |
| Challenges | 3 of 3 | Max three active; daily challenge completes; checklist challenge completes |
| Lessons | 2 of 2 | Wrong answer explains and offers retry; right answer completes lesson |
| Quiz | 2 of 2 | Profile saved; quiz-vs-statement insight shown |
| Badges | 1 of 1 | Earned badges displayed |
| Manual entry | 1 of 1 | Typed numbers build a money story |
| Storage | 5 of 5 | Persists when remembered; "stop remembering" clears; delete everything wipes; removing a statement removes its transactions; empty state after removal |
| Resilience | 1 of 1 | Works when browser storage is blocked (private browsing) |
| Accessibility | 5 of 5 | Every control named; decorative icons hidden from screen readers; text contrast ≥ 4.5:1 in light and dark; tap targets ≥ 44px |
| Layout | 3 of 3 | No sideways scrolling at 360px; Statements tab on phones; upload errors visible on phones |
| Export | 1 of 1 | "Download my data" produces a JSON file with all transactions |
| Console | 1 of 1 | No JavaScript errors during the whole run |

## 2. Installable app — 18 of 18

Manifest valid (name, start URL, standalone display, 192/512 and maskable icons); service worker installs and controls the page; **opens offline** after the first visit; AI coach answers through the server function; coach request contains only the summary (no transactions, merchant lines or people's names); rate-limit and offline messages are friendly; privacy and terms pages load and are linked in the app; **zero content-security-policy violations**; zero JavaScript errors.

## 3. AI coach server function — 18 of 18

Refuses when the API key is missing; rejects other websites and non-POST requests; the key only ever goes to Anthropic in a header; the education-only rules live on the server so users can't change them; answer length capped (500 tokens); default model Claude Haiku 4.5; malformed input rejected; injected "system" turns dropped; long input and long chats trimmed; 20 questions per person per hour (tested at 3); other people unaffected by one person's limit; upstream errors return a friendly message; **server logs never contain questions or numbers**.

## Still to test by hand before a wide launch

1. **Real statements from at least 5 banks** (e.g. GTBank, Access, Zenith, UBA, First Bank, plus OPay/Kuda/Moniepoint). QA used realistic copies of these layouts, but real PDFs vary. Check that the transaction count and the month totals match the statement.
2. **Excel statements (.xlsx).** The spreadsheet reader loads from a public library at runtime and couldn't be downloaded in the test environment.
3. **Real phones.** Install on a mid-range Android (Chrome) and an iPhone (Safari → Share → Add to Home Screen). Check a 20+ page PDF on a low-end Android for speed.
4. **Live AI coach answers.** QA used a stand-in for Anthropic's API. After adding your API key, ask the 5 suggested questions plus 5 awkward ones (e.g. "Which stock should I buy?", "Should I take a loan app loan?") and confirm answers stay educational.
5. **Legal review** of the privacy policy, terms and coach wording (see LAUNCH-GUIDE.md). Business details (CAC-registered, Lagos, Nigeria) are filled in.

## Ledger Plus — 5 October 2026

| Suite | Result |
| --- | --- |
| Subscription and admin server (`tests/test_subs.mjs`) | 42 of 42 |
| Full flow in a phone-sized browser (`tests/plus_test.py`) | 35 of 35 |

Covered (7 Oct plan: 2 free uploads, ₦10,000, 20 uploads per paid month, warning at 16, lock at 20, renewing a full month starts a new month now): 2 free uploads then lock (including files dropped or pasted); existing data stays viewable; sign-up needs agreement and a valid Nigerian phone; pay screen shows JONSPIRE LIMITED · UBA · 1029821937 · ₦10,000 and the person's code; receipt upload (image or PDF, checked by file type, max 3.5 MB); admin password, lockout after 10 wrong tries; AI receipt check flags wrong amount, account, date or missing reference and never logs receipt contents; approve needs a "money received" confirmation; one calendar month from approval; approving twice adds nothing; early renewal adds a month on top of remaining days; reminder banner appears 3 days before the end (not 4); cancel keeps access to the end and stops reminders; expiry locks uploads again; restore on another phone with code + phone number; no sideways scrolling at 360px; no JavaScript or security-policy errors.

Still to check by hand: one real transfer and approval on the live site, the AI check on a real bank-app receipt, and a renewal notification on a real Android phone.
