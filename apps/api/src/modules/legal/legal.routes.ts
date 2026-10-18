import express, { Router, type Request, type Response } from 'express';
import rateLimit from 'express-rate-limit';
import { prisma } from '../../infrastructure/database/prisma.js';
import { logger } from '../../config/logger.js';
import { rateLimitStore } from '../../shared/middleware/rateLimitStore.js';
import { Realtime } from '../../infrastructure/realtime/realtime.js';
import { ACCOUNT_DELETION_GRACE_DAYS } from '../privacy/services/PrivacyService.js';

/**
 * Public pages Google Play (and the law) require, served by the API so they live at a stable URL:
 *   /legal/privacy          Privacy policy
 *   /legal/terms            Terms of use
 *   /legal/delete-account   How to delete your account + a request form (no app needed)
 *
 * Who runs Loveek and how to reach them comes from the environment:
 *   LEGAL_OPERATOR_NAME, LEGAL_CONTACT_EMAIL, LEGAL_ADDRESS, GRIEVANCE_OFFICER_NAME, GRIEVANCE_OFFICER_EMAIL
 * Keep these pages in step with what the app really does (see the comments on each section).
 */
export const legalRouter: Router = Router();

const UPDATED = '15 October 2026';
const env = (k: string) => (process.env[k] ?? '').trim();
export const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

function contactHtml(): string {
  const email = env('LEGAL_CONTACT_EMAIL');
  const lines = [
    `In the app: <b>Profile → Help &amp; contact us</b> (we reply in the app and send you a notification).`,
    email && `Email: <a href="mailto:${esc(email)}">${esc(email)}</a>`,
    env('LEGAL_ADDRESS') && `Post: ${esc(env('LEGAL_ADDRESS'))}`,
  ].filter(Boolean);
  const go = env('GRIEVANCE_OFFICER_NAME');
  if (go) lines.push(`Grievance Officer: ${esc(go)}${env('GRIEVANCE_OFFICER_EMAIL') ? ` — <a href="mailto:${esc(env('GRIEVANCE_OFFICER_EMAIL'))}">${esc(env('GRIEVANCE_OFFICER_EMAIL'))}</a>` : ''}. We acknowledge complaints within 24 hours and resolve them within 15 days.`);
  return `<ul>${lines.map((l) => `<li>${l}</li>`).join('')}</ul>`;
}

