# ezPrint

## 0.8.7

### Patch Changes

- 87f5fa9: make data selection fields searchable

## 0.8.6

### Patch Changes

- e0cdd3d: remove padding from toolbars

## 0.8.5

### Patch Changes

- cb93ec8: update download-csv button

## 0.8.4

### Patch Changes

- 9f7bbcd: Harden installable PWA support with complete icons, an offline application shell, and controlled update prompts.

## 0.8.3

### Patch Changes

- e760fa3: Bundle all application icons locally so the interface no longer loads icons from an external CDN at runtime.

## 0.8.2

### Patch Changes

- ecd6d9d: Add direct customer-detail editing and a shared Query Kit-filtered print history table.
- 92851b8: Display derived filament names as a form summary instead of a disabled input.
- 175fb31: Harden backup restore staging and status reads against filesystem races.

## 0.8.1

### Patch Changes

- c852750: Allow first-run setup to optionally create feature-aware synthetic demo data.

## 0.8.0

### Minor Changes

- 68a61ae: Allow customers and their assigned prints to be excluded from dashboard reporting.
- 580c43b: Add portable, logically versioned backup downloads and password-confirmed restores under Settings.

## 0.7.0

### Minor Changes

- 4496e81: Allow print series and spool management to be enabled or disabled during first-run setup.

### Patch Changes

- 10fe693: Fix loading configured printers from Bambuddy for printer linking.
- 10fe693: Improve the dashboard cost-category labels in dark mode.
- 4496e81: Order inventory navigation by manufacturers, printers, components, filaments, and spools.
- 4496e81: Show explanatory print form text below its corresponding input.
- 591d819: Show feature information alerts with a subtle style and an information icon.
- 4496e81: Use the list-check icon consistently for print series.

## 0.6.0

### Minor Changes

- 0a43e49: Replace free-text printer manufacturers with required, localized selections from the complete shared manufacturer inventory while retaining legacy API compatibility.
- e1b5f8e: Add an interactive Scalar API reference, OpenAPI 3.1 metadata for all endpoints, and a credential-free Bruno collection.
- d169cc9: Add a Features settings tab for print series and move the optional spool-management control there.
- 5846e80: Allow instances to disable physical spool selection and stock management while retaining historical inventory.
- 66db51e: Add filtered, bounded CSV exports and localized printable A4 cost reports with browser PDF saving.
- 66db51e: Record immutable actual print outcomes and costs, filter results, and create linked retry drafts.
- 66db51e: Add print quantities and immutable per-unit costs while preserving historical run totals.
- 66db51e: Add optional frozen sales values and planned/realized margins, including per-unit values and dashboard totals.
- 66db51e: Add print series with successful-quantity progress, filtered customer histories, and linked repeat orders at current prices.
- 66db51e: Add physical spool inventory, append-only stock movements, low-stock alerts, QR labels, spool pricing, and versioned actual-usage corrections. Preserve exact calculation snapshots as decimal strings.
- 66db51e: Add optional Spoolman stock ownership and Bambuddy print-log integrations with cached metadata, reviewed imports, and durable consumption reconciliation.

### Patch Changes

- f6ebcae: Show an icon for every item in list and detail breadcrumbs.
- 638c354: Move Spoolman and Bambuddy activation, configuration, and operational tools into Settings.
- f6ebcae: Combine optional features in one list and reveal dedicated Spoolman and Bambuddy settings tabs when enabled.
- e9a9ea8: Align spool and print-series lists and detail views with the application table, toolbar, modal, status, and summary patterns.
- 91a79f8: Hide Scalar's Ask AI and Generate MCP actions from the API reference.
- 4354664: Organize General, Calculation, and Integrations settings in linked dashboard tabs.
- f6ebcae: Stack full-width, labeled GitHub and documentation links above a centered version control in the sidebar footer.

## 0.5.0

### Minor Changes

- 50917a8: Improve the mobile layout and add installable PWA support.

## 0.4.0

### Minor Changes

- e91c0f5: Add selectable Day.js date, time, and duration display formats.
- e91c0f5: Add structured filament colors, color avatars, and the keyboard shortcut overview.
- e91c0f5: Add the full print workflow and track payments with a timestamp.

