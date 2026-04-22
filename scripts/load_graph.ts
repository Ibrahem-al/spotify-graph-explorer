import { parse } from "csv-parse";
import { createReadStream } from "fs";
import neo4j, { Session } from "neo4j-driver";
import { config } from "dotenv";

config({ path: ".env.local" });

const {
  NEO4J_URI,
  NEO4J_USER = "neo4j",
  NEO4J_PASSWORD,
  NEO4J_DATABASE = "neo4j",
} = process.env;

if (!NEO4J_URI || !NEO4J_PASSWORD) {
  console.error("❌  NEO4J_URI and NEO4J_PASSWORD must be set in .env.local");
  process.exit(1);
}

async function* batches(
  path: string,
  size = 5000
): AsyncGenerator<Record<string, string>[]> {
  const parser = createReadStream(path).pipe(
    parse({ columns: true, trim: true, skip_empty_lines: true })
  );
  let batch: Record<string, string>[] = [];
  for await (const row of parser) {
    batch.push(row);
    if (batch.length >= size) {
      yield batch;
      batch = [];
    }
  }
  if (batch.length) yield batch;
}

async function runBatches(
  session: Session,
  path: string,
  cypher: string,
  label: string
) {
  let total = 0;
  for await (const rows of batches(path)) {
    await session.executeWrite((tx) => tx.run(cypher, { rows }));
    total += rows.length;
    process.stdout.write(`\r  ${label}: ${total.toLocaleString()} rows`);
  }
  process.stdout.write("\n");
}

async function main() {
  console.log("🔌  Connecting to Neo4j Aura…");
  const driver = neo4j.driver(
    NEO4J_URI!,
    neo4j.auth.basic(NEO4J_USER, NEO4J_PASSWORD!)
  );

  try {
    await driver.verifyConnectivity();
    console.log("✅  Connected.");
  } catch (e) {
    console.error("❌  Cannot connect to Neo4j:", (e as Error).message);
    await driver.close();
    process.exit(1);
  }

  const session = driver.session({ database: NEO4J_DATABASE });

  try {
    console.log("\n📐  Creating constraints…");
    for (const stmt of [
      "CREATE CONSTRAINT track_id_unique IF NOT EXISTS FOR (t:Track) REQUIRE t.track_id IS UNIQUE",
      "CREATE CONSTRAINT artist_name_unique IF NOT EXISTS FOR (a:Artist) REQUIRE a.name IS UNIQUE",
      "CREATE CONSTRAINT album_name_unique IF NOT EXISTS FOR (al:Album) REQUIRE al.name IS UNIQUE",
      "CREATE CONSTRAINT genre_name_unique IF NOT EXISTS FOR (g:Genre) REQUIRE g.name IS UNIQUE",
    ]) {
      await session.run(stmt);
    }
    console.log("   Done.");

    console.log("\n📦  Loading nodes…");

    await runBatches(
      session,
      "tracks.csv",
      `UNWIND $rows AS row
       MERGE (t:Track { track_id: row.track_id })
       SET t.track_name   = row.track_name,
           t.popularity   = toInteger(row.popularity),
           t.danceability = toFloat(row.danceability),
           t.valence      = toFloat(row.valence),
           t.acousticness = toFloat(row.acousticness)`,
      "Tracks"
    );

    await runBatches(
      session,
      "artists.csv",
      `UNWIND $rows AS row
       WITH row WHERE row.name IS NOT NULL AND trim(row.name) <> ""
       MERGE (:Artist { name: trim(row.name) })`,
      "Artists"
    );

    await runBatches(
      session,
      "albums.csv",
      `UNWIND $rows AS row
       WITH row WHERE row.name IS NOT NULL AND trim(row.name) <> ""
       MERGE (:Album { name: trim(row.name) })`,
      "Albums"
    );

    await runBatches(
      session,
      "genres.csv",
      `UNWIND $rows AS row
       WITH row WHERE row.name IS NOT NULL AND trim(row.name) <> ""
       MERGE (:Genre { name: trim(row.name) })`,
      "Genres"
    );

    console.log("\n🔗  Loading relationships…");

    await runBatches(
      session,
      "rel_performed_by.csv",
      `UNWIND $rows AS row
       MATCH (t:Track { track_id: row.track_id })
       MATCH (a:Artist { name: trim(row.artist_name) })
       MERGE (t)-[:PERFORMED_BY]->(a)`,
      "PERFORMED_BY"
    );

    await runBatches(
      session,
      "rel_belongs_to.csv",
      `UNWIND $rows AS row
       MATCH (t:Track { track_id: row.track_id })
       MATCH (al:Album { name: trim(row.album_name) })
       MERGE (t)-[:BELONGS_TO]->(al)`,
      "BELONGS_TO"
    );

    await runBatches(
      session,
      "rel_has_genre.csv",
      `UNWIND $rows AS row
       MATCH (t:Track { track_id: row.track_id })
       MATCH (g:Genre { name: trim(row.track_genre) })
       MERGE (t)-[:HAS_GENRE]->(g)`,
      "HAS_GENRE"
    );

    console.log("\n✅  Graph load complete!");
    console.log("\n📊  Run these in Aura Browser to verify:");
    console.log("   MATCH (t:Track) RETURN count(t)               → ~89,740");
    console.log("   MATCH (a:Artist) RETURN count(a)              → ~29,857");
    console.log("   MATCH (al:Album) RETURN count(al)             → ~46,588");
    console.log("   MATCH (g:Genre) RETURN count(g)               → 113");
    console.log("   MATCH ()-[r:PERFORMED_BY]->() RETURN count(r) → ~123,423");
  } finally {
    await session.close();
    await driver.close();
  }
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
