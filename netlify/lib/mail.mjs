// Email for Ledger Plus: receipts, approvals, usage warnings and renewal reminders.
// Sends through a Gmail account using an app password (MAIL_USER and MAIL_PASS in Netlify). If those are not set, email is simply off
// and everything else keeps working. Sending never blocks or breaks a request: failures are logged without addresses or content.
// Tests set globalThis.__LEDGER_MAIL__ to a function that collects messages instead.

const EMAIL = /^[^\s@<>",;]+@[^\s@<>",;]+\.[^\s@<>",;]+$/;
export const validEmail = e => typeof e === 'string' && e.length <= 120 && EMAIL.test(e);
export const mailEnabled = () => !!(globalThis.__LEDGER_MAIL__ || (process.env.MAIL_USER && process.env.MAIL_PASS));
const oneLine = s => String(s || '').replace(/[\r\n\u0000-\u001f]+/g, ' ').trim().slice(0, 200);

let transport = null;
async function getTransport() {
  if (transport) return transport;
  const nodemailer = (await import('nodemailer')).default;
  transport = nodemailer.createTransport({ host: 'smtp.gmail.com', port: 465, secure: true, auth: { user: process.env.MAIL_USER, pass: process.env.MAIL_PASS } });
  return transport;
}

// sendMail({to, subject, text}) -> true when handed to the mail server
export async function sendMail({ to, subject, text }) {
  if (!mailEnabled() || !validEmail(to)) return false;
  const msg = { from: `Ledger by Jonspire <${process.env.MAIL_USER || 'ledger@example.com'}>`, replyTo: process.env.MAIL_REPLY_TO || process.env.MAIL_USER || undefined, to, subject: oneLine(subject), text: String(text || '') };
  try {
    if (globalThis.__LEDGER_MAIL__) { await globalThis.__LEDGER_MAIL__(msg); return true; }
    await (await getTransport()).sendMail(msg);
    return true;
  } catch (e) {
    console.error('mail failed', e && e.code || e && e.name);
    return false;
  }
}

export const adminAddress = () => process.env.ADMIN_EMAIL || process.env.MAIL_USER || '';