export function page(title: string, body: string): string {
  const operator = env('LEGAL_OPERATOR_NAME');
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)} · Loveek</title>
<style>
:root{--bg:#fff;--text:#1d1a24;--muted:#6b6577;--accent:#c026d3;--card:#f6f3fa;--border:#e7e2ee}
@media (prefers-color-scheme:dark){:root{--bg:#0b0910;--text:#f1edf7;--muted:#a49db2;--accent:#f472b6;--card:#16121f;--border:#2a2436}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--text);font:16px/1.65 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif}
main{max-width:760px;margin:0 auto;padding:32px 16px 64px}h1{font-size:30px;line-height:1.2;margin:8px 0 4px}h2{font-size:20px;margin:32px 0 8px}
.brand{font-weight:800;font-size:20px;background:linear-gradient(90deg,#ec4899,#8b5cf6);-webkit-background-clip:text;background-clip:text;color:transparent;text-decoration:none}
.muted{color:var(--muted);font-size:14px}a{color:var(--accent)}ul{padding-left:20px}li{margin:4px 0}
.box{background:var(--card);border:1px solid var(--border);border-radius:14px;padding:16px;margin:16px 0}
nav{display:flex;gap:16px;flex-wrap:wrap;margin-top:40px;font-size:14px}
input,textarea{width:100%;font:inherit;padding:10px 12px;border-radius:10px;border:1px solid var(--border);background:var(--bg);color:var(--text)}
button{margin-top:12px;font:inherit;font-weight:700;padding:10px 18px;border:0;border-radius:10px;background:#ec4899;color:#fff;cursor:pointer}
label{display:block;font-weight:600;margin-top:12px}
</style></head><body><main>
<a class="brand" href="/legal/privacy">Loveek</a>
<h1>${esc(title)}</h1><p class="muted">Last updated ${UPDATED}${operator ? ` · Loveek is run by ${esc(operator)}, India` : ''}.</p>
${body}
<nav><a href="/legal/privacy">Privacy policy</a><a href="/legal/terms">Terms of use</a><a href="/legal/delete-account">Delete your account</a></nav>
</main></body></html>`;
}

// ── Privacy policy ────────────────────────────────────────────────────────────
// Keep in step with: what the app stores (schema), AI processing (Gemini), notifications (Firebase),
// payments (Google Play), error reports (Sentry, no chat text), deletion (14-day grace), team access rules.
legalRouter.get('/privacy', (_req: Request, res: Response) => {
  res.type('html').send(
    page(
      'Privacy policy',
      `<div class="box"><b>The short version.</b> Your chats are private. We use them to let characters reply to you and
remember you — nothing else. Our team does not read your chats. We never sell your data. You can make the characters
forget you, or delete your account, at any time from the app.</div>

<h2>Who we are</h2>
<p>Loveek is an app for chatting with AI characters. The characters are not real people: every reply is written by
artificial intelligence. This policy explains what we collect, why, who we share it with and what you can do about
it, as required by India's Digital Personal Data Protection Act, 2023 and the Information Technology Rules.</p>

<h2>What we collect</h2>
<ul>
<li><b>Account:</b> your email address, a securely hashed password, the name you want characters to call you, how
characters should address you (“talk to me as”), your language and your time zone.</li>
<li><b>Your chats:</b> the messages you send and the characters' replies.</li>
<li><b>What characters remember about you:</b> short notes drawn from your chats (for example your name, your job,
an exam date, your birthday) and how close you are with each character, so they can remember you like a friend.</li>
<li><b>Reminders</b> you ask a character to give you.</li>
<li><b>Your device:</b> phone platform and app version, a notification token (so we can send you notifications) and
whether you allowed notifications.</li>
<li><b>Payments:</b> if you buy Premium, Google Play handles the payment. We receive the plan, its status and a
purchase reference — never your card or UPI details.</li>
<li><b>Use of the app:</b> which screens and features you use, to improve the app; technical logs including IP
address, for security and to stop abuse; error reports when something breaks (these never include your messages).</li>
<li><b>Safety signals:</b> if a message suggests someone may be in danger, we record that it happened (the type,
not the text) so our team can make sure the right help was offered.</li>
<li><b>Messages to our team</b> through Help &amp; contact us.</li>
</ul>

<h2>How we use it</h2>
<ul>
<li>To run your chats: generating replies, remembering what matters to you, reminders, and the occasional message
from a character (you can switch these off in Profile → Notifications).</li>
<li>To provide Premium and the daily message allowance.</li>
<li>To keep people safe: crisis support and helplines, and preventing abuse and misuse.</li>
<li>To answer you when you contact us.</li>
<li>To fix problems and improve the app, mostly from counts and trends rather than individual chats.</li>
</ul>
<p>We process your data to provide the service you signed up for, with your consent, which you can withdraw by
deleting your account.</p>

<h2>Artificial intelligence</h2>
<p>To write each reply, the text needed for it (your recent messages, relevant memories and the character's
instructions) is sent to Google's Gemini API. Google processes it on our behalf to generate the reply, the memory
notes and the search index for memories.</p>

<h2>Who we share it with</h2>
<ul>
<li><b>Google:</b> Gemini (AI replies), Firebase Cloud Messaging (notifications) and Google Play (payments).</li>
<li><b>Our hosting and infrastructure providers</b>, who store and run the service for us under contract.</li>
<li><b>Error monitoring</b> (Sentry), which receives technical details of errors, never your messages.</li>
<li><b>Authorities</b>, only when the law requires it.</li>
</ul>
<p>We do not sell your data, and we do not share it with advertisers.</p>

<h2>Who can see your chats</h2>
<p>No one at Loveek reads your chats in normal operation. A small, named part of our team can open a chat only for
a safety review — for example when a serious report is made — and every such access is logged.</p>

<h2>How long we keep it</h2>
<ul>
<li>While your account is active, we keep your data so your characters can remember you.</li>
<li>When you delete your account, everything is deleted ${ACCOUNT_DELETION_GRACE_DAYS} days later (in case you change your
mind — signing in again before then cancels it). Payment records are kept only as long as tax and accounting laws
require, without your chats.</li>
<li>Deleted data is removed from backups in their normal rotation.</li>
</ul>

<h2>Your choices and rights</h2>
<ul>
<li><b>See or correct your data:</b> your name and preferences are in Profile; ask us for anything else.</li>
<li><b>Make characters forget you:</b> Profile → Privacy &amp; account → Make characters forget me.</li>
<li><b>Get a copy of your data:</b> Profile → Help &amp; contact us → “Get a copy of my data”.</li>
<li><b>Delete your account:</b> Profile → Privacy &amp; account → Delete account, or <a href="/legal/delete-account">this page</a>.</li>
<li><b>Notifications:</b> Profile → Notifications, or your phone's settings.</li>
<li><b>Complain:</b> contact us (below). If you're not satisfied, you may approach the Data Protection Board of India.</li>
</ul>

<h2>Age</h2>
<p>Loveek is for people aged <b>12 or older</b>. People under 18 should use it with a parent's or guardian's permission. <b>Romance characters are for adults (18+) only</b>: we ask your age when you start, and people under 18 can't chat with them. If we learn that an account belongs to someone under 12, we delete it.</p>

<h2>Security</h2>
<p>Data is encrypted in transit, passwords are hashed, and access inside our team is limited and logged. No system
is perfectly secure; if a breach affects you, we will tell you and the authorities as the law requires.</p>

<h2>Changes</h2>
<p>If we change this policy in a way that matters, we'll tell you in the app before it takes effect.</p>

<h2>Contact</h2>
${contactHtml()}`,
    ),
  );
});

// ── Terms of use ──────────────────────────────────────────────────────────────
// Keep in step with: Premium pricing and trial (billing), daily limits, crisis helplines.
legalRouter.get('/terms', (_req: Request, res: Response) => {
  res.type('html').send(
    page(
      'Terms of use',
      `<p>By using Loveek you agree to these terms. Please read them — they are short.</p>

<h2>What Loveek is</h2>
<ul>
<li>Loveek lets you chat with <b>AI characters</b>. They are not real people, even when they feel like it. Their replies
are generated by artificial intelligence and can be wrong, odd or unsuitable.</li>
<li>Characters such as a doctor, coach, astrologer or mentor give <b>general conversation, not professional advice</b>.
Don't use them instead of a qualified doctor, therapist, lawyer or financial adviser.</li>
<li><b>In an emergency</b> call 112. If you're struggling or thinking of hurting yourself, call Tele-MANAS on
<b>14416</b> (free, any time). Loveek is not an emergency or crisis service.</li>
</ul>

<h2>Who can use it</h2>
<p>You must be <b>12 or older</b>; if you're under 18, a parent or guardian must agree to these terms for you. Romance characters are for adults (18+) only. One account per person; keep your password safe —
you're responsible for what happens on your account.</p>

<h2>Using Loveek well</h2>
<p>Please don't use Loveek to: break the law; harass, threaten or exploit anyone; create sexual content involving
minors (we report it); try to get instructions for serious harm; break, overload, scrape or reverse-engineer the
app; or get around limits or payments. We may limit, suspend or close accounts that do, and remove content.</p>

<h2>Your content</h2>
<p>What you write stays yours. You let us store and process it to run Loveek for you, as described in the
<a href="/legal/privacy">privacy policy</a>. The characters, their stories and the app itself belong to Loveek.</p>

<h2>Premium</h2>
<ul>
<li>Chatting with the characters needs <b>Premium</b>, a monthly subscription through Google Play. Your first day
costs ₹1 (new subscribers); unless you cancel before that day ends, it continues at the price shown in the app
(currently ₹499 a month), charged automatically each month until you cancel.</li>
<li>Messages about a crisis or an emergency always go through, with or without Premium.</li>
<li>Cancel any time in the Play Store (Payments &amp; subscriptions → Subscriptions → Loveek). Premium stays on until
the end of the period you paid for. Refunds follow Google Play's policies.</li>
<li>Premium has a fair-use daily message limit; extra message packs can be bought in the app.</li>
<li>Prices and features may change; we'll tell you before a change affects what you pay.</li>
</ul>

<h2>Availability</h2>
<p>We work to keep Loveek running, but it may sometimes be unavailable (for example during maintenance), and
features may change. Characters may be updated or retired.</p>

<h2>Ending</h2>
<p>You can delete your account at any time (Profile → Privacy &amp; account). We may suspend or close accounts that
break these terms, and will tell you why unless the law or safety prevents it.</p>

<h2>Responsibility</h2>
<p>Loveek is provided as it is. To the extent the law allows, we're not liable for indirect losses, or for decisions
you make based on what an AI character says. Nothing here limits rights you have under Indian consumer law.</p>

<h2>Law and disputes</h2>
<p>These terms are governed by the laws of India, and disputes go to the courts of India. Please contact us first —
most things can be sorted out quickly.</p>

<h2>Changes</h2>
<p>We may update these terms; we'll tell you in the app before important changes take effect.</p>

<h2>Contact</h2>
${contactHtml()}`,
    ),
  );
});

// ── Account deletion (Google Play requires a web link) ────────────────────────
const deletionForm = (notice = '') =>
  page(
    'Delete your Loveek account',
    `<p><b>Fastest way, in the app:</b> Profile → Privacy &amp; account → <b>Delete account</b>.</p>
<p>What happens: you're signed out, and ${ACCOUNT_DELETION_GRACE_DAYS} days later your account and everything in it is deleted for good —
your profile, chats, what characters remember about you, reminders and notification settings. Signing in again
before then cancels it. Payment records are kept only as long as tax law requires, without your chats.</p>
<p>Premium bought on Google Play is not cancelled automatically: cancel it in the Play Store (Payments &amp;
subscriptions → Subscriptions → Loveek).</p>
<p>Only want the characters to forget you? Profile → Privacy &amp; account → <b>Make characters forget me</b> deletes
their memories but keeps your account.</p>
<div class="box"><b>Can't open the app?</b> Ask us here. To protect your account, we'll confirm with you at the
email address of the account before deleting anything.
${notice}
<form method="post" action="/legal/delete-account">
<label for="email">Email address of your Loveek account</label>
<input id="email" name="email" type="email" required maxlength="255" autocomplete="email">
<label for="note">Anything else? (optional)</label>
<textarea id="note" name="note" rows="3" maxlength="1000"></textarea>
<button type="submit">Request deletion</button>
</form></div>`,
  );

legalRouter.get('/delete-account', (_req: Request, res: Response) => {
  res.type('html').send(deletionForm());
});

legalRouter.post(
  '/delete-account',
  express.urlencoded({ extended: false, limit: '8kb' }),
  rateLimit({ windowMs: 60 * 60_000, max: 5, store: rateLimitStore('legal-delete'), standardHeaders: true, legacyHeaders: false }),
  async (req: Request, res: Response) => {
    const email = String(req.body?.email ?? '').trim().toLowerCase().slice(0, 255);
    const note = String(req.body?.note ?? '').trim().slice(0, 1000);
    if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      try {
        const user = await prisma.user.findFirst({ where: { normalizedEmail: email, status: { not: 'DELETED' } }, select: { id: true } });
        if (user) {
          const created = await prisma.supportRequest.create({
            data: { userId: user.id, topic: 'delete_data', message: `Account deletion requested on the website (not signed in).${note ? `\n\n${note}` : ''}`.slice(0, 4000) },
            select: { id: true },
          });
          Realtime.admin({ kind: 'support', text: 'delete_data', id: created.id });
        }
      } catch (err) {
        logger.warn('Website deletion request failed', { error: err instanceof Error ? err.message : err });
      }
    }
    // Same answer whether or not the email has an account (no account lookups from the outside).
    res.type('html').send(
      deletionForm(
        `<p><b>Thanks — we've got your request.</b> If there's a Loveek account with that email, we'll write to it to confirm, then delete the account within ${ACCOUNT_DELETION_GRACE_DAYS} days.</p>`,
      ),
    );
  },
);
