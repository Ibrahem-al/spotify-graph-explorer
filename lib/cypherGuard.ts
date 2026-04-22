const DENY_CLAUSES = [
  "CREATE",
  "MERGE",
  "DELETE",
  "DETACH",
  "SET",
  "REMOVE",
  "DROP",
  "LOAD",
  "FOREACH",
];

const DENY_PATTERNS = [
  /\bCALL\s*\{[^}]*\}\s*IN\s+TRANSACTIONS\b/i,
  /\bapoc\.(?!meta\.schema\b)\w+/i,
  /\bdbms\.\w+/i,
  /\bdb\.index\.fulltext\.create\w*/i,
];

export type GuardResult =
  | { ok: true; cypher: string }
  | { ok: false; reason: string };

function stripCommentsAndStrings(raw: string): string {
  return raw
    .replace(/\/\/[^\n]*/g, " ")
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/'[^']*'|"[^"]*"|`[^`]*`/g, '""');
}

export function guardCypher(raw: string): GuardResult {
  const stripped = stripCommentsAndStrings(raw);

  for (const clause of DENY_CLAUSES) {
    if (new RegExp(`\\b${clause}\\b`, "i").test(stripped)) {
      return { ok: false, reason: `Write clause '${clause}' is not allowed.` };
    }
  }

  for (const pat of DENY_PATTERNS) {
    if (pat.test(stripped)) {
      return { ok: false, reason: `Denied pattern matched: ${pat.source}` };
    }
  }

  let cypher = raw.trim().replace(/;\s*$/, "");

  const hasLimit = /\bLIMIT\s+\d+/i.test(cypher);
  const hasAggregation = /\b(count|avg|sum|min|max|collect)\s*\(/i.test(cypher);
  if (!hasLimit && !hasAggregation) {
    cypher += "\nLIMIT 500";
  }

  return { ok: true, cypher };
}
