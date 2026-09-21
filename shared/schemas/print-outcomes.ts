import { z } from 'zod';
import { canonicalDecimal } from '../utils/decimal';

export const outcomeStatusSchema = z.enum(['SUCCESS', 'FAILED']);
type PrintOutcomeValidationMessages = {
  failureReasonRequired: string;
  uniqueUsageRequired: string;
  correctionNoteRequired: string;
};

const defaultValidationMessages: PrintOutcomeValidationMessages = {
  failureReasonRequired: 'validation.outcomeFailureReasonRequired',
  uniqueUsageRequired: 'validation.outcomeUniqueUsageRequired',
  correctionNoteRequired: 'validation.outcomeCorrectionNoteRequired',
};

export function createPrintOutcomeSchema(
  messages: PrintOutcomeValidationMessages = defaultValidationMessages,
) {
  return z
    .object({
      status: outcomeStatusSchema,
      parts: z
        .array(
          z.object({
            partId: z.string().min(1),
            durationSeconds: z.number().int().min(0).max(2147483647),
          }),
        )
        .min(1)
        .max(100)
        .optional(),
      durationSeconds: z.number().int().min(0).max(2147483647),
      filaments: z
        .array(
          z.object({
            usageId: z.string().min(1),
            usedGrams: z
              .string()
              .max(100)
              .regex(/^\d+(?:\.\d+)?$/)
              .transform(canonicalDecimal),
          }),
        )
        .min(1)
        .max(1000),
      failureReason: z
        .string()
        .trim()
        .max(2000)
        .nullish()
        .transform((value) => value || null),
      note: z
        .string()
        .trim()
        .max(5000)
        .nullish()
        .transform((value) => value || null),
    })
    .superRefine((value, context) => {
      if (
        value.parts &&
        (new Set(value.parts.map((part) => part.partId)).size !== value.parts.length ||
          value.parts.reduce((total, part) => total + part.durationSeconds, 0) !== value.durationSeconds)
      )
        context.addIssue({ code: 'custom', path: ['parts'], message: messages.uniqueUsageRequired });
      if (value.status === 'FAILED' && !value.failureReason)
        context.addIssue({
          code: 'custom',
          path: ['failureReason'],
          message: messages.failureReasonRequired,
        });
      if (new Set(value.filaments.map((line) => line.usageId)).size !== value.filaments.length)
        context.addIssue({
          code: 'custom',
          path: ['filaments'],
          message: messages.uniqueUsageRequired,
        });
    });
}

export const printOutcomeSchema = createPrintOutcomeSchema();
export type PrintOutcomeInput = z.output<typeof printOutcomeSchema>;

export function createPrintOutcomeCorrectionSchema(
  messages: PrintOutcomeValidationMessages = defaultValidationMessages,
) {
  return createPrintOutcomeSchema(messages)
    .and(
      z.object({
        expectedRevision: z.number().int().positive(),
        operationKey: z.uuid(),
      }),
    )
    .refine((value) => !!value.note, {
      path: ['note'],
      message: messages.correctionNoteRequired,
    });
}

export const printOutcomeCorrectionSchema = createPrintOutcomeCorrectionSchema();
