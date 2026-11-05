# Manfacter Crew

Internal team workspace for Manfacter Admin, maintained as an independent fork of the upstream agent platform. Users organize persistent bots and delegate daily work through their team coordinator using ordinary conversation.

## Admin integration

- Access uses the verified Admin session; no separate Crew registration.
- The embedded workspace fills its available area, with conversations and processing details inside each chat.
- The coordinator follows the selected interface language. A clear user message in another language can change the conversation language.
- Admin shows ongoing work and questions even when the user is on another page.
- The current sales integration is restricted to isolated TEST records, internal tasks and email drafts. Sending and calling are blocked.
- Model inference runs locally. Computers and additional integrations remain optional and permission controlled.

Deployment and verification: [Admin integration](docs/admin-embed.md). The existing engine documentation under [docs](docs/) describes upstream capabilities; it does not establish which features or permissions are enabled in this deployment.

## Development

Use the pinned workspace dependencies and the existing package scripts. Keep private configuration, credentials, customer data and local verification evidence out of this public repository.

## License and provenance

Derived from [elie222/rakazo](https://github.com/elie222/rakazo), under the [Apache 2.0 license](LICENSE). Upstream attribution and internal package/protocol identifiers are retained for compatibility. Manfacter Crew is the identity of this maintained fork; it does not require an upstream hosted account.
