import neo4j from "neo4j-driver";
import { config } from "dotenv";

config({ path: ".env.local" });

const { NEO4J_URI, NEO4J_USER = "neo4j", NEO4J_PASSWORD, NEO4J_DATABASE = "neo4j" } = process.env;

console.log("URI:     ", NEO4J_URI);
console.log("User:    ", NEO4J_USER);
console.log("Password:", NEO4J_PASSWORD ? `***${NEO4J_PASSWORD.slice(-3)}` : "MISSING");
console.log("Database:", NEO4J_DATABASE);
console.log("");

async function main() {
  if (!NEO4J_URI || !NEO4J_PASSWORD) {
    console.error("❌ Missing NEO4J_URI or NEO4J_PASSWORD in .env.local");
    process.exit(1);
  }

  const driver = neo4j.driver(NEO4J_URI, neo4j.auth.basic(NEO4J_USER, NEO4J_PASSWORD));

  try {
    console.log("Connecting...");
    await driver.verifyConnectivity();
    console.log("✅ Connected successfully!");

    const session = driver.session({ database: NEO4J_DATABASE });
    const result = await session.run("RETURN 1 AS n");
    console.log("✅ Query OK:", result.records[0].get("n").toNumber());
    await session.close();
  } catch (e) {
    console.error("❌ Connection failed:");
    console.error((e as Error).message);
  } finally {
    await driver.close();
  }
}

main();
