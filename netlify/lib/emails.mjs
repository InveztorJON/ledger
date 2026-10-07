// The wording of each email. Plain text, short, and never containing a bank statement or transaction.
import { PLAN } from './plan.mjs';

const naira = n => '₦' + Number(n).toLocaleString('en-NG');
const first = rec => String(rec.name || '').split(' ')[0] || 'there';
const date = iso => new Date(iso).toLocaleDateString('en-NG', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Africa/Lagos' });
const sign = '\nLedger by Jonspire Limited\nQuestions? Just reply to this email.';
const app = () => process.env.URL || 'https://jonspire-ledger.netlify.app';

export const receiptReceived = rec => ({ to: rec.email, subject: 'We got your Ledger Plus payment receipt',
  text: `Hello ${first(rec)},\n\nWe received the proof of payment for your Ledger code ${rec.id}. We check every payment against our bank account, usually within 24 hours, and Ledger unlocks by itself when it is approved. Your month starts from that moment.\n${sign}` });

export const approved = (rec, end) => ({ to: rec.email, subject: 'Ledger Plus is active',
  text: `Hello ${first(rec)},\n\nYour payment is confirmed. Ledger Plus is active until ${date(end)}, with up to ${PLAN.monthlyUploads} statement uploads this month.\n\nOpen Ledger: ${app()}\nYour code: ${rec.id}\n${sign}` });

export const rejected = (rec, reason) => ({ to: rec.email, subject: "We couldn't verify your Ledger Plus payment",
  text: `Hello ${first(rec)},\n\nWe couldn't verify your last payment receipt. ${reason}\n\nPlease check that you sent ${naira(PLAN.priceNaira)} to ${PLAN.accountName}, ${PLAN.bank} ${PLAN.accountNumber}, with ${rec.id} in the narration, then upload a clear receipt in the app.\n${sign}` });

export const renewReminder = (rec, daysLeft) => ({ to: rec.email, subject: `Ledger Plus ends in ${daysLeft} day${daysLeft === 1 ? '' : 's'}: renew or cancel`,
  text: `Hello ${first(rec)},\n\nYour Ledger Plus month ends on ${date(rec.end)}.\n\nTo renew, transfer ${naira(PLAN.priceNaira)} to ${PLAN.accountName}, ${PLAN.bank} ${PLAN.accountNumber}, with ${rec.id} in the narration, then upload the receipt in the app. Renewing early is fine: your new month starts when this one ends.\n\nIf you don't want to renew, you don't need to do anything, or you can choose "Cancel renewal" in the app. Nothing is charged automatically.\n\nOpen Ledger: ${app()}\n${sign}` });

export const usageWarn = (rec, used, limit) => ({ to: rec.email, subject: `Ledger Plus: ${used} of ${limit} uploads used`,
  text: `Hello ${first(rec)},\n\nYou have used ${used} of the ${limit} statement uploads in this Ledger Plus month. To avoid being cut off, renew for ${naira(PLAN.priceNaira)} (transfer to ${PLAN.accountName}, ${PLAN.bank} ${PLAN.accountNumber}, with ${rec.id} in the narration, then upload the receipt in the app), or cancel renewal in the app if you don't need more.\n\nOpen Ledger: ${app()}\n${sign}` });

export const usageFull = (rec, limit) => ({ to: rec.email, subject: 'Ledger Plus: all uploads used this month',
  text: `Hello ${first(rec)},\n\nYou have used all ${limit} statement uploads for this month, so new uploads are paused. Your saved data is still there. To keep uploading, renew for ${naira(PLAN.priceNaira)} (transfer to ${PLAN.accountName}, ${PLAN.bank} ${PLAN.accountNumber}, with ${rec.id} in the narration, then upload the receipt). Your new month starts as soon as the payment is approved.\n\nOpen Ledger: ${app()}\n${sign}` });

export const adminNewProof = (rec, to) => ({ to, subject: `New Ledger Plus payment to review (${rec.id})`,
  text: `${rec.name} (${rec.id}) uploaded a proof of payment. Open the admin page, run the AI check, confirm the ${naira(PLAN.priceNaira)} in the UBA account, then approve or reject.\n\n${app()}/admin.html` });
