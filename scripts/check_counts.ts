import neo4j from "neo4j-driver";
import { config } from "dotenv";

config({ path: ".env.local" });

async function main() {
  const { NEO4J_URI, NEO4J_USER, NEO4J_PASSWORD, NEO4J_DATABASE } = process.env;
  if (!NEO4J_URI || !NEO4J_USER || !NEO4J_PASSWORD) {
    console.error("Missing env vars");
    process.exit(1);
  }
  const driver = neo4j.driver(
    NEO4J_URI,
    neo4j.auth.basic(NEO4J_USER, NEO4J_PASSWORD)
  );
  const session = driver.session({ database: NEO4J_DATABASE ?? "neo4j" });
  try {
    const queries = [
      ["Tracks", "MATCH (t:Track) RETURN count(t) AS n"],
      ["Artists", "MATCH (a:Artist) RETURN count(a) AS n"],
      ["Albums", "MATCH (al:Album) RETURN count(al) AS n"],
      ["Genres", "MATCH (g:Genre) RETURN count(g) AS n"],
      ["PERFORMED_BY", "MATCH ()-[r:PERFORMED_BY]->() RETURN count(r) AS n"],
      ["BELONGS_TO", "MATCH ()-[r:BELONGS_TO]->() RETURN count(r) AS n"],
      ["HAS_GENRE", "MATCH ()-[r:HAS_GENRE]->() RETURN count(r) AS n"],
    ];
    console.log("Current counts:");
    for (const [label, cy] of queries) {
      const res = await session.run(cy);
      const n = res.records[0]?.get("n");
      const count = typeof n === "object" && n !== null && "toNumber" in n ? (n as { toNumber: () => number }).toNumber() : n;
      console.log(`  ${label.padEnd(14)} ${count}`);
    }
  } finally {
    await session.close();
    await driver.close();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
