# Security policy

## Reporting a vulnerability

Do not open a public issue containing exploit steps, credentials, personal data,
or a vulnerability that has not been fixed.

Use GitHub's **Security → Report a vulnerability** flow when private vulnerability
reporting is enabled. If that option is unavailable, contact the repository owner
privately through the contact method on their GitHub profile and ask for a secure
reporting channel without including exploit details in the first message.

A useful report includes:

- the affected route, RPC, table, workflow, or commit;
- the minimum reproduction steps;
- the realistic impact and required privileges;
- whether any credential or personal data may have been exposed; and
- a safe remediation suggestion, if available.

The maintainer should acknowledge a valid private report, establish a remediation
plan, and coordinate disclosure after affected credentials are rotated and the fix
is deployed. No response-time promise is made until a staffed security contact is
published.

## Scope priorities

Reports are especially useful for:

- bypassing Supabase grants, RLS, admin checks, or moderation controls;
- accessing unpublished or private records through Data API, RPC, Realtime, or
  generated artifacts;
- leaking GitHub Actions, Supabase, Cloudflare, or deployment credentials;
- abusing write endpoints to create spam, excessive cost, or denial of service;
- stored or reflected script injection; and
- dependency or workflow changes that can execute with production secrets.

Publicly documented routes, schema names, migration history, and the Supabase
publishable/anonymous key are not secrets by themselves. Security must continue to
hold when an attacker knows all of them. A service-role key, database password,
Cloudflare API token, or other privileged credential is always secret.
