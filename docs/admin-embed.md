# Manfacter Crew pilot

This fork runs the original Rakazo web interface inside an authenticated host application. Upstream base: `b89cac3ae27a23c6884edae5326716b82f227a82` (Apache-2.0; see LICENSE). The host calls its existing server-side authorization and MFA checks before issuing a one-use identity assertion. There is no separate signup or password.

## Access boundary

Set `HOST_SESSION_SECRET` (at least 64 random characters) and `HOST_SESSION_ORIGIN` on the API only. The host and API share this private signing secret. The assertion expires in at most 30 seconds, binds a host user and session, and has an atomic one-use nonce in the existing Verification table. Accounts are mapped by issuer and subject, never by mailbox; host users do not become deployment administrators.

The shell at `/api/host-shell` accepts assertions only from the configured parent origin and renews the HttpOnly Crew session without reloading the embedded chat. The host renews every 30 seconds. A repeatable hello/ready handshake handles either frame or host finishing first, including development remounts. A lease lasts at most 75 seconds, including after host logout if the close message is lost. Password, signup and independent login flows are disabled in this deployment. Opening Crew directly shows the host entry link.

`RAKAZO_EMBED_ORIGINS` allows exact HTTPS or loopback origins in CSP. Default deployments still deny embedding. The shell uses an `/api` path because the original PWA service worker excludes it from its SPA navigation fallback.

## Local deployment

Layer `infra/compose/docker-compose.admin.yml` after `docker-compose.images.yml`, with a private environment file. Build `infra/compose/Dockerfile.admin` as `manfacter/crew:local` first. Keep source mounts synchronized with the checked-out commit. The API image contains the auth integration; the web image rebuilds the maintained Crew interface and adds the host shell.

This pilot uses only an internal local inference endpoint, read-only model weights, an explicitly configured context window and one concurrent inference. The inference container uses an NVIDIA GPU through native Docker CDI and CUDA 12; install the official NVIDIA Container Toolkit base package and verify `nvidia-ctk cdi list` before starting it. No Docker daemon restart is needed for native CDI. No cloud inference, computer supervisor, Docker socket or host shell is exposed to agents. Public ports remain loopback-only. Credentials, runtime identities, chats and screenshots are outside Git. Keep active model weights on fast local storage; the private model-root setting can point to a verified SSD copy while the source weights are retained. On Windows with WSL, put active weights in the native Linux filesystem backed by the SSD: Windows shared mounts can remain slow even on an SSD. GPU detection alone does not qualify a model: measure actual inference and confirmed tool effects.

For a slow local approval checker, `RAKAZO_AUTO_REVIEW_PROVIDER=local` permits a bounded `RAKAZO_AUTO_REVIEW_TIMEOUT_MS` up to 300000. Other providers retain their existing limit and the default remains 10000. This changes only the deadline; approval decisions, confidence requirements and fail-closed behavior are unchanged. The custom image rebuilds both API and worker so they use the same checker implementation.

The host application can connect its scoped CRM commands through Rakazo's existing MCP settings. The retired structured sales runtime does not drive the bots. Creating a bot or discussing a plan must not be represented as executing it in the CRM: only confirmed tool results and native records establish that.

Small granted tool sets use the existing direct-tool limit instead of requiring discovery wrappers. This makes team messaging and handoffs directly callable while retaining the same executor, approvals and sequential execution. Larger catalogs keep the original lazy discovery behavior; this does not grant additional tools.

Core team setup, archival, roster and peer-delivery tools also stay directly callable in larger catalogs. They retain sequential execution through the same gateway. Large routine schemas and unrelated advanced tools remain deferred, and the normal permission filters still decide which tools a run receives.

Slow local servers can explicitly set `MODEL_STREAM_TIMEOUT_MS` and `MODEL_STREAM_IDLE_TIMEOUT_MS` up to 1200000 milliseconds. The local transport applies these bounds to its dispatcher as well as the runtime: buffered tool-call JSON can take longer than Node's default five-minute wait. Defaults, connection limits and other providers keep their previous bounds. Cancellation still aborts the request and closes its dispatcher. Update both API and worker images, since interactive turns can execute in the API.

## Verification

Internal team handoffs and bot messages record their originating run on the task. New-site approval can recover the original owner's message through a bounded chain within the same owner and space. Peer prompts, external conversations and cross-owner connections never supply owner authorization. Legacy tasks without this provenance continue to ask; explicit approval rules and existing permission checks still apply.

Offline checks cover strict assertions, signatures, lifetimes and CSP ancestry. Live synthetic protocol checks cover replay, forged assertions, tenant separation, disabled signup, HttpOnly cookies and expiration during activity. A separate real-browser check verifies entry through the existing host session, bot creation and chat persistence. These checks do not establish unattended 24-hour reliability or sales-content quality.

## Host activity

`POST /api/auth/host-activity` consumes the same strictly verified one-use host assertion and returns only `{working: boolean, needsInput: boolean}`. It checks running jobs with an unexpired lease in spaces where the mapped host user is a member, excluding archived bots and deleting spaces. It creates no account or session. Expired nonce rows are removed only after signature/lifetime validation; active nonce reuse remains atomically denied. Waiting-input runs also count as pending questions. Questions take visual priority over active work; the host can keep the indicator current even when the chat itself is not open.

The host shell makes its inner iframe a block and prevents outer-document overflow; the app retains its own internal scrolling. An optional private host-tool connection can use the deployment's exact `CREW_ADMIN_HOST`/`CREW_ADMIN_IP` mapping. The host tool implementation and business permissions live in the host application, not this public fork. Credentials remain in Rakazo's existing encrypted MCP storage.

## Crew identity and coordinator

The web interface uses the maintained fork identity and no star-promotion banner. Internal package and protocol identifiers remain compatible with upstream. The first coordinator keeps its stable onboarding identity, receives a localized name and greeting from the account language, and coordinates teams through the existing fleet tools. Existing custom names and instructions are preserved. Language context applies to later turns as well; incidental names, links, quotes and short acknowledgements do not request a language change. Native fleet approval requirements remain in effect.
