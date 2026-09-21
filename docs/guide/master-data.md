---
title: Inventory overview
description: Understand shared list behavior, validation, calculated rates, archiving, and safe deletion.
---

# Inventory overview

Inventory provides the reusable inputs for every print calculation:

- [Customers](/guide/customers) provide optional ownership and contact context.
- [Printers](/guide/printers) provide purchase price, expected lifetime, and average power.
- [Manufacturers](/guide/manufacturers) provide reusable supplier names for printers, components, and filaments.
- [Components](/guide/components) provide wear cost, type, and printer compatibility.
- [Filaments](/guide/filaments) provide spool cost and usable net weight.

## Shared list functions

Each page supports local search, **New**, **Edit**, **Archive**, **Restore**, and **Delete**. Search is debounced as
you type. Select **Table options → Show archived** to include archived rows; those rows appear dimmed.

Archiving is reversible and hides a record from new print selections while preserving old calculations. Permanent
deletion succeeds only when the record is not referenced. If it is referenced, keep it archived instead. Delete
always opens a confirmation before the request is sent.

## Form behavior

Create and edit forms open in a dialog. Required fields are marked with an asterisk, invalid fields show inline
messages, and **Cancel**, <kbd>Escape</kbd>, or the close button discards unsaved changes. Monetary and quantity
fields accept decimal values; negative values are rejected, and lifetimes and net weights must be greater than zero.

Printer/component cost per hour and filament cost per gram update in the form before saving. Display formatting
uses the selected application language and currency; the HTTP API serializes decimal values as strings.
Printer and filament forms require a manufacturer from the shared inventory; component manufacturers remain
optional.

Database-backed selection fields include a **+** button to create the related record without leaving the current
form. Saving refreshes the options and selects the new record; multiple selections keep their existing entries.
Canceling keeps the parent form and selection unchanged. Component and spool creation from a print retains the
current printer/type or filament context.

These fields search the server after a short typing pause and load 25 matches at a time. Choose **Load more**
to continue through the result pages. Selected names remain visible even when they are outside the search results.
This also applies to entity filters in print lists and history. Fixed choices such as status, language, and remote
printer configuration do not offer local record creation.
