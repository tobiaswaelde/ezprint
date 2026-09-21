-- CreateTable
CREATE TABLE "PrintPart" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "printJobId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "printerId" TEXT NOT NULL,
    "totalDurationSeconds" INTEGER NOT NULL,
    "snapshotJson" TEXT,
    CONSTRAINT "PrintPart_printJobId_fkey" FOREIGN KEY ("printJobId") REFERENCES "PrintJob" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PrintPart_printerId_fkey" FOREIGN KEY ("printerId") REFERENCES "Printer" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- Preserve historical snapshots and usage IDs. Legacy parts read their unchanged parent snapshot.
INSERT INTO "PrintPart" ("id", "printJobId", "position", "printerId", "totalDurationSeconds")
SELECT 'part:' || "id", "id", 0, "printerId", "totalDurationSeconds" FROM "PrintJob";

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_PrintComponentUsage" (
    "partId" TEXT NOT NULL,
    "id" TEXT NOT NULL PRIMARY KEY,
    "printJobId" TEXT NOT NULL,
    "componentId" TEXT NOT NULL,
    "componentType" TEXT NOT NULL,
    "componentName" TEXT NOT NULL,
    "purchasePrice" DECIMAL NOT NULL,
    "expectedLifetimeHours" DECIMAL NOT NULL,
    "hourlyRate" DECIMAL NOT NULL,
    "appliedDurationSeconds" INTEGER NOT NULL,
    "lineCost" DECIMAL NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PrintComponentUsage_partId_fkey" FOREIGN KEY ("partId") REFERENCES "PrintPart" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PrintComponentUsage_printJobId_fkey" FOREIGN KEY ("printJobId") REFERENCES "PrintJob" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PrintComponentUsage_componentId_fkey" FOREIGN KEY ("componentId") REFERENCES "Component" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_PrintComponentUsage" ("partId", "appliedDurationSeconds", "componentId", "componentName", "componentType", "createdAt", "expectedLifetimeHours", "hourlyRate", "id", "lineCost", "printJobId", "purchasePrice") SELECT 'part:' || "printJobId", "appliedDurationSeconds", "componentId", "componentName", "componentType", "createdAt", "expectedLifetimeHours", "hourlyRate", "id", "lineCost", "printJobId", "purchasePrice" FROM "PrintComponentUsage";
DROP TABLE "PrintComponentUsage";
ALTER TABLE "new_PrintComponentUsage" RENAME TO "PrintComponentUsage";
CREATE INDEX "PrintComponentUsage_printJobId_idx" ON "PrintComponentUsage"("printJobId");
CREATE INDEX "PrintComponentUsage_componentId_idx" ON "PrintComponentUsage"("componentId");
CREATE TABLE "new_PrintFilamentUsage" (
    "partId" TEXT NOT NULL,
    "id" TEXT NOT NULL PRIMARY KEY,
    "printJobId" TEXT NOT NULL,
    "spoolId" TEXT,
    "spoolCode" TEXT,
    "filamentId" TEXT NOT NULL,
    "filamentName" TEXT NOT NULL,
    "manufacturer" TEXT NOT NULL,
    "material" TEXT NOT NULL,
    "purchasePrice" DECIMAL NOT NULL,
    "netWeightGrams" DECIMAL NOT NULL,
    "costPerGram" DECIMAL NOT NULL,
    "usedGrams" DECIMAL NOT NULL,
    "lineCost" DECIMAL NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PrintFilamentUsage_partId_fkey" FOREIGN KEY ("partId") REFERENCES "PrintPart" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PrintFilamentUsage_printJobId_fkey" FOREIGN KEY ("printJobId") REFERENCES "PrintJob" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PrintFilamentUsage_spoolId_fkey" FOREIGN KEY ("spoolId") REFERENCES "Spool" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "PrintFilamentUsage_filamentId_fkey" FOREIGN KEY ("filamentId") REFERENCES "Filament" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_PrintFilamentUsage" ("partId", "costPerGram", "createdAt", "filamentId", "filamentName", "id", "lineCost", "manufacturer", "material", "netWeightGrams", "printJobId", "purchasePrice", "spoolCode", "spoolId", "usedGrams") SELECT 'part:' || "printJobId", "costPerGram", "createdAt", "filamentId", "filamentName", "id", "lineCost", "manufacturer", "material", "netWeightGrams", "printJobId", "purchasePrice", "spoolCode", "spoolId", "usedGrams" FROM "PrintFilamentUsage";
DROP TABLE "PrintFilamentUsage";
ALTER TABLE "new_PrintFilamentUsage" RENAME TO "PrintFilamentUsage";
CREATE INDEX "PrintFilamentUsage_printJobId_idx" ON "PrintFilamentUsage"("printJobId");
CREATE INDEX "PrintFilamentUsage_filamentId_idx" ON "PrintFilamentUsage"("filamentId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "PrintPart_printerId_idx" ON "PrintPart"("printerId");

-- CreateIndex
CREATE UNIQUE INDEX "PrintPart_printJobId_position_key" ON "PrintPart"("printJobId", "position");
