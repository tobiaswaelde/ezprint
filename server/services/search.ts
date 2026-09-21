import { globalSearchQuerySchema } from '#shared/schemas/search';
import type { GlobalSearchGroup, GlobalSearchKind } from '#shared/types/search';
import { db } from '../utils/db';
import { parseBody } from '../utils/validation';

const listRoute: Record<Exclude<GlobalSearchKind, 'prints'>, string> = {
  customers: '/customers',
  printers: '/printers',
  components: '/components',
  filaments: '/filaments',
  spools: '/spools',
  series: '/series',
};

function masterDataTarget(type: Exclude<GlobalSearchKind, 'prints'>, title: string) {
  return `${listRoute[type]}?search=${encodeURIComponent(title)}`;
}

export async function searchApplication(query: Record<string, unknown>) {
  const { q } = parseBody(globalSearchQuerySchema, query);
  const [settings, prints, customers, printers, components, filaments, spools, series] =
    await db.$transaction([
      db.appSettings.findUniqueOrThrow({
        where: { id: 1 },
        select: { printSeriesEnabled: true, spoolManagementEnabled: true },
      }),
      db.printJob.findMany({
        where: {
          archivedAt: null,
          OR: [
            { name: { contains: q } },
            { customer: { name: { contains: q } } },
            { parts: { some: { printer: { name: { contains: q } } } } },
          ],
        },
        select: {
          id: true,
          name: true,
          customer: { select: { name: true } },
          parts: { select: { printer: { select: { name: true } } }, orderBy: { position: 'asc' } },
        },
        orderBy: { updatedAt: 'desc' },
        take: 5,
      }),
      db.customer.findMany({
        where: {
          archivedAt: null,
          OR: [{ name: { contains: q } }, { email: { contains: q } }],
        },
        select: { id: true, name: true, email: true },
        orderBy: { name: 'asc' },
        take: 5,
      }),
      db.printer.findMany({
        where: {
          archivedAt: null,
          OR: [
            { name: { contains: q } },
            { manufacturer: { name: { contains: q } } },
            { model: { contains: q } },
          ],
        },
        select: { id: true, name: true, manufacturer: { select: { name: true } }, model: true },
        orderBy: { name: 'asc' },
        take: 5,
      }),
      db.component.findMany({
        where: {
          archivedAt: null,
          OR: [
            { name: { contains: q } },
            { manufacturer: { is: { name: { contains: q } } } },
            { model: { contains: q } },
            { type: { contains: q } },
          ],
        },
        select: {
          id: true,
          name: true,
          type: true,
          manufacturer: { select: { name: true } },
          model: true,
        },
        orderBy: [{ type: 'asc' }, { name: 'asc' }],
        take: 5,
      }),
      db.filament.findMany({
        where: {
          archivedAt: null,
          OR: [
            { name: { contains: q } },
            { manufacturer: { name: { contains: q } } },
            { material: { contains: q } },
            { colorName: { contains: q } },
            { colorHex: { contains: q } },
          ],
        },
        select: {
          id: true,
          name: true,
          manufacturer: { select: { name: true } },
          material: true,
          colorName: true,
          colorHex: true,
        },
        orderBy: [{ manufacturer: { name: 'asc' } }, { name: 'asc' }],
        take: 5,
      }),
      db.spool.findMany({
        where: { archivedAt: null, OR: [{ code: { contains: q } }, { filament: { name: { contains: q } } }] },
        take: 5,
        orderBy: { code: 'asc' },
        include: { filament: true },
      }),
      db.printSeries.findMany({
        where: { archivedAt: null, OR: [{ name: { contains: q } }, { customer: { name: { contains: q } } }] },
        include: { customer: true },
        take: 5,
        orderBy: { updatedAt: 'desc' },
      }),
    ]);

  const groups: GlobalSearchGroup[] = [
    {
      type: 'series',
      items: settings.printSeriesEnabled
        ? series.map((item) => ({
            id: item.id,
            title: item.name,
            description: item.customer?.name ?? null,
            to: `/series/${item.id}`,
          }))
        : [],
    },
    {
      type: 'spools',
      items: settings.spoolManagementEnabled
        ? spools.map((item) => ({
            id: item.id,
            title: item.code,
            description: item.filament.name,
            to: `/spools/${item.id}`,
          }))
        : [],
    },
    {
      type: 'prints',
      items: prints.map((item) => ({
        id: item.id,
        title: item.name,
        description: [item.customer?.name, ...new Set(item.parts.map((part) => part.printer.name))]
          .filter(Boolean)
          .join(' · '),
        to: `/prints/${item.id}`,
      })),
    },
    {
      type: 'customers',
      items: customers.map((item) => ({
        id: item.id,
        title: item.name,
        description: item.email,
        to: `/customers/${item.id}`,
      })),
    },
    {
      type: 'printers',
      items: printers.map((item) => ({
        id: item.id,
        title: item.name,
        description: [item.manufacturer.name, item.model].filter(Boolean).join(' · ') || null,
        to: masterDataTarget('printers', item.name),
      })),
    },
    {
      type: 'components',
      items: components.map((item) => ({
        id: item.id,
        title: item.name,
        description: [item.type, item.manufacturer?.name, item.model].filter(Boolean).join(' · '),
        to: masterDataTarget('components', item.name),
      })),
    },
    {
      type: 'filaments',
      items: filaments.map((item) => ({
        id: item.id,
        title: item.name,
        description: [item.manufacturer.name, item.material, item.colorName, item.colorHex]
          .filter(Boolean)
          .join(' · '),
        to: masterDataTarget('filaments', item.name),
      })),
    },
  ];

  return { query: q, groups: groups.filter((group) => group.items.length > 0) };
}
