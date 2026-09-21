import { decimalSchema } from './master-data';
import { canonicalDecimal } from '../utils/decimal';
import Decimal from 'decimal.js';
import { z } from 'zod';

export const printStatuses = ['DRAFT', 'PRINTING', 'PRINTED', 'SHIPPED', 'DONE'] as const;
export const printStatusSchema = z.enum(printStatuses);
export type PrintStatus = z.output<typeof printStatusSchema>;

const filterIdSchema = z.string().trim().min(1).max(200);
const setOperator = <T extends z.ZodType>(value: T) =>
  z.union([
    z.object({ in: z.array(value).min(1).max(100) }).strict(),
    z.object({ notIn: z.array(value).min(1).max(100) }).strict(),
  ]);
export const printWhereLeafSchema = z.union([
  z.object({ status: setOperator(printStatusSchema) }).strict(),
  z.object({ outcome: setOperator(z.enum(['PENDING', 'SUCCESS', 'FAILED'])) }).strict(),
  z.object({ printerId: setOperator(filterIdSchema) }).strict(),
  z.object({ customerId: setOperator(filterIdSchema) }).strict(),
  z.object({ seriesId: setOperator(filterIdSchema) }).strict(),
  z.object({ archived: z.boolean() }).strict(),
  z.object({ dateFrom: z.object({ gte: z.iso.date() }).strict() }).strict(),
  z.object({ dateTo: z.object({ lte: z.iso.date() }).strict() }).strict(),
]);
export const printWhereSchema = z.union([
  printWhereLeafSchema,
  z.object({ AND: z.array(printWhereLeafSchema).min(1).max(20) }).strict(),
  z.object({ OR: z.array(printWhereLeafSchema).min(1).max(20) }).strict(),
]);
export type PrintWhere = z.output<typeof printWhereSchema>;
export type PrintWhereLeaf = z.output<typeof printWhereLeafSchema>;

const printWhereQuerySchema = z
  .union([z.string().max(10_000), printWhereSchema])
  .transform((value, context) => {
    if (typeof value !== 'string') return value;
    try {
      const parsed = printWhereSchema.safeParse(JSON.parse(value));
      if (parsed.success) return parsed.data;
    } catch {
      // Report the same stable validation issue for invalid JSON and invalid filter structures.
    }
    context.addIssue({ code: 'custom', message: 'Invalid Query Kit where filter' });
    return z.NEVER;
  });

export const printQuantitySchema = z
  .union([z.number(), z.string().regex(/^\d+$/)])
  .transform(Number)
  .pipe(z.number().int().min(1).max(1000000))
  .default(1);

export const salesValueSchema = z.preprocess(
  (value) => (value === '' ? null : value),
  decimalSchema()
    .nullish()
    .transform((value) => (value == null ? null : canonicalDecimal(value))),
);

const positiveDecimal = z
  .union([z.string(), z.number().finite()])
  .transform((value) => String(value).trim())
  .pipe(z.string().regex(/^\d+(?:\.\d+)?$/))
  .refine((value) => new Decimal(value).greaterThan(0));

const printDurationFormSchema = z
  .object({
    componentId: z.string().min(1),
    hours: z.coerce.number().int().nonnegative(),
    minutes: z.coerce.number().int().min(0).max(59),
  })
  .refine((value) => value.hours > 0 || value.minutes > 0, {
    path: ['minutes'],
    message: 'Duration must be greater than zero',
  });

export const printDraftFormSchema = z.object({
  quantity: printQuantitySchema,
  salesValue: salesValueSchema,
  seriesId: z
    .string()
    .min(1)
    .nullish()
    .transform((value) => value || null),
  name: z.string().trim().min(1).max(200),
  customerId: z.string().min(1).nullable(),
  printerId: z.string().min(1),
  buildPlateId: z.string().min(1),
  hotends: z.array(printDurationFormSchema).min(1),
  otherComponentIds: z.array(z.string().min(1)).default([]),
  filaments: z
    .array(
      z.object({
        filamentId: z.string().min(1),
        spoolId: z.string().min(1).optional(),
        usedGrams: positiveDecimal,
      }),
    )
    .min(1),
  notes: z.string().trim().max(5000),
});

