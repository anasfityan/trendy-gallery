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

## Client-side hardening

The approved UI remains in `index.html`. Targeted product-import/card improvements are isolated in `enhancements.js` so they can be reviewed or reverted without rewriting the main UI.

The enhancement layer validates imported image URLs, filters obvious logos/icons/tracking images, prefers structured product data (Shopify JSON and JSON-LD), stores alternate images on the same product record, uses those images in the customer card, and disables automatic background refresh while preserving the manual sync action.

The existing importer remains available as a fallback for sites that do not expose enough structured metadata.

Further work should still replace dynamic HTML interpolation of product-controlled values in `index.html` with DOM APIs or strict escaping, remove the legacy hidden iframe importer, validate synced Google Apps Script data before merging it into local state, cap user/imported field lengths, and validate numeric prices.

## Storage

Avoid storing large uploaded image Data URLs in `localStorage` as the catalog grows. IndexedDB or managed object storage is the preferred future storage path for larger catalogs.

## Service Worker policy

The Service Worker persists only same-origin application resources. Google Apps Script responses, third-party import proxy responses, remote stores, and third-party product images remain network-only and are not persisted in the application cache.

The Service Worker injects the isolated `enhancements.js` layer into HTML navigation responses so the approved monolithic UI file does not have to be rewritten for this targeted upgrade.

## Secrets

Do not commit passwords, OAuth refresh tokens, service-account private keys, API secrets, or private spreadsheet credentials to this repository. Public browser endpoints are not secrets and must be protected by server-side authorization rather than obscurity.
