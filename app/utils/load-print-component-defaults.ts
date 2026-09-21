import type { MasterDataListItem, PaginatedResponse } from '#shared/types/master-data';

export async function loadPrintComponentDefaults(printerId: string) {
  const items: MasterDataListItem[] = [];
  if (printerId) {
    let page = 1;
    let total: number;
    do {
      const result = await $fetch<PaginatedResponse<MasterDataListItem>>('/api/components', {
        query: { printerId, alwaysUsed: true, page, pageSize: 100 },
      });
      items.push(...result.items);
      total = result.total;
      page++;
    } while (items.length < total);
  }
  return getPrintComponentDefaults(items, printerId);
}