const legacyPrintDraftSchema = z.object({
  quantity: printQuantitySchema,
  salesValue: salesValueSchema,
  seriesId: z
    .string()
    .min(1)
    .nullish()
    .transform((value) => value || null),
  name: z.string().trim().min(1).max(200),
  customerId: z
    .string()
    .min(1)
    .nullish()
    .transform((value) => value || null),
  printerId: z.string().min(1),
  buildPlateId: z.string().min(1),
  hotends: z
    .array(z.object({ componentId: z.string().min(1), durationSeconds: z.coerce.number().int().positive() }))
    .min(1),
  otherComponentIds: z.array(z.string().min(1)).default([]),
  filaments: z
    .array(
      z.object({
        filamentId: z.string().min(1),
        spoolId: z.string().min(1).optional(),
        usedGrams: positiveDecimal,
      }),
    )
    .min(1),
  notes: z
    .string()
    .trim()
    .max(5000)
    .nullish()
    .transform((value) => value || null),
});

export const printPartSchema = legacyPrintDraftSchema
  .pick({ printerId: true, buildPlateId: true, hotends: true, otherComponentIds: true, filaments: true })
  .extend({ id: z.string().min(1).optional() });
export type PrintPartInput = z.output<typeof printPartSchema>;

const multipartPrintDraftSchema = legacyPrintDraftSchema
  .omit({ printerId: true, buildPlateId: true, hotends: true, otherComponentIds: true, filaments: true })
  .extend({ parts: z.array(printPartSchema).min(1).max(100) })
  .refine(
    (input) =>
      input.parts.reduce(
        (total, part) => total + part.hotends.reduce((sum, hotend) => sum + hotend.durationSeconds, 0),
        0,
      ) <= 2147483647,
    { path: ['parts'], message: 'Combined print duration exceeds the supported range' },
  );

// Keep the singular fields as first-part aliases for existing API clients.
export const printDraftSchema = z.union([
  multipartPrintDraftSchema.transform((input) => ({ ...input, ...input.parts[0]! })),
  legacyPrintDraftSchema.extend({ parts: z.never().optional() }).transform((input) => ({
    ...input,
    parts: [printPartSchema.parse(input)],
  })),
]);

export const printPartFormSchema = printDraftFormSchema.pick({
  printerId: true,
  buildPlateId: true,
  hotends: true,
  otherComponentIds: true,
  filaments: true,
});
export const multipartPrintDraftFormSchema = printDraftFormSchema
  .omit({ printerId: true, buildPlateId: true, hotends: true, otherComponentIds: true, filaments: true })
  .extend({
    parts: z
      .array(printPartFormSchema.extend({ id: z.string().optional() }))
      .min(1)
      .max(100),
  });

export const printListQuerySchema = z
  .object({
    search: z.string().trim().max(200).default(''),
    page: z.coerce.number().int().positive().default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(25),
    status: printStatusSchema.optional(),
    outcome: z.enum(['PENDING', 'SUCCESS', 'FAILED']).optional(),
    customerId: z.string().optional(),
    printerId: z.string().optional(),
    seriesId: z.string().optional(),
    dateFrom: z.iso.date().optional(),
    dateTo: z.iso.date().optional(),
    where: printWhereQuerySchema.optional(),
    includeArchived: z.preprocess(
      (value) => (value === 'true' ? true : value === 'false' || value === undefined ? false : value),
      z.boolean(),
    ),
  })
  .refine((value) => !value.dateFrom || !value.dateTo || value.dateFrom <= value.dateTo, {
    path: ['dateTo'],
    message: 'End date must not precede start date',
  });

export const printWorkflowUpdateSchema = z
  .object({
    status: printStatusSchema.optional(),
    paid: z.boolean().optional(),
  })
  .refine((value) => value.status !== undefined || value.paid !== undefined);

export const dashboardPeriodSchema = z.enum(['30d', '90d', 'all']).default('30d');
export type PrintDraftInput = z.output<typeof printDraftSchema>;
