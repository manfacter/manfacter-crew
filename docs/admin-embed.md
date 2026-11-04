# Manfacter Crew pilot

This fork runs the original Rakazo web interface inside an authenticated host application. Upstream base: `b89cac3ae27a23c6884edae5326716b82f227a82` (Apache-2.0; see LICENSE). The host calls its existing server-side authorization and MFA checks before issuing a one-use identity assertion. There is no separate signup or password.

## Access boundary

Set `HOST_SESSION_SECRET` (at least 64 random characters) and `HOST_SESSION_ORIGIN` on the API only. The host and API share this private signing secret. The assertion expires in at most 30 seconds, binds a host user and session, and has an atomic one-use nonce in the existing Verification table. Accounts are mapped by issuer and subject, never by mailbox; host users do not become deployment administrators.

The shell at `/api/host-shell` accepts assertions only from the configured parent origin and renews the HttpOnly Crew session without reloading the embedded chat. The host renews every 30 seconds. A lease lasts at most 75 seconds, including after host logout if the close message is lost. Password, signup and independent login flows are disabled in this deployment. Opening Crew directly shows the host entry link.

`RAKAZO_EMBED_ORIGINS` allows exact HTTPS or loopback origins in CSP. Default deployments still deny embedding. The shell uses an `/api` path because the original PWA service worker excludes it from its SPA navigation fallback.

## Local deployment

Layer `infra/compose/docker-compose.admin.yml` after `docker-compose.images.yml`, with a private environment file. Build `infra/compose/Dockerfile.admin` as `manfacter/crew:local` first. Keep source mounts synchronized with the checked-out commit. The API image contains the auth integration; the web image retains the original upstream compiled interface and adds the small host shell.

This pilot uses only an internal local inference endpoint, read-only model weights, a 16K context and one concurrent inference on the constrained CPU host. No cloud inference, computer supervisor, Docker socket or host shell is exposed to agents. Public ports remain loopback-only. Credentials, runtime identities, chats and screenshots are outside Git.

Crew bots and the existing structured sales pilot are separate runtimes. The structured pilot can persist isolated native CRM records and blocked email drafts after validation. Crew does not yet have those CRM tools. Creating a bot or discussing a plan must not be represented as executing it in the CRM.

## Verification

Offline checks cover strict assertions, signatures, lifetimes and CSP ancestry. Live synthetic protocol checks cover replay, forged assertions, tenant separation, disabled signup, HttpOnly cookies and expiration during activity. A separate real-browser check verifies entry through the existing host session, bot creation and chat persistence. These checks do not establish unattended 24-hour reliability or sales-content quality.
