# Security notes

This application is a client-side PWA that currently syncs product data through a Google Apps Script endpoint and imports product metadata/images from third-party websites and proxy services.

## Trust boundaries

The browser must be treated as an untrusted client. URLs, product names, image URLs, Google Sheets data, and metadata returned by third-party import services are all untrusted input.

Never rely on hiding API endpoints or JavaScript values for access control. Any endpoint callable by the browser can be discovered by a user.

## Required server-side controls for Google Apps Script

The Apps Script source is not stored in this repository, so these controls must be enforced in that project:

1. Require authentication or a server-verifiable authorization token for every write operation.
2. Reject unknown actions and unsupported HTTP methods.
3. Validate the request body schema and cap request size before parsing/storing it.
4. Validate product IDs and reject duplicate/conflicting writes where appropriate.
5. Treat all strings as plain data; never evaluate supplied JavaScript/HTML/formulas.
6. Prevent spreadsheet formula injection. Values beginning with `=`, `+`, `-`, or `@` should be stored safely as text when they originate from user/imported data.
7. Rate-limit or otherwise throttle repeated writes where practical.
8. Do not return secrets, deployment credentials, spreadsheet private metadata, or stack traces to the client.
9. Restrict deployment permissions to the minimum access level required by the application.
10. Log failed and rejected write attempts without logging sensitive values.

## Client-side hardening still required in `index.html`

The main application file is intentionally not rewritten wholesale during the first hardening pass because it is a large single-file application and preserving the approved UI/behavior is a priority.

Before treating imported/synced data as trusted, the following changes should be made in a controlled refactor:

- Replace dynamic HTML interpolation of product-controlled values with DOM APIs (`textContent`, `setAttribute`) or strict escaping.
- Validate `http:`/`https:` URLs before assigning them to `src`, `href`, iframe, clipboard-open, or `window.open` flows.
- Remove the hidden cross-origin iframe importer. Same-origin policy makes it unreliable, and it increases the attack surface.
- Sanitize/validate data received from Google Apps Script before merging it into local state.
- Put maximum lengths on names, notes, colors, sizes, URLs, and imported metadata.
- Validate numeric price values rather than storing arbitrary strings.
- Avoid storing uploaded image Data URLs in `localStorage` as the catalog grows; use IndexedDB or managed object storage.

## Service Worker policy

The Service Worker must only persist same-origin static application resources. Google Apps Script responses, third-party import proxy responses, remote stores, and third-party product images remain network-only and must not be stored in the application cache.

## Secrets

Do not commit passwords, OAuth refresh tokens, service-account private keys, API secrets, or private spreadsheet credentials to this repository. Public browser endpoints are not secrets and must be protected by server-side authorization rather than obscurity.
