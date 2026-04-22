import { config } from "dotenv";

config({ path: ".env.local" });

const { GROQ_API_KEY, GROQ_MODEL = "llama-3.3-70b-versatile" } = process.env;

console.log("Key:       ", GROQ_API_KEY ? `${GROQ_API_KEY.slice(0, 10)}...${GROQ_API_KEY.slice(-4)}` : "MISSING");
console.log("Key length:", GROQ_API_KEY?.length ?? 0);
console.log("Model:     ", GROQ_MODEL);
console.log("");

async function main() {
  if (!GROQ_API_KEY) {
    console.error("❌ GROQ_API_KEY missing in .env.local");
    process.exit(1);
  }

  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${GROQ_API_KEY}`,
    },
    body: JSON.stringify({
      model: GROQ_MODEL,
      messages: [{ role: "user", content: "say hi in 3 words" }],
      max_tokens: 20,
    }),
  });

  console.log("Status:", res.status, res.statusText);
  const body = await res.text();
  console.log("Body:  ", body);
}

main().catch((e) => console.error("Fatal:", e));
