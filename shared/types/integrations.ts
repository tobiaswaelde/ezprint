export interface SpoolmanPreview {
  items: Array<{
    id: number;
    filament: { id: number; name?: string | null; vendor?: { name: string } | null };
    remaining_weight?: number | null;
    previewHash: string;
    localId: string | null;
    localCode: string | null;
    conflicts: string[];
  }>;
  page: number;
  hasMore: boolean;
}
export interface SpoolmanStatus {
  configured: boolean;
  version?: string | null;
  error?: string | null;
  capabilities: string[];
  operations: Array<{
    id: string;
    spoolId: string;
    grams: string;
    state: string;
    error: string | null;
    updatedAt: string;
  }>;
}
export interface BambuLog {
  id: number;
  printer_id: number | null;
  print_name?: string | null;
  status: string;
  completed_at?: string | null;
  duration_seconds?: number | null;
  filament_used_grams?: number | null;
  failure_reason?: string | null;
}
export interface BambuStatus {
  configured: boolean;
  version: string | null;
  error: string | null;
  remotePrinters: Array<{ id: number; name: string }>;
  printers: Array<{
    id: string;
    name: string;
    remoteId: number | null;
    syncedAt: string | null;
    error: string | null;
    stale: boolean;
    state: {
      name: string;
      connected: boolean;
      state: string | null;
      mappingWarning: boolean;
      trays: Array<{
        slot: string;
        material: string | null;
        spoolId: string | null;
        spoolCode: string | null;
        ambiguous: boolean;
        unavailable: boolean;
        source: string;
      }>;
    } | null;
  }>;
  link: {
    partId: string;
    remoteLogId: number;
    log: BambuLog;
    previewHash: string;
    terminal: 'SUCCESS' | 'FAILED' | null;
    syncedAt: string;
    error: string | null;
    importedAt: string | null;
  } | null;
}

export interface BambuPartActuals {
  durationSeconds: string | number;
  grams: Record<string, string>;
  link: BambuStatus['link'];
  ready: boolean;
}
