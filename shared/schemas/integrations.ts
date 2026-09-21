import { printOutcomeSchema } from './print-outcomes';
import { z } from 'zod';
import { stockDecimalSchema } from './spools';
export const remoteIdSchema = z.number().int().positive();
export const integrationPageSchema = z.object({ page: z.coerce.number().int().min(1).max(10000).default(1) });
export const spoolmanImportSchema = z.object({
  remoteId: remoteIdSchema,
  previewHash: z.string().regex(/^[a-f0-9]{64}$/),
  localSpoolId: z.string().min(1).optional(),
  authority: z.enum(['SPOOLMAN_READ_ONLY', 'EZPRINT_CONSUMPTION']).default('SPOOLMAN_READ_ONLY'),
});
export const spoolmanUnlinkSchema = z.object({
  spoolId: z.string().min(1),
  ownership: z.literal('NATIVE'),
  openingBalance: stockDecimalSchema,
});
export const syncOperationSchema = z.object({
  operationId: z.string().min(1),
  action: z.enum(['SEND', 'CONFIRM_APPLIED', 'CONFIRM_NOT_APPLIED']),
});
export const spoolmanActionSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('IMPORT'), data: spoolmanImportSchema }),
  z.object({ action: z.literal('UNLINK'), data: spoolmanUnlinkSchema }),
  z.object({ action: z.literal('SYNC'), spoolId: z.string().min(1) }),
  z.object({ action: z.literal('OPERATION'), data: syncOperationSchema }),
]);
export const bambuPartPreviewSchema = z.object({
  partId: z.string().min(1),
  previewHash: z.string().regex(/^[a-f0-9]{64}$/),
});
export type BambuPartPreview = z.output<typeof bambuPartPreviewSchema>;
export const bambuActionSchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('LINK_PRINTER'),
    printerId: z.string().min(1),
    remoteId: remoteIdSchema.nullable(),
  }),
  z.object({ action: z.literal('SYNC_PRINTER'), printerId: z.string().min(1) }),
  z.object({
    action: z.literal('MAP_TRAY'),
    printerId: z.string().min(1),
    slot: z.string().regex(/^\d{1,3}:\d{1,3}$/),
    spoolId: z.string().min(1).nullable(),
  }),
  z.object({
    action: z.literal('ATTACH'),
    printId: z.string().min(1),
    partId: z.string().min(1).optional(),
    remoteLogId: remoteIdSchema,
  }),
  z.object({
    action: z.literal('SYNC_PRINT'),
    printId: z.string().min(1),
    partId: z.string().min(1).optional(),
  }),
  z.object({
    action: z.literal('IMPORT'),
    printId: z.string().min(1),
    previewHash: z
      .string()
      .regex(/^[a-f0-9]{64}$/)
      .optional(),
    previews: z.array(bambuPartPreviewSchema).min(1).max(100).optional(),
    outcome: printOutcomeSchema,
  }),
]);
export const bambuQuerySchema = integrationPageSchema.extend({
  printerId: z.string().optional(),
  printId: z.string().optional(),
  partId: z.string().optional(),
  view: z.enum(['status', 'logs']).default('status'),
});
