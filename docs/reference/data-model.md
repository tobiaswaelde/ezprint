---
title: Data model
description: Prisma models, relationships, archiving, decimal serialization, and immutable print snapshots.
---

# Data model

`User` owns `Session` records; `AppSettings` is the singleton with ID `1`. `Customer`, `Printer`, `Manufacturer`,
`Component`, and `Filament` are inventory records. Printers and filaments obligatorily reference a shared
`Manufacturer`; components reference one optionally. `PrinterComponent` represents printer/component compatibility.
Filaments store a required descriptive color name and `#RRGGBB` value; their display name is derived from the
manufacturer, material, and color name.
The `Component.alwaysUsed` flag controls compatible defaults in new print forms without making those selections
mandatory.

`AppSettings` stores the instance-wide `printSeriesEnabled` and `spoolManagementEnabled` feature flags. Both
default to true, and disabling them preserves existing series, spool, usage, and snapshot records. The spool flag
controls new spool selection, stock writes, and filament pricing behavior. `AppSettings` also stores explicit
Spoolman and Bambuddy enablement, server URLs, and server-only credentials. Nullable values preserve
environment-variable defaults for deployments upgraded from earlier versions. Credentials are never serialized
in settings or integration responses; database files and backups still require secret-level protection.

A `PrintJob` owns ordered `PrintPart` records and an optional customer. Each part references one printer and
component and filament usage rows. The parent printer reference remains the first-part compatibility field. Its workflow
status is one of `DRAFT`, `PRINTING`, `PRINTED`, `SHIPPED`, or `DONE`; payment is tracked independently with the
nullable `paidAt` timestamp. Usage rows copy
names, prices, lifetimes, quantities, and line costs at calculation time. `PrintCostSnapshot` also retains totals,
electricity price, printer inputs, currency, and formula version. A `DRAFT` may be recalculated; leaving Draft
finalizes the snapshot and makes print inputs immutable through the service contract.

`PrintFilamentUsage.spoolId` and `spoolCode` remain nullable. With spool management disabled, new usages copy the
filament catalog price and net weight without a spool relation or stock movement. Re-enabling inventory does not
retroactively attach those usages or reinterpret their snapshots. `PrintOutcome.stockTracked` prevents later
corrections from partially booking an outcome whose stock history was intentionally skipped while management was
disabled.

Archiving sets `archivedAt`, hiding records from new selections while preserving historical prints. Restrictive
relations and service checks prevent deletion of referenced data, including manufacturers used by printers,
components, or filaments; join rows and sessions may cascade with owners.

Money and quantities use Prisma `Decimal` and canonical JSON strings such as `"1.782175"`. Duration and power are
integer seconds and watts. The authoritative model is
[`prisma/schema.prisma`](https://github.com/tobiaswaelde/ezprint/blob/main/prisma/schema.prisma).

Print jobs and snapshots store `quantity` (default 1). New snapshots persist `costPerUnit`. Legacy snapshots retain their monetary fields unchanged; a missing unit cost is read as their original total for quantity 1.

Each optional `PrintOutcome` has a unique print reference, status, duration, reason, note, recording timestamp, and immutable input/cost JSON snapshots. JSON stores decimal values as strings to retain exact precision in SQLite. An outcome is separate from the existing `DRAFT → PRINTING → PRINTED → SHIPPED → DONE` workflow; it can be recorded once the job is Done. `PrintJob.retryOfId` links retry drafts to their failed source without altering its snapshot.

`Spool` belongs to a filament and retains a unique stable code. `StockMovement` is append-only, contains exact decimal-string grams, and has a unique operation key; print consumption references its immutable filament usage. `PrintOutcomeCorrection` retains successive input and cost snapshots with a unique outcome/revision pair and operation key. Current outcome metadata drives filters while prior financial JSON snapshots remain unchanged. `PrintCostSnapshot.calculationJson` retains exact version 3 values; earlier versions keep their original monetary columns.

`PrintJob.salesValue` and `PrintCostSnapshot.salesValue` store nullable canonical decimal strings. Null represents missing revenue input; zero is explicit. Completed sales input never changes after settings or inventory edits. Outcome corrections update realized comparisons without rewriting the frozen sales input.

`PrintSeries` groups optional customer/target/notes, completion policy, and archival. `PrintJob.seriesId` preserves membership and `repeatOfId` distinguishes repeat orders from retry relationships. Progress derives from non-archived successful Done outcomes and is refreshed transactionally after result, correction, workflow, and archive changes.

Spoolman links retain unique nullable external IDs on manufacturers, filaments, and spools. A spool stores one `stockAuthority`, nullable remote balance, remote state, last successful sync, and safe error code. Native balances remain append-only ledger sums; linked balances remain remote mirrors. `SpoolSyncOperation` uniquely identifies each outcome usage/correction and records pending, applied, failed, or uncertain dispatch state. No remote call occurs inside the outcome transaction.

Printers retain a unique nullable Bambuddy ID and sanitized cached status. `BambuTrayMapping` has one explicit spool per printer/slot. `BambuPrintLink` uniquely binds one remote print-log ID to one local print and stores validated cached data plus confirmed import metadata. Imported outcome metadata is persisted in the same transaction as its outcome and native stock deduction. Completed calculations do not depend on either remote service.

`PrintPart` has a stable ID, unique position within its parent, machine duration, and frozen `snapshotJson`.
Usage rows reference both their parent print and part. New planned snapshots use version `4`, including part IDs
on breakdown lines so repeated component/spool sources remain distinct. Parent totals aggregate all parts.
The parts migration creates one part per existing print and preserves usage IDs, old snapshot versions, costs,
outcomes, and Bambuddy links. A migrated part with no `snapshotJson` reads the unchanged parent snapshot.
Multipart actuals store per-part durations in the outcome input JSON and use `actual-2` cost snapshots.
