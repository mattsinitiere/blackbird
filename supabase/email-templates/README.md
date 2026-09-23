# Blackbird email templates

Branded versions of the Supabase Auth emails. Each one carries the same
action twice: a button with `{{ .ConfirmationURL }}` (one tap on the device
that opened the email) and the six-digit `{{ .Token }}` code (typed in on any
device at `/signup/accept` or `/reset/confirm`).

| File | Supabase template | Used by |
|---|---|---|
| `invite.html` | Invite user | `/signup` (invite-only sign-up) |
| `recovery.html` | Reset password | `/reset` |
| `confirmation.html` | Confirm signup | only if self-service sign-up is ever turned on |

## Install

Supabase dashboard → **Authentication → Email Templates**:

1. Open each template above, replace the body with the matching file, and
   set the subject:
   - Invite user: `You're invited to Blackbird`
   - Reset password: `Reset your Blackbird password`
   - Confirm signup: `Confirm your Blackbird email`
2. **Authentication → URL Configuration → Site URL** must be the production
   origin (for example `https://blackbird-darts.vercel.app`). The logo in the
   email loads from `{{ .SiteURL }}/brand/email-lockup.png`, and the "enter
   your code at" links use it too.
3. Keep the redirect URLs `…/signup/accept` and `…/reset/confirm` in the
   allow list; the button links go through them.

## Sender address and volume

By default Supabase sends from its own address and allows only a handful of
auth emails per hour, which is fine for testing and not for a league. To
send from your own domain and lift the limit: **Project Settings →
Authentication → SMTP Settings**, enable custom SMTP and paste the
credentials from a transactional email service (Resend, Postmark, SendGrid
and Amazon SES all work). Set the sender name to `Blackbird` and the address
to something on a domain you control, and add that provider's SPF and DKIM
DNS records so the emails do not land in spam.
