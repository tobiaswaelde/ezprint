import { describe, expect, it } from 'vitest';
import { compilePrintWhere } from '../server/services/prints';
import { printListQuerySchema } from '../shared/schemas/prints';

describe('Query Kit print filters', () => {
  it('validates and compiles an AND filter group', () => {
    const input = printListQuerySchema.parse({
      where: JSON.stringify({
        AND: [
          { status: { in: ['PRINTING', 'DONE'] } },
          { printerId: { notIn: ['printer-1'] } },
          { archived: false },
          { dateFrom: { gte: '2026-09-01' } },
        ],
      }),
    });

    expect(compilePrintWhere(input.where!)).toEqual({
      AND: [
        { status: { in: ['PRINTING', 'DONE'] } },
        { parts: { none: { printerId: { in: ['printer-1'] } } } },
        { archivedAt: null },
        {
          OR: [
            { completedAt: { gte: new Date('2026-09-01T00:00:00.000Z') } },
            { completedAt: null, createdAt: { gte: new Date('2026-09-01T00:00:00.000Z') } },
          ],
        },
      ],
    });
  });

  it('compiles OR outcome filters including pending outcomes', () => {
    const input = printListQuerySchema.parse({
      where: JSON.stringify({
        OR: [{ outcome: { in: ['PENDING', 'FAILED'] } }, { customerId: { in: ['customer-1'] } }],
      }),
    });

    expect(compilePrintWhere(input.where!)).toEqual({
      OR: [
        {
          OR: [{ status: 'DONE', outcome: null }, { outcome: { status: { in: ['FAILED'] } } }],
        },
        { customerId: { in: ['customer-1'] } },
      ],
    });
  });

  it('negates the complete semantic outcome condition', () => {
    const input = printListQuerySchema.parse({ where: { outcome: { notIn: ['PENDING', 'SUCCESS'] } } });

    expect(compilePrintWhere(input.where!)).toEqual({
      NOT: {
        OR: [{ status: 'DONE', outcome: null }, { outcome: { status: { in: ['SUCCESS'] } } }],
      },
    });
  });

  it('rejects arbitrary fields, unsupported operators, deep nesting, and invalid dates', () => {
    for (const where of [
      { name: { contains: 'unsafe' } },
      { status: { equals: 'DONE' } },
      { AND: [{ OR: [{ archived: true }] }] },
      { dateTo: { lte: '2026-02-30' } },
    ]) {
      expect(printListQuerySchema.safeParse({ where: JSON.stringify(where) }).success).toBe(false);
    }
  });
});
