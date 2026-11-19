# MSG91 Email OTP setup (production activation intentionally deferred)

The customer-auth backend is prepared to send email OTPs through MSG91's Email API using the pre-approved `global_otp` template.

## Current safety state

- `MSG91_EMAIL_ENABLED=false` is the default in `.env.example`.
- When disabled, the backend rejects email delivery before making any network request.
- No MSG91 auth key, sender domain, sender address, or other secret belongs in GitHub.
- Do not enable delivery or use the MSG91-provided shared mailer domain for SARINE production.
- No real email has been sent by the automated tests; they mock the HTTP response.

## Required account setup (after SARINE owns its domain)

1. Add a dedicated sending subdomain to MSG91, for example `mail.<your-domain>`.
2. Publish the exact DNS records MSG91 provides and wait until the domain is verified.
3. Confirm the `global_otp` template remains approved and includes exactly `company_name` and `otp`.
4. Choose a sender address on that verified subdomain, for example `no-reply@mail.<your-domain>`.
5. Keep the Free plan's allowance and postpaid/overage behavior in mind.

## Hostinger environment variables (only after domain verification)

Set these privately in the active Hostinger backend environment:

- `MSG91_EMAIL_ENABLED=true`
- `MSG91_EMAIL_AUTH_KEY` — MSG91 account auth key
- `MSG91_EMAIL_DOMAIN` — the verified sending domain, without protocol or email prefix
- `MSG91_EMAIL_FROM` — sender address on exactly that domain
- `MSG91_EMAIL_FROM_NAME=SARINE`
- `MSG91_EMAIL_TEMPLATE_ID=global_otp`

The code checks that the sender address domain exactly matches `MSG91_EMAIL_DOMAIN`. Keep `MSG91_EMAIL_ENABLED=false` until DNS verification and an explicit decision to enable delivery.

## API contract

The backend calls `POST https://control.msg91.com/api/v5/email/send` with the `authkey` header and the MSG91 template payload. It supplies `company_name: SARINE` and the OTP generated and HMAC-protected by the SARINE backend. MSG91 is only the delivery provider; OTP generation, expiry, attempts, resend policy, and verification remain server-side.

Reference: https://docs.msg91.com/en/email/send-email

## Testing

The provider adapter tests mock `fetch` and verify:
- Disabled-by-default behavior performs no provider request.
- The approved template ID and exact variables are sent.
- The sender address cannot be configured outside the declared verified domain.
- No actual email is sent during tests.

Phone OTP delivery remains a separate provider decision; this change does not switch SMS to MSG91.
