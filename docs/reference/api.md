---
title: HTTP API
description: Endpoints, authentication, request models, pagination, validation, and stable error envelopes.
---

# HTTP API

All routes share the web interface origin. Authentication uses the `print-cost-session` cookie, and write requests
require a matching `Origin`. Decimal values are JSON strings, timestamps are ISO 8601 strings, and durations are
whole seconds.

## Interactive API reference

Every running ezPrint instance serves a Scalar API reference at `/api-reference` and its OpenAPI 3.1 document at
`/api/openapi.json`. The reference uses the same Saturn theme and compact client settings as the Machine Admin API.
It lists every Nitro endpoint, groups operations by domain, describes cookie authentication, and includes request
schemas for validated write operations. The hosted AI assistant and MCP generator are disabled.

Sign in with `POST /api/auth/login` before trying protected operations. Scalar and the browser then send the
HTTP-only session cookie automatically. Write requests must remain on the instance origin. Never paste production
cookies or credentials into shared screenshots or issue reports.

The repository also includes a Bruno collection under `bruno/`. Select its `Local` environment, set the secret
`email` and `password` environment values locally, and run **Authentication → Login** first. Bruno retains the
session cookie in its cookie jar. The committed collection contains no credentials or session values.

## Endpoints

| Method and path                           | Auth     | Contract                                                              |
| ----------------------------------------- | -------- | --------------------------------------------------------------------- |
| `GET /api/health`                         | No       | `{ status, database, version }`; 503 if the database is unreadable    |
| `GET /api/auth/setup-status`              | No       | `{ initialized }`                                                     |
| `POST /api/auth/setup`                    | No       | Create the first account, settings, and optional demo data once       |
| `POST /api/auth/login`                    | No       | Validate email/password and set the session cookie                    |
| `GET /api/auth/session`                   | Optional | `{ user }` or `null`                                                  |
| `POST /api/auth/logout`                   | Yes      | Delete the current session                                            |
| `PATCH /api/auth/preferences`             | Yes      | Update `{ locale }` for the account                                   |
| `GET/PATCH /api/settings`                 | Yes      | Read or update currency, default language, and electricity price      |
| `GET/PATCH /api/settings/features`        | Yes      | Read or update print-series and spool-management feature flags        |
| `GET/POST /api/customers`                 | Yes      | Paginated list or create                                              |
| `GET/PATCH/DELETE /api/customers/:id`     | Yes      | Read, replace/archive, or safely delete                               |
| `GET/POST /api/printers`                  | Yes      | Paginated list or create                                              |
| `GET/PATCH/DELETE /api/printers/:id`      | Yes      | Read, replace/archive, or safely delete                               |
| `GET/POST /api/manufacturers`             | Yes      | Paginated list or create                                              |
| `GET/PATCH/DELETE /api/manufacturers/:id` | Yes      | Read, replace/archive, or safely delete                               |
| `GET/POST /api/components`                | Yes      | Paginated list or create with `printerIds`                            |
| `GET/PATCH/DELETE /api/components/:id`    | Yes      | Read, replace/archive, or safely delete                               |
| `GET/POST /api/filaments`                 | Yes      | Paginated list or create                                              |
| `GET/PATCH/DELETE /api/filaments/:id`     | Yes      | Read, replace/archive, or safely delete                               |
| `POST /api/prints/calculate`              | Yes      | Preview a print-draft DTO without persistence                         |
| `GET/POST /api/prints`                    | Yes      | Filtered list or create a draft                                       |
| `GET/PATCH /api/prints/:id`               | Yes      | Read or update draft data, workflow, payment, or `{ archived }`       |
| `POST /api/prints/:id/complete`           | Yes      | Compatibility action that advances a print to `DONE`                  |
| `POST /api/prints/:id/duplicate`          | Yes      | Create a current-price draft copy                                     |
| `GET /api/dashboard?period=30d`           | Yes      | KPIs, cost series, categories, and drafts for `30d`, `90d`, or `all`  |
| `GET /api/search?q=…`                     | Yes      | Grouped print and inventory results for a two-or-more-character query |
| `GET /api/version-latest`                 | Yes      | Latest GitHub Release version or `null`, cached for five minutes      |

## Lists and input models

Component lists additionally accept `type=HOTEND|BUILD_PLATE|OTHER`, `printerId`, and `alwaysUsed=true|false`; filters apply before pagination and counting.

Inventory lists accept `search`, one-based `page`, `pageSize` from 1–100, and `includeArchived=true|false`. Print
lists also accept `status=DRAFT|PRINTING|PRINTED|SHIPPED|DONE` and `customerId`. Responses contain `items`, `total`, `page`, and
`pageSize`.

Setup requires `displayName`, `email`, a password of at least 12 characters, supported `locale`, `currency`, and
`electricityPrice`. A print draft requires `name`, optional `customerId`, `printerId`, `buildPlateId`, one or more
`{ componentId, durationSeconds }` hotends, optional `otherComponentIds`, one or more
`{ filamentId, usedGrams }`, and optional `notes`.

