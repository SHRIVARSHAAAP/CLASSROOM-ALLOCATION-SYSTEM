# Activate real WhatsApp delivery

The application integration is included. Actual delivery requires your own Meta WhatsApp Business Platform configuration. No credentials belong in GitHub or chat.

1. In Supabase SQL Editor, run the contents of `db/whatsapp-integration.sql`. Run this after `db/schema.sql` and `db/live-integration.sql`. Do not run `db/test-*.sql` or the fictional demo seed on production.
2. Create/configure a Meta app with WhatsApp Cloud API, your WhatsApp Business Account and sender phone number. Follow https://developers.facebook.com/documentation/business-messaging/whatsapp/get-started .
3. Create a Utility message template named `campus_update`, language English (`en`), with exactly one body text parameter and no header/button parameters. Proposed body: `Campus notification: {{1}}. Open your campus portal to review the update.` Provide a realistic sample value, such as `Your room-change request has been approved`. Meta determines template approval and category; wait for approval. A registered production sender and usable long-lived system-user access token with WhatsApp messaging permission are needed for production. Test numbers only send to permitted test recipients.
4. In Vercel Project Settings → Environment Variables, add these for Production:
   
   | Name | Value |
   | --- | --- |
   | WHATSAPP_ACCESS_TOKEN | Your Meta system-user access token |
   | WHATSAPP_PHONE_NUMBER_ID | Sender Phone Number ID, not the phone number |
   | WHATSAPP_API_VERSION | The supported Graph API version shown in your Meta setup, including v |
   | WHATSAPP_TEMPLATE_NAME | campus_update |
   | WHATSAPP_TEMPLATE_LANGUAGE | en; use the exact language code approved by Meta |
   | WHATSAPP_APP_SECRET | Your Meta app secret |
   | WHATSAPP_VERIFY_TOKEN | A new random secret chosen by you for webhook verification |

   All these are server variables: never use a NEXT_PUBLIC prefix.
5. Supabase's existing Vercel variables must include `NEXT_PUBLIC_SUPABASE_URL`, a public publishable/anon key, and server-only `SUPABASE_SECRET_KEY` or `SUPABASE_SERVICE_ROLE_KEY`. Set `NEXT_PUBLIC_DEMO=false`, redeploy, and sign in with real Supabase Auth accounts linked to active rows in `public.users`. Demo cookies/accounts do not become real accounts.
6. Configure the Meta messages webhook callback as `https://classroom-allocation-system-tau.vercel.app/api/whatsapp/webhook`. Enter the same WHATSAPP_VERIFY_TOKEN and subscribe the app to the WhatsApp Business Account and messages webhook field. The POST callback signature is checked using WHATSAPP_APP_SECRET.
7. In the campus portal, open Notifications, enter your own WhatsApp number with country code, check consent, and Save preferences. Repeat per recipient account. Changing consent applies to future notices; queued messages are rechecked before dispatch.
8. Test an actual rep request and admin decision with real timetable data. The workflow creates in-app notices and queued WhatsApp deliveries. Each successful campus action schedules queue processing. Admin can use Notifications → Process queued messages after provider configuration or to drain a remaining queue.
9. Check notification delivery: queued = awaiting processing; sent = provider accepted, not delivery proof; delivered = verified Meta delivered/read callback; failed = provider rejection or uncertain outcome. Inspect `notification_deliveries` in Supabase for error codes and provider message IDs. Messages with an uncertain outcome are not automatically retried, avoiding duplicates. Check Meta logs before any manual recovery.

Room/class counts come from the database. Populate actual classroom capacities, sections, faculty/student accounts and timetable before launch; this migration does not fabricate campus records. The map and signed-letter format are retained.

Delivery depends on Meta account status, template approval, recipient consent, sender setup and billing/provider limits. Setting environment variables alone does not verify delivery. Never promise delivery until the recipient receives the message and the callback reports delivered.

## Implementation

Database queue claims use a transaction and SKIP LOCKED to prevent duplicate workers from claiming the same message. A claimed delivery is never automatically reclaimed after a crash or timeout. Contact settings are limited to the signed-in account. Public callbacks require HMAC verification. Missing provider configuration leaves notices queued rather than pretending they were sent. In-app decisions remain saved even if WhatsApp fails.