### Patch Changes

- e91c0f5: Render the new print actions in the standard dialog footer.

## 0.3.3

### Patch Changes

- ecd4edc: Allow components to be marked as always used and preselect them for compatible printers in new prints.
- 83ddf70: Derive filament names from manufacturer, material, and color, and add a color picker to the filament form.
- 7262ad1: List customers in the workspace section of the sidebar instead of under master data.
- 5a439bd: Keep the update indicator green while giving its label accessible color contrast.
- b6b7c51: Load the saved translation catalog when signing in with a non-default language.
- 36675eb: Rename the user-facing master data terminology to inventory throughout the application and documentation.
- 62a1205: Add shared manufacturer inventory with migrated component and filament relations and dropdown selection.
- 83ddf70: Show a green update indicator shortly after a newer GitHub release becomes available.
- 6e2881f: Keep print editor inputs aligned when validation messages are displayed.

## 0.3.2

### Patch Changes

- 551baba: Reduce the container image size by using Alpine and shipping only the Prisma migration runtime instead of all build dependencies.

## 0.3.1

### Patch Changes

- e37417a: Rename the application to ezPrint, adopt the ezSWM-inspired sidebar wordmark, and align project links with the renamed repository.

## 0.3.0

### Minor Changes

- 5d7974f: Adopt full-height Tenant Web list pages with fixed breadcrumb toolbars and independently scrollable compact tables.
- 137a9eb: Open validated master-data create and edit forms in accessible responsive dialogs while keeping tables visible.
- 661ffc1: Validate settings, master-data, and print-job forms with shared Zod schemas before submitting data.
- d799402: Adopt a consistent Tabler-first icon language across navigation, search, dashboard, forms, and actions.
- 6600a0c: Publish a complete US English user guide with Playwright-generated application screenshots and refreshed application branding.
- cf1399d: Standardize form controls with numeric amount inputs, in-field units, and leading Tabler icons.

### Patch Changes

- fb8a0be: Stabilize generated release lockfiles and documentation screenshots in CI.

## 0.2.0

### Minor Changes

- c7922cd: Add the Nuxt application foundation, SQLite persistence, local authentication, dashboard shell, CI, and container release scaffolding.
- bae63f4: Refresh the application shell with Zinc and Blue styling, IBM Plex Sans and JetBrains Mono, grouped navigation, a Tenant Web-inspired user menu, and a versioned sidebar footer.
- 0963cba: Refresh the dashboard with colorful KPI accents, clearer iconography, and more distinctive chart and draft sections.
- 6ea6937: Launch the public VitePress documentation with the product typography, blue theme, richer landing page, and repository navigation.
- 1fe1db4: Add instance settings and searchable customer, printer, compatible component, and filament management with deterministic derived cost rates.
- 28b873f: Add deterministic print cost calculation, immutable snapshots, draft completion and duplication, the print editor, and period-aware dashboard analytics.
- 96b753f: Harden migrations, health checks, non-root container startup, SQLite backups, accessibility, and isolated integration, component, browser, and container verification.
- c2d7f99: Add a responsive global app-bar search for print jobs and all master-data records, including grouped results and a keyboard shortcut.
- 625d2fc: Add a bilingual, searchable VitePress site with user, operator, architecture, calculation, API, contribution, and publication guides plus documentation quality and Pages workflows.

### Patch Changes

- 1db4c94: Keep scheduled Dependabot updates focused on GitHub Actions and container images while GitHub security updates continue to cover vulnerable application dependencies.
- 12aef65: Expand the project README with features, deployment and development guidance, live documentation links, workflow badges, and project support information.
- aec75d3: Add repository funding metadata for supporting the project through Buy Me a Coffee.
- 039a48e: Add automated CodeQL quality and security analysis, dependency review, Dependabot updates, clearer vulnerability reporting, and current workflow runtimes.
- 2c1254d: Keep production container restart checks on the dynamically reassigned host port in CI.
- d632992: Repair the remote release workflow for Changesets v3 and make the cold-start browser acceptance test resilient to CI compilation time.

## 0.1.0

Initial planning release.
