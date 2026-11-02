export type GlobalSearchKind =
  'prints' | 'customers' | 'printers' | 'components' | 'filaments' | 'spools' | 'series';

export interface GlobalSearchResult {
  id: string;
  title: string;
  description: string | null;
  to: string;
}

export interface GlobalSearchGroup {
  type: GlobalSearchKind;
  items: GlobalSearchResult[];
}

export interface GlobalSearchResponse {
  query: string;
  groups: GlobalSearchGroup[];
}
