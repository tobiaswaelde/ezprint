import { createHash, randomUUID } from 'node:crypto';
import {
  chmodSync,
  createReadStream,
  createWriteStream,
  closeSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  openSync,
  readSync,
  renameSync,
  rmSync,
  statSync,
} from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { ZipArchive } from 'archiver';
import Database from 'better-sqlite3';
import unzipper from 'unzipper';
export { databasePathFromUrl, ensureDatabaseFile } from './database-path.ts';

export const BACKUP_FORMAT_VERSION = 1;
export const BACKUP_FORMAT = 'ezprint-logical-backup';
export const ZIP_HEADER = 'PK\x03\x04';

export const BACKUP_TABLES = [
  'User',
  'AppSettings',
  'Customer',
  'Manufacturer',
  'Printer',
  'Component',
  'PrinterComponent',
  'Filament',
  'PrintSeries',
  'PrintJob',
  'Spool',
  'PrintComponentUsage',
  'PrintFilamentUsage',
  'PrintCostSnapshot',
  'PrintOutcome',
  'StockMovement',
  'PrintOutcomeCorrection',
  'SpoolSyncOperation',
  'BambuPrintLink',
  'BambuTrayMapping',
] as const;

export type BackupTableName = (typeof BACKUP_TABLES)[number];

export type BackupTableMetadata = {
  name: BackupTableName;
  file: string;
  rowCount: number;
  sha256: string;
};

