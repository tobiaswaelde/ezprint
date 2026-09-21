-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_BambuPrintLink" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "partId" TEXT NOT NULL,
    "printJobId" TEXT NOT NULL,
    "remoteLogId" INTEGER NOT NULL,
    "cachedJson" TEXT NOT NULL,
    "syncedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "error" TEXT,
    "importedJson" TEXT,
    "importedAt" DATETIME,
    CONSTRAINT "BambuPrintLink_partId_fkey" FOREIGN KEY ("partId") REFERENCES "PrintPart" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "BambuPrintLink_printJobId_fkey" FOREIGN KEY ("printJobId") REFERENCES "PrintJob" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_BambuPrintLink" ("partId", "cachedJson", "error", "id", "importedAt", "importedJson", "printJobId", "remoteLogId", "syncedAt") SELECT (SELECT "id" FROM "PrintPart" WHERE "PrintPart"."printJobId" = "BambuPrintLink"."printJobId" ORDER BY "position" LIMIT 1), "cachedJson", "error", "id", "importedAt", "importedJson", "printJobId", "remoteLogId", "syncedAt" FROM "BambuPrintLink";
DROP TABLE "BambuPrintLink";
ALTER TABLE "new_BambuPrintLink" RENAME TO "BambuPrintLink";
CREATE UNIQUE INDEX "BambuPrintLink_partId_key" ON "BambuPrintLink"("partId");
CREATE UNIQUE INDEX "BambuPrintLink_remoteLogId_key" ON "BambuPrintLink"("remoteLogId");
CREATE INDEX "BambuPrintLink_printJobId_idx" ON "BambuPrintLink"("printJobId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
