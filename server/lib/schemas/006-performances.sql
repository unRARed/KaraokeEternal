-- Up
CREATE TABLE IF NOT EXISTS "performances" (
  "performanceId" integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  "roomId" integer NOT NULL,
  "userId" integer NOT NULL,
  "songId" integer NOT NULL,
  "datePerformed" integer NOT NULL
);

CREATE INDEX IF NOT EXISTS idxPerformancesRoom ON "performances" ("roomId", "datePerformed");

ALTER TABLE queue ADD COLUMN "isPinned" integer NOT NULL DEFAULT 0;

-- Down
DROP TABLE IF EXISTS performances;

ALTER TABLE queue DROP COLUMN isPinned;
