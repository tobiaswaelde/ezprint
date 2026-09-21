import Decimal from 'decimal.js';
import { z } from 'zod';
import { currencySchema, supportedLocaleSchema } from './common';

export function decimalSchema(options: { positive?: boolean } = {}) {
  return z
    .union([z.string(), z.number().finite()])
    .transform((value) => String(value).trim())
    .pipe(z.string().regex(/^\d+(?:\.\d+)?$/))
    .refine(
      (value) => {
        const decimal = new Decimal(value);
        return options.positive ? decimal.greaterThan(0) : decimal.greaterThanOrEqualTo(0);
      },
      options.positive ? 'Must be greater than zero' : 'Must not be negative',
    );
}

const optionalText = z
  .string()
  .trim()
  .max(2000)
  .nullish()
  .transform((value) => value || null);

const optionalId = z
  .string()
  .trim()
  .nullish()
  .transform((value) => value || null)
  .pipe(z.string().min(1).nullable());

export const settingsSchema = z.object({
  currency: currencySchema,
  defaultLocale: supportedLocaleSchema,
  electricityPricePerKwh: decimalSchema(),
  spoolManagementEnabled: z.boolean(),
});

export const customerSchema = z.object({
  name: z.string().trim().min(1).max(200),
  email: z
    .union([z.literal(''), z.email()])
    .nullish()
    .transform((value) => value?.trim().toLowerCase() || null),
  excludeFromDashboard: z.boolean().optional(),
  note: optionalText,
});

type PrinterValidationMessages = {
  manufacturerRequired: string;
};

const defaultPrinterValidationMessages: PrinterValidationMessages = {
  manufacturerRequired: 'validation.printerManufacturerRequired',
};

export function createPrinterSchema(messages: PrinterValidationMessages = defaultPrinterValidationMessages) {
  return z
    .object({
      name: z.string().trim().min(1).max(200),
      manufacturerId: optionalId,
      manufacturer: optionalText,
      model: optionalText,
      purchasePrice: decimalSchema(),
      expectedLifetimeHours: decimalSchema({ positive: true }),
      averagePowerWatts: z.coerce.number().int().nonnegative(),
      note: optionalText,
    })
    .superRefine((value, context) => {
      if (value.manufacturerId || value.manufacturer) return;
      context.addIssue({
        code: 'custom',
        path: ['manufacturerId'],
        message: messages.manufacturerRequired,
      });
    });
}

export const printerSchema = createPrinterSchema();

export const manufacturerSchema = z.object({
  name: z.string().trim().min(1).max(200),
  note: optionalText,
});

export const componentSchema = z.object({
  type: z.enum(['HOTEND', 'BUILD_PLATE', 'OTHER']),
  name: z.string().trim().min(1).max(200),
  alwaysUsed: z.boolean().default(false),
  manufacturerId: optionalId,
  model: optionalText,
  purchasePrice: decimalSchema(),
  expectedLifetimeHours: decimalSchema({ positive: true }),
  printerIds: z.array(z.string().min(1)).default([]),
  note: optionalText,
});

export const filamentSchema = z.object({
  name: z.string().trim().max(200).optional(),
  manufacturerId: z.string().trim().min(1),
  material: z.string().trim().min(1).max(100),
  colorName: z.string().trim().min(1).max(100),
  colorHex: z
    .string()
    .trim()
    .regex(/^#[0-9a-f]{6}$/i)
    .transform((value) => value.toUpperCase()),
  purchasePrice: decimalSchema(),
  netWeightGrams: decimalSchema({ positive: true }),
  note: optionalText,
});

export const archiveSchema = z.object({ archived: z.boolean() });
const queryBoolean = z.preprocess(
  (value) => (value === 'true' ? true : value === 'false' || value === undefined ? false : value),
  z.boolean(),
);
export const listQuerySchema = z.object({
  search: z.string().trim().max(200).default(''),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
  includeArchived: queryBoolean,
});

export const componentListQuerySchema = listQuerySchema.extend({
  type: z.enum(['HOTEND', 'BUILD_PLATE', 'OTHER']).optional(),
  printerId: z.string().trim().min(1).max(200).optional(),
  alwaysUsed: queryBoolean.optional(),
});