export type BackupMetadata = {
  format: typeof BACKUP_FORMAT;
  formatVersion: number;
  appVersion: string;
  createdAt: string;
  tables: BackupTableMetadata[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function tableFile(name: string) {
  return `data/${name}.ndjson`;
}

function quoteIdentifier(value: string) {
  return `"${value.replaceAll('"', '""')}"`;
}

function existingTables(database: Database.Database) {
  return new Set(
    database
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table'")
      .all()
      .map((row) => (row as { name: string }).name),
  );
}

async function exportTable(database: Database.Database, name: BackupTableName, target: string) {
  const hash = createHash('sha256');
  let rowCount = 0;
  const rows = database.prepare(`SELECT * FROM ${quoteIdentifier(name)}`).iterate();
  const source = Readable.from(
    (function* () {
      for (const row of rows) {
        const line = `${JSON.stringify(row)}\n`;
        hash.update(line);
        rowCount += 1;
        yield line;
      }
    })(),
  );
  await pipeline(source, createWriteStream(target, { mode: 0o600 }));
  return { rowCount, sha256: hash.digest('hex') };
}

async function writeZip(sourceDirectory: string, metadata: BackupMetadata, target: string) {
  await new Promise<void>((resolvePromise, reject) => {
    const output = createWriteStream(target, { flags: 'wx', mode: 0o600 });
    const archive = new ZipArchive({ zlib: { level: 9 } });
    output.on('close', resolvePromise);
    output.on('error', reject);
    archive.on('error', reject);
    archive.pipe(output);
    archive.append(`${JSON.stringify(metadata, null, 2)}\n`, { name: 'manifest.json' });
    for (const table of metadata.tables) {
      archive.file(join(sourceDirectory, `${table.name}.ndjson`), { name: table.file });
    }
    void archive.finalize();
  });
  chmodSync(target, 0o600);
}

export async function createBackupFile(source: string, target: string, appVersion: string) {
  if (resolve(source) === resolve(target)) {
    throw new Error('Backup target must differ from the live database.');
  }
  if (!existsSync(source)) throw new Error('The live database does not exist.');
  mkdirSync(dirname(target), { recursive: true });
  const temporaryDirectory = mkdtempSync(join(dirname(target), '.ezprint-backup-'));
  const snapshotPath = join(temporaryDirectory, `${randomUUID()}.db`);
  const temporaryTarget = `${target}.tmp-${randomUUID()}`;
  try {
    const liveDatabase = new Database(source, { readonly: true, fileMustExist: true });
    try {
      await liveDatabase.backup(snapshotPath);
    } finally {
      liveDatabase.close();
    }
    const snapshot = new Database(snapshotPath, { readonly: true, fileMustExist: true });
    try {
      if (snapshot.pragma('integrity_check', { simple: true }) !== 'ok') {
        throw new Error('Backup source integrity check failed.');
      }
      const tables = existingTables(snapshot);
      const tableMetadata: BackupTableMetadata[] = [];
      for (const name of BACKUP_TABLES) {
        if (!tables.has(name)) continue;
        const file = join(temporaryDirectory, `${name}.ndjson`);
        const exported = await exportTable(snapshot, name, file);
        tableMetadata.push({ name, file: tableFile(name), ...exported });
      }
      const metadata: BackupMetadata = {
        format: BACKUP_FORMAT,
        formatVersion: BACKUP_FORMAT_VERSION,
        appVersion,
        createdAt: new Date().toISOString(),
        tables: tableMetadata,
      };
      await writeZip(temporaryDirectory, metadata, temporaryTarget);
      await inspectBackupFile(temporaryTarget);
      renameSync(temporaryTarget, target);
      return metadata;
    } finally {
      snapshot.close();
    }
  } catch (error) {
    rmSync(temporaryTarget, { force: true });
    throw error;
  } finally {
    rmSync(temporaryDirectory, { recursive: true, force: true });
  }
}

function validateMetadata(value: unknown): BackupMetadata {
  if (!isRecord(value)) throw new Error('The backup manifest is invalid.');
  if (value.format !== BACKUP_FORMAT || value.formatVersion !== BACKUP_FORMAT_VERSION) {
    throw new Error('The backup format is unsupported.');
  }
  if (
    typeof value.appVersion !== 'string' ||
    !/^\d+\.\d+\.\d+(?:[-+].*)?$/.test(value.appVersion) ||
    typeof value.createdAt !== 'string' ||
    Number.isNaN(Date.parse(value.createdAt)) ||
    !Array.isArray(value.tables)
  ) {
    throw new Error('The backup manifest is invalid.');
  }
  const supportedTables = new Set<string>(BACKUP_TABLES);
  const names = new Set<string>();
  const tables = value.tables.map((table): BackupTableMetadata => {
    if (
      !isRecord(table) ||
      typeof table.name !== 'string' ||
      !supportedTables.has(table.name) ||
      names.has(table.name) ||
      table.file !== tableFile(table.name) ||
      !Number.isSafeInteger(table.rowCount) ||
      Number(table.rowCount) < 0 ||
      typeof table.sha256 !== 'string' ||
      !/^[0-9a-f]{64}$/.test(table.sha256)
    ) {
      throw new Error('The backup table manifest is invalid.');
    }
    names.add(table.name);
    return table as BackupTableMetadata;
  });
  if (!names.has('User') || !names.has('AppSettings')) {
    throw new Error('The backup is missing required application data.');
  }
  return { ...value, tables } as BackupMetadata;
}

async function readEntryLines(entry: unzipper.File, onRow?: (row: Record<string, unknown>) => void) {
  const hash = createHash('sha256');
  let pending = '';
  let rowCount = 0;
  for await (const rawChunk of entry.stream()) {
    const chunk = Buffer.isBuffer(rawChunk) ? rawChunk : Buffer.from(rawChunk);
    hash.update(chunk);
    pending += chunk.toString('utf8');
    let newline = pending.indexOf('\n');
    while (newline >= 0) {
      const line = pending.slice(0, newline);
      pending = pending.slice(newline + 1);
      if (!line) throw new Error('The backup contains an empty data row.');
      const row = JSON.parse(line) as unknown;
      if (!isRecord(row)) throw new Error('The backup contains an invalid data row.');
      onRow?.(row);
      rowCount += 1;
      newline = pending.indexOf('\n');
    }
  }
  if (pending) throw new Error('The backup data file is not newline terminated.');
  return { rowCount, sha256: hash.digest('hex') };
}

async function openArchive(path: string) {
  const descriptor = openSync(path, 'r');
  const headerBuffer = Buffer.alloc(4);
  try {
    readSync(descriptor, headerBuffer, 0, headerBuffer.length, 0);
  } finally {
    closeSync(descriptor);
  }
  const header = headerBuffer.toString('binary');
  if (header !== ZIP_HEADER) throw new Error('The file is not an ezPrint backup archive.');
  return unzipper.Open.file(path);
}

export async function inspectBackupFile(
  path: string,
  maxExpandedBytes = Number.MAX_SAFE_INTEGER,
): Promise<BackupMetadata> {
  const archive = await openArchive(path);
  const expandedBytes = archive.files.reduce((total, entry) => total + entry.uncompressedSize, 0);
  if (!Number.isSafeInteger(expandedBytes) || expandedBytes > maxExpandedBytes) {
    throw new Error('The expanded backup exceeds the configured size limit.');
  }
  const manifests = archive.files.filter((entry) => entry.path === 'manifest.json' && entry.type === 'File');
  if (manifests.length !== 1 || manifests[0]!.uncompressedSize > 1024 * 1024) {
    throw new Error('The backup manifest is missing or invalid.');
  }
  const metadata = validateMetadata(JSON.parse((await manifests[0]!.buffer()).toString('utf8')));
  const expectedFiles = new Set(['manifest.json', ...metadata.tables.map((table) => table.file)]);
  const actualFiles = archive.files.filter((entry) => entry.type === 'File').map((entry) => entry.path);
  if (actualFiles.length !== expectedFiles.size || actualFiles.some((file) => !expectedFiles.has(file))) {
    throw new Error('The backup contains unexpected files.');
  }
  for (const table of metadata.tables) {
    const entry = archive.files.find(
      (candidate) => candidate.path === table.file && candidate.type === 'File',
    );
    if (!entry) throw new Error(`The backup data file for ${table.name} is missing.`);
    const actual = await readEntryLines(entry);
    if (actual.rowCount !== table.rowCount || actual.sha256 !== table.sha256) {
      throw new Error(`The backup data file for ${table.name} failed verification.`);
    }
  }
  return metadata;
}

export async function importBackupFile(path: string, databasePath: string) {
  const metadata = await inspectBackupFile(path);
  const archive = await openArchive(path);
  const database = new Database(databasePath, { fileMustExist: true });
  database.pragma('foreign_keys = OFF');
  database.exec('BEGIN IMMEDIATE');
  try {
    const targetTables = existingTables(database);
    for (const name of [...BACKUP_TABLES, 'Session'].reverse()) {
      if (targetTables.has(name)) database.exec(`DELETE FROM ${quoteIdentifier(name)}`);
    }
    for (const table of metadata.tables) {
      if (!targetTables.has(table.name)) continue;
      const targetColumns = new Set(
        database
          .prepare(`PRAGMA table_info(${quoteIdentifier(table.name)})`)
          .all()
          .map((row) => (row as { name: string }).name),
      );
      const statements = new Map<string, Database.Statement>();
      const entry = archive.files.find((candidate) => candidate.path === table.file)!;
      await readEntryLines(entry, (row) => {
        const columns = Object.keys(row).filter((column) => targetColumns.has(column));
        if (!columns.length) return;
        const signature = columns.join('\0');
        let statement = statements.get(signature);
        if (!statement) {
          statement = database.prepare(
            `INSERT INTO ${quoteIdentifier(table.name)} (${columns.map(quoteIdentifier).join(', ')}) VALUES (${columns
              .map(() => '?')
              .join(', ')})`,
          );
          statements.set(signature, statement);
        }
        statement.run(...columns.map((column) => row[column]));
      });
    }
    const violations = database.pragma('foreign_key_check') as unknown[];
    if (violations.length) throw new Error('The restored data violates database relationships.');
    database.exec('COMMIT');
  } catch (error) {
    database.exec('ROLLBACK');
    throw error;
  } finally {
    database.pragma('foreign_keys = ON');
    database.close();
  }
  return metadata;
}

export function backupDownloadName(now = new Date()) {
  return `ezprint-backup-${now
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}Z$/, 'Z')}.ezprint-backup`;
}

export function backupReadStream(path: string) {
  return { stream: createReadStream(path), size: statSync(path).size };
}
