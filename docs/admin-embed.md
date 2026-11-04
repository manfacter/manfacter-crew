# Manfacter Crew pilot

This fork runs the original Rakazo web interface inside an authenticated host application. Upstream base: `b89cac3ae27a23c6884edae5326716b82f227a82` (Apache-2.0; see LICENSE). The host calls its existing server-side authorization and MFA checks before issuing a one-use identity assertion. There is no separate signup or password.

## Access boundary

Set `HOST_SESSION_SECRET` (at least 64 random characters) and `HOST_SESSION_ORIGIN` on the API only. The host and API share this private signing secret. The assertion expires in at most 30 seconds, binds a host user and session, and has an atomic one-use nonce in the existing Verification table. Accounts are mapped by issuer and subject, never by mailbox; host users do not become deployment administrators.

The shell at `/api/host-shell` accepts assertions only from the configured parent origin and renews the HttpOnly Crew session without reloading the embedded chat. The host renews every 30 seconds. A repeatable hello/ready handshake handles either frame or host finishing first, including development remounts. A lease lasts at most 75 seconds, including after host logout if the close message is lost. Password, signup and independent login flows are disabled in this deployment. Opening Crew directly shows the host entry link.

`RAKAZO_EMBED_ORIGINS` allows exact HTTPS or loopback origins in CSP. Default deployments still deny embedding. The shell uses an `/api` path because the original PWA service worker excludes it from its SPA navigation fallback.

## Local deployment

Layer `infra/compose/docker-compose.admin.yml` after `docker-compose.images.yml`, with a private environment file. Build `infra/compose/Dockerfile.admin` as `manfacter/crew:local` first. Keep source mounts synchronized with the checked-out commit. The API image contains the auth integration; the web image retains the original upstream compiled interface and adds the small host shell.

This pilot uses only an internal local inference endpoint, read-only model weights, a 16K context and one concurrent inference on the constrained CPU host. No cloud inference, computer supervisor, Docker socket or host shell is exposed to agents. Public ports remain loopback-only. Credentials, runtime identities, chats and screenshots are outside Git.

For a slow local approval checker, `RAKAZO_AUTO_REVIEW_PROVIDER=local` permits a bounded `RAKAZO_AUTO_REVIEW_TIMEOUT_MS` up to 300000. Other providers retain their existing limit and the default remains 10000. This changes only the deadline; approval decisions, confidence requirements and fail-closed behavior are unchanged. The custom image rebuilds both API and worker so they use the same checker implementation.

The host application can connect its scoped CRM commands through Rakazo's existing MCP settings. The retired structured sales runtime does not drive the bots. Creating a bot or discussing a plan must not be represented as executing it in the CRM: only confirmed tool results and native records establish that.

## Verification

Offline checks cover strict assertions, signatures, lifetimes and CSP ancestry. Live synthetic protocol checks cover replay, forged assertions, tenant separation, disabled signup, HttpOnly cookies and expiration during activity. A separate real-browser check verifies entry through the existing host session, bot creation and chat persistence. These checks do not establish unattended 24-hour reliability or sales-content quality.

## Host activity

`POST /api/auth/host-activity` consumes the same strictly verified one-use host assertion and returns only `{working: boolean}`. It checks running jobs with an unexpired lease in spaces where the mapped host user is a member, excluding archived bots and deleting spaces. It creates no account or session. Expired nonce rows are removed only after signature/lifetime validation; active nonce reuse remains atomically denied. This supports an activity indicator even when the chat itself is not open.

The host shell makes its inner iframe a block and prevents outer-document overflow; the app retains its own internal scrolling. An optional private host-tool connection can use the deployment's exact `CREW_ADMIN_HOST`/`CREW_ADMIN_IP` mapping. The host tool implementation and business permissions live in the host application, not this public fork. Credentials remain in Rakazo's existing encrypted MCP storage.
