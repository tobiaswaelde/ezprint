import { createHash } from 'node:crypto';
import { z } from 'zod';
import { bambuActionSchema, bambuQuerySchema } from '#shared/schemas/integrations';
import { db } from '../utils/db';
import { apiError } from '../utils/http';
import { requireSpoolManagement } from '../utils/spool-management';
import { parseBody } from '../utils/validation';
import { integrationConfigured, integrationRequest } from '../utils/integrations/http';
import {
  bambuPrinterSchema,
  bambuStateSchema,
  bambuLogSchema,
  bambuLogPageSchema,
  bambuAssignmentsSchema,
  terminalOutcome,
} from '../utils/integrations/bambu-contract';
import { recordPrintOutcome } from './prints';
const digest = (value: string) => createHash('sha256').update(value).digest('hex');
async function request<T>(path: string, schema: z.ZodType<T>) {
  const response = schema.safeParse(await integrationRequest('BAMBUBUDDY', `api/v1/${path}`));
  if (!response.success) return apiError(502, 'INTEGRATION_CONTRACT', 'errors.integrationContract');
  return response.data;
}
export async function syncBambuPrinter(id: string) {
  const printer = await db.printer.findUniqueOrThrow({ where: { id } });
  if (!printer.bambuId) return;
  try {
    const state = await request(`printers/${printer.bambuId}/status`, bambuStateSchema);
    if (state.id !== printer.bambuId) apiError(409, 'INTEGRATION_CONFLICT', 'errors.integrationConflict');
    let assignments: z.infer<typeof bambuAssignmentsSchema> = [];
    let mappingWarning = false;
    if (await integrationConfigured('SPOOLMAN'))
      try {
        assignments = await request('spoolman/inventory/slot-assignments/all', bambuAssignmentsSchema);
      } catch {
        mappingWarning = true;
      }
    const localMappings = await db.bambuTrayMapping.findMany({ where: { printerId: id } });
    const trays = [];
    const slots = [
      ...state.ams.flatMap((ams) => ams.tray.map((tray) => ({ ...tray, amsId: ams.id }))),
      ...state.vt_tray.map((tray) => ({ ...tray, amsId: 255 })),
    ];
    for (const tray of slots) {
      const slot = `${tray.amsId}:${tray.id}`;
      const remote = assignments.filter(
        (item) =>
          item.printer_id === printer.bambuId && item.ams_id === tray.amsId && item.tray_id === tray.id,
      );
      const candidate =
        remote.length === 1
          ? await db.spool.findUnique({ where: { spoolmanId: remote[0]!.spoolman_spool_id } })
          : null;
      const linked = candidate?.stockAuthority !== 'NATIVE' ? candidate : null;
      const explicit = localMappings.find((item) => item.slot === slot);
      const spoolId = linked?.id ?? explicit?.spoolId ?? null;
      const spool = spoolId ? await db.spool.findUnique({ where: { id: spoolId } }) : null;
      trays.push({
        slot,
        material: tray.tray_type ?? null,
        spoolId,
        spoolCode: spool?.code ?? null,
        ambiguous: remote.length > 1 || !!(linked && explicit && linked.id !== explicit.spoolId),
        unavailable: !!spool?.archivedAt || ['ARCHIVED', 'MISSING'].includes(spool?.remoteState ?? ''),
        source: linked ? 'SPOOLMAN' : explicit ? 'LOCAL' : 'UNMAPPED',
      });
    }
    await db.printer.update({
      where: { id },
      data: {
        bambuState: JSON.stringify({
          name: state.name,
          connected: state.connected,
          state: state.state ?? null,
          trays,
          mappingWarning,
        }),
        bambuSyncedAt: new Date(),
        bambuError: null,
      },
    });
  } catch {
    await db.printer.update({ where: { id }, data: { bambuError: 'INTEGRATION_UNAVAILABLE' } });
  }
}
async function remoteLog(printerId: number, remoteLogId: number) {
  // ponytail: search at most 1,000 recent records; older records stay cached until manually reconciled.
  for (let page = 0; page < 20; page++) {
    const result = await request(
      `print-log/?printer_id=${printerId}&limit=50&offset=${page * 50}`,
      bambuLogPageSchema,
    );
    const found = result.items.find((item) => item.id === remoteLogId);
    if (found) return found;
    if ((page + 1) * 50 >= result.total) break;
  }
  return apiError(409, 'INTEGRATION_CONFLICT', 'errors.integrationConflict');
}
async function printPart(printId: string, partId?: string) {
  const parts = await db.printPart.findMany({
    where: { printJobId: printId, ...(partId ? { id: partId } : {}) },
    take: 2,
    include: { printer: true, bambuLink: true, printJob: { include: { outcome: true } } },
  });
  if (parts.length !== 1) apiError(409, 'INTEGRATION_CONFLICT', 'errors.integrationConflict');
  return parts[0]!;
}
export async function syncBambuPrint(printId: string, partId?: string) {
  const part = await printPart(printId, partId);
  if (!part.bambuLink || !part.printer.bambuId || part.bambuLink.importedAt) return;
  try {
    const log = await remoteLog(part.printer.bambuId, part.bambuLink.remoteLogId);
    if (log.printer_id !== part.printer.bambuId)
      apiError(409, 'INTEGRATION_CONFLICT', 'errors.integrationConflict');
    await db.bambuPrintLink.updateMany({
      where: { partId: part.id, importedAt: null },
      data: { cachedJson: JSON.stringify(log), syncedAt: new Date(), error: null },
    });
  } catch {
    await db.bambuPrintLink.updateMany({
      where: { partId: part.id, importedAt: null },
      data: { error: 'INTEGRATION_UNAVAILABLE', syncedAt: new Date() },
    });
  }
}
export async function bambuStatus(query: Record<string, unknown>) {
  const input = parseBody(bambuQuerySchema, query);
  if (input.view === 'logs') {
    const printer = await db.printer.findUniqueOrThrow({ where: { id: input.printerId ?? '' } });
    if (!printer.bambuId) apiError(409, 'INTEGRATION_CONFLICT', 'errors.integrationConflict');
    return request(
      `print-log/?printer_id=${printer.bambuId}&limit=50&offset=${(input.page - 1) * 50}`,
      bambuLogPageSchema,
    );
  }
  let remotePrinters: z.infer<typeof bambuPrinterSchema>[] = [];
  let version: string | null = null;
  let error: string | null = null;
  const configured = await integrationConfigured('BAMBUBUDDY');
  if (configured)
    try {
      remotePrinters = await request('printers/', z.array(bambuPrinterSchema).max(500));
      version = (await request('updates/version', z.object({ version: z.string().max(64) }))).version;
    } catch {
      error = 'INTEGRATION_UNAVAILABLE';
    }
  const printers = await db.printer.findMany({
    where: input.printerId ? { id: input.printerId } : { archivedAt: null },
    take: 100,
    orderBy: { name: 'asc' },
    include: { trayMappings: true },
  });
  const part = input.printId ? await printPart(input.printId, input.partId) : null;
  const link = part?.bambuLink;
  const log = link ? bambuLogSchema.parse(JSON.parse(link.cachedJson)) : null;
  return {
    configured,
    remotePrinters,
    version,
    error,
    printers: printers.map((printer) => ({
      id: printer.id,
      name: printer.name,
      remoteId: printer.bambuId,
      state: printer.bambuState ? JSON.parse(printer.bambuState) : null,
      syncedAt: printer.bambuSyncedAt,
      error: printer.bambuError,
      stale:
        !!printer.bambuId &&
        (!printer.bambuSyncedAt ||
          Date.now() - printer.bambuSyncedAt.getTime() > 300000 ||
          !!printer.bambuError),
    })),
    link:
      link && log
        ? {
            partId: link.partId,
            remoteLogId: link.remoteLogId,
            log,
            previewHash: digest(link.cachedJson),
            terminal: terminalOutcome(log.status, log.completed_at),
            syncedAt: link.syncedAt,
            error: link.error,
            importedAt: link.importedAt,
          }
        : null,
  };
}
export async function bambuAction(input: unknown) {
  const data = parseBody(bambuActionSchema, input);
  if (data.action === 'LINK_PRINTER') {
    if (data.remoteId !== null) await request(`printers/${data.remoteId}`, bambuPrinterSchema);
    const linked = await db.printer.findFirst({
      where: { bambuId: data.remoteId, id: { not: data.printerId } },
    });
    if (data.remoteId !== null && linked) apiError(409, 'INTEGRATION_CONFLICT', 'errors.integrationConflict');
    const pending = await db.bambuPrintLink.count({
      where: { part: { printerId: data.printerId }, importedAt: null },
    });
    if (pending) apiError(409, 'INTEGRATION_CONFLICT', 'errors.integrationConflict');
    await db.printer.update({
      where: { id: data.printerId },
      data: { bambuId: data.remoteId, bambuState: null, bambuSyncedAt: null, bambuError: null },
    });
    await syncBambuPrinter(data.printerId);
  }
  if (data.action === 'SYNC_PRINTER') await syncBambuPrinter(data.printerId);
  if (data.action === 'MAP_TRAY') {
    await requireSpoolManagement();
    const printer = await db.printer.findUniqueOrThrow({ where: { id: data.printerId } });
    const state = printer.bambuState
      ? (JSON.parse(printer.bambuState) as { trays: { slot: string }[] })
      : null;
    if (!state?.trays.some((tray) => tray.slot === data.slot))
      apiError(409, 'INTEGRATION_CONFLICT', 'errors.integrationConflict');
    if (data.spoolId && !(await db.spool.findFirst({ where: { id: data.spoolId, archivedAt: null } })))
      apiError(422, 'INVALID_SPOOL', 'errors.invalidSpool');
    if (data.spoolId)
      await db.bambuTrayMapping.upsert({
        where: { printerId_slot: { printerId: data.printerId, slot: data.slot } },
        create: { printerId: data.printerId, slot: data.slot, spoolId: data.spoolId },
        update: { spoolId: data.spoolId },
      });
    else await db.bambuTrayMapping.deleteMany({ where: { printerId: data.printerId, slot: data.slot } });
    await syncBambuPrinter(data.printerId);
  }
  if (data.action === 'ATTACH') {
    const part = await printPart(data.printId, data.partId);
    if (!part.printer.bambuId || part.printJob.archivedAt || part.printJob.outcome || part.bambuLink)
      apiError(409, 'INTEGRATION_CONFLICT', 'errors.integrationConflict');
    const log = await remoteLog(part.printer.bambuId, data.remoteLogId);
    if (log.printer_id !== part.printer.bambuId)
      apiError(409, 'INTEGRATION_CONFLICT', 'errors.integrationConflict');
    await db.$transaction(async (transaction) => {
      const current = await transaction.printPart.findUniqueOrThrow({
        where: { id: part.id },
        include: { printer: true, bambuLink: true, printJob: { include: { outcome: true } } },
      });
      if (
        current.printerId !== part.printerId ||
        current.printer.bambuId !== part.printer.bambuId ||
        current.bambuLink ||
        current.printJob.archivedAt ||
        current.printJob.outcome ||
        (await transaction.bambuPrintLink.findUnique({ where: { remoteLogId: log.id } }))
      )
        apiError(409, 'INTEGRATION_CONFLICT', 'errors.integrationConflict');
      await transaction.bambuPrintLink.create({
        data: {
          partId: part.id,
          printJobId: data.printId,
          remoteLogId: log.id,
          cachedJson: JSON.stringify(log),
        },
      });
    });
  }
  if (data.action === 'SYNC_PRINT') await syncBambuPrint(data.printId, data.partId);
  if (data.action === 'IMPORT') {
    let previews = data.previews;
    if (!previews && data.previewHash) {
      const part = await printPart(data.printId);
      previews = [{ partId: part.id, previewHash: data.previewHash }];
    }
    if (!previews) apiError(409, 'INTEGRATION_CONFLICT', 'errors.integrationConflict');
    await recordPrintOutcome(data.printId, data.outcome, previews);
  }
  return { ok: true };
}
