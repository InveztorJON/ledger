// Daily reminder job (08:00 Lagos time). Emails each active subscriber once when their month is 3 days from ending.
// Usage warnings (80%, 100%) are sent at the moment they happen, from sub.mjs.
import { publicView } from '../lib/plan.mjs';
import { stores } from '../lib/store.mjs';
import { sendMail, mailEnabled } from '../lib/mail.mjs';
import * as mail from '../lib/emails.mjs';

export async function runReminders(now = Date.now()) {
  if (!mailEnabled()) return { skipped: 'email is not set up', sent: 0 };
  const st = await stores();
  let sent = 0, checked = 0;
  for (const id of await st.listSubIds()) {
    const rec = await st.getSub(id);
    if (!rec || !rec.email) continue;
    checked++;
    const v = publicView(rec, now);
    if (!v.renewDue || (rec.mail && rec.mail.renewFor === rec.end)) continue;   // not due yet, or already reminded for this month
    if (await sendMail(mail.renewReminder(rec, v.daysLeft))) {
      rec.mail = { ...(rec.mail || {}), renewFor: rec.end };
      await st.putSub(rec);
      sent++;
    }
  }
  return { checked, sent };
}

export default async () => {
  const r = await runReminders();
  console.log('reminders', JSON.stringify(r));
  return new Response(JSON.stringify(r), { headers: { 'content-type': 'application/json' } });
};
export const config = { schedule: '0 7 * * *' };   // 07:00 UTC = 08:00 in Lagos