Inventory PATCH replaces its editable DTO; `{ archived: boolean }` only changes archive state. Print PATCH also
accepts `{ status }` or `{ paid }`. Leaving `DRAFT` finalizes the cost snapshot, finalized prints cannot return to
`DRAFT`, and `{ paid: true }` records a server-generated `paidAt` timestamp while `false` clears it. Authoritative
schemas are in [`shared/schemas`](https://github.com/tobiaswaelde/ezprint/tree/main/shared/schemas).

Printer, component, and filament inputs reference shared manufacturers with `manufacturerId`. Printer and filament
references are required; component references are optional. For compatibility, printer requests may still send the
legacy `manufacturer` name, which resolves an existing active manufacturer or creates one. Component inputs also
accept `alwaysUsed`, which defaults to `false`.
Filament inputs require `material`, `colorName`, and a `colorHex` in `#RRGGBB` format; their `name` is derived from
manufacturer, material, and color name. Printer, component, and filament responses expose `manufacturerId` and the
resolved manufacturer name.

## Errors

Errors include an HTTP status and stable `data` with `code`, `messageKey`, optional `fieldErrors`, and `requestId`.
Expect 401 without a session, 403 for a foreign origin, 409 for disabled features, immutability, references, currency, or setup
conflicts, and 422 for invalid or incompatible input. API clients should branch on `code`, not parse messages.

`GET /api/settings` exposes `spoolManagementEnabled`. `PATCH /api/settings` requires the boolean alongside the
other application settings. Disabling it also disables Spoolman without clearing its URL or credential. Enabling
it creates one opening spool for every active filament without an active spool.

Print draft and calculation requests accept `quantity`, a whole number from 1 to 1,000,000, defaulting to 1. Print DTOs, previews, and snapshots expose `quantity` and canonical decimal `costPerUnit`. Material quantities and duration remain run totals.

## Outcomes and retries

`POST /api/prints/:id/outcome` requires authentication and a same-origin request. The body contains `status` (`SUCCESS` or `FAILED`), integer `durationSeconds` (0–2,147,483,647), `filaments: [{ usageId, usedGrams }]` (canonical non-negative decimal strings), optional `note`, and `failureReason` (required for failure). Every planned usage ID must occur exactly once. Only non-archived `DONE` prints accept outcomes. Identical requests are idempotent; changing a recorded outcome returns 409. Read the outcome, recording date, costs, source retry, and retries through `GET /api/prints/:id`.

`POST /api/prints/:id/retry` creates a current-price draft from a non-archived failed print, preserving quantity and customer. It never inherits an outcome. Ordinary duplication does not create a retry relationship. Print lists accept `outcome=PENDING|SUCCESS|FAILED`; pending means a `DONE` print without an outcome. Dashboard outcome metrics use the same completion period and exclude archived prints. Success rate excludes pending outcomes; variance sums actual minus planned only for recorded outcomes.

## Spool inventory

Authenticated `GET /api/spools` supports search, page, pageSize (1–100), includeArchived, filamentId, and availableOnly. The response includes stable IDs/codes, purchase metadata, exact remaining grams and unit cost. `GET /api/spools/:id` also returns a paginated movement history. `POST /api/spools` accepts code, filamentId, purchasePrice, initialNetWeightGrams, and optional purchaseLot, location, acquiredAt (ISO date). Creation adds an opening receipt atomically. `PATCH /api/spools/:id` edits metadata and price while retaining code, filament, and initial weight.

`POST /api/spools/:id/archive` takes `{ archived }`. `POST /api/spools/:id/movements` takes `{ kind: RECEIPT|CORRECTION, grams, note, operationKey }`; operationKey is a UUID reused only for identical retries. Grams use canonical decimals, up to 12 whole and six fractional digits. Corrections are signed nonzero deltas; receipts are positive. `GET /api/filaments/:id/stock` returns the active total and threshold; `PATCH` on the same route accepts `{ minimumStockGrams }`. `GET /api/spools/:id/qr` requires authentication and returns an SVG encoding the local spool route.

Draft filament lines accept `spoolId`. Older clients may omit it only when exactly one active spool can be resolved. Finalized usage DTOs preserve `spoolId` and `spoolCode`; historical usages without a spool remain null.

When spool management is disabled, draft `spoolId` values are ignored and new usages store null spool fields.
Calculations use the selected filament's catalog price and net weight. Spool and stock endpoints, Spoolman actions,
and Bambuddy tray mapping return `409 SPOOL_MANAGEMENT_DISABLED`; historical print usage remains readable.

`POST /api/prints/:id/outcome/correct` accepts the outcome fields plus a required correction note, `expectedRevision`, and a UUID `operationKey`. It appends an immutable revision, updates current result metrics, and books only consumption deltas atomically. Matching retries are idempotent; stale revisions return 409. Print DTOs expose the current revision and history containing the original plus the latest 20 corrections. The full stock ledger remains paginated on the spool detail API.

## Sales values

Drafts and calculation requests accept optional non-negative `salesValue` in the instance currency. It is frozen in the completed snapshot, and old records retain null. Print DTOs expose `financials` with sales value, planned margin, realized revenue/margin, and per-unit values. Missing sales values remain null, pending outcomes have no realized revenue, and only successful outcomes produce realized margin. Failed outcomes produce zero realized revenue when a value was supplied, with failed costs reported separately. Copy/retry flows clear sales value.

## Series, customer history, and exports

- `GET/POST /api/series`: paginated search/create; name, optional customer/target/notes, and `autoComplete`.
- `GET/PATCH /api/series/:id`: read or update; `POST .../state` accepts `{ status: "OPEN" | "COMPLETED" }`, `POST .../archive` accepts `{ archived }`, and `POST .../next-run` accepts `{ sourcePrintId }`.
- `GET /api/series/:id/history` and `GET /api/customers/:id/history`: paginated prints plus totals over the same full filtered set.
- `POST /api/prints/:id/repeat`: current-price draft with separate repeat relationship and cleared sales value.
- `GET /api/prints/export`: authenticated, no-store CSV; same filters as the print list, restricted to `DONE`, maximum 5,000 records. A larger result returns `EXPORT_TOO_LARGE`; an empty set returns the header.
- `GET /api/prints/:id/report`: authenticated, no-store persisted report DTO for a done print, including archived records; other statuses return `REPORT_NOT_ALLOWED`. `/reports/prints/:id` renders its localized A4 source view for browser PDF saving.

Print/history/export filters include `dateFrom`, `dateTo` (inclusive ISO dates, completion date or creation when no completion exists), `printerId`, `customerId`, `seriesId`, `status`, `outcome=PENDING|SUCCESS|FAILED`, `search`, and `includeArchived`. A history scope always overrides a conflicting scope query. Draft input accepts nullable `seriesId`; a series customer is inherited and conflicts are rejected. See [exports](../guide/exports) for CSV field and print behavior.

These endpoints also accept `where` as a JSON-serialized Query Kit filter. One optional `AND` or `OR` group may
contain up to 20 conditions over `status`, `outcome`, `printerId`, `customerId`, `seriesId`, `archived`, `dateFrom`,
and `dateTo`. Set filters use `in` or `notIn`; dates use `gte` or `lte`. The server validates and translates this
allowlist rather than forwarding arbitrary Prisma input. Search, legacy filters, and the route's customer or series
scope remain mandatory conditions outside the user-selected group.

## Optional integrations

All routes require authentication; mutating routes require same-origin requests. See [integration setup and limits](../guide/integrations).

- `GET /api/settings/integrations`: effective enablement, server URLs, and credential-presence flags. Secret values are never returned.
- `PATCH /api/settings/integrations`: explicit enablement and server URLs, plus optional replacement or removal of the Spoolman authorization header and Bambuddy API key. Omitted credential fields preserve the current stored value or environment default. Either integration may be enabled before its connection is complete so its dedicated settings tab can be configured; operational routes remain unconfigured until the required URL and, for Bambuddy, API key are available.

- `GET /api/integrations/spoolman`: configuration/capability/version status and the last 50 operations. `?view=preview&page=1` returns the import preview with a SHA-256 fingerprint of the validated remote data.
- `POST /api/integrations/spoolman`: discriminated `action`: `IMPORT` with `data={remoteId,previewHash,authority?,localSpoolId?}`, `SYNC` with `spoolId`, `UNLINK` with `data={spoolId,ownership:"NATIVE",openingBalance}`, or `OPERATION` with `data={operationId,action:"SEND"|"CONFIRM_APPLIED"|"CONFIRM_NOT_APPLIED"}`. Explicit linking to an existing spool requires the same already-linked filament identity. Reassigning a stable external ID is rejected.
- `GET /api/integrations/bambubuddy`: safe printer/link status; optional `printId`. `?view=logs&printerId=...&page=1` pages through the selected printer's remote logs.
- `POST /api/integrations/bambubuddy`: `LINK_PRINTER` (`printerId`, nullable `remoteId`), `SYNC_PRINTER` (`printerId`), `MAP_TRAY` (`printerId`, `slot` as `ams:tray`, nullable `spoolId`), `ATTACH` (`printId`, `remoteLogId`), `SYNC_PRINT` (`printId`), or `IMPORT` (`printId`, `previewHash`, validated `outcome`). Only confirmed terminal records may import an outcome.

Errors use `INTEGRATION_DISABLED`, `INTEGRATION_CONFIG`, `INTEGRATION_UNAVAILABLE`, `INTEGRATION_CONTRACT`, or `INTEGRATION_CONFLICT`; remote HTTP failures are classified without forwarding response bodies or connection details. Native mutations of externally owned stock return `STOCK_OWNED_EXTERNALLY`.
