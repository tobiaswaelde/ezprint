import { syncBambuPrinter, syncBambuPrint } from '../services/bambubuddy';
import { db } from '../utils/db';
import { integrationConfigured } from '../utils/integrations/http';
import { reconcileSpoolOperation, syncSpoolman } from '../services/spoolman';
export default defineNitroPlugin((nitro) => {
  let running = false;
  const timer = setInterval(async () => {
    if (running) return;
    running = true;
    try {
      if (await integrationConfigured('SPOOLMAN')) {
        const spools = await db.spool.findMany({
          where: { stockAuthority: { not: 'NATIVE' } },
          orderBy: { updatedAt: 'asc' },
          take: 10,
        });
        for (const spool of spools) await syncSpoolman(spool.id);
        const operations = await db.spoolSyncOperation.findMany({
          where: { state: 'PENDING' },
          orderBy: { createdAt: 'asc' },
          take: 5,
        });
        for (const operation of operations)
          await reconcileSpoolOperation({ operationId: operation.id, action: 'SEND' });
      }
      if (await integrationConfigured('BAMBUBUDDY')) {
        const printers = await db.printer.findMany({
          where: { bambuId: { not: null } },
          orderBy: { updatedAt: 'asc' },
          take: 5,
        });
        for (const printer of printers) await syncBambuPrinter(printer.id);
        const links = await db.bambuPrintLink.findMany({
          where: { importedAt: null },
          orderBy: { syncedAt: 'asc' },
          take: 5,
        });
        for (const link of links) await syncBambuPrint(link.printJobId, link.partId);
      }
    } catch {
      /* Errors remain in integration state; polling must not crash manual workflows. */
    } finally {
      running = false;
    }
  }, 60000);
  timer.unref();
  nitro.hooks.hook('close', () => clearInterval(timer));
});
