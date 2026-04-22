import { NextResponse } from "next/server";
import fs from "node:fs/promises";
import path from "node:path";
import { parse } from "csv-parse/sync";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALLOWED_FILES = new Set([
  "tracks.csv",
  "artists.csv",
  "albums.csv",
  "genres.csv",
  "rel_performed_by.csv",
  "rel_belongs_to.csv",
  "rel_has_genre.csv",
]);

const PREVIEW_ROWS = 25;
const READ_BYTES = 128_000;

function countLines(buffer: Buffer): number {
  let count = 0;
  for (let i = 0; i < buffer.length; i++) {
    if (buffer[i] === 0x0a) count++;
  }
  return count;
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const file = searchParams.get("file") ?? "";

  if (!ALLOWED_FILES.has(file)) {
    return NextResponse.json(
      { error: `Unknown file '${file}'.` },
      { status: 400 }
    );
  }

  const filePath = path.join(/*turbopackIgnore: true*/ process.cwd(), file);

  let stat;
  try {
    stat = await fs.stat(filePath);
  } catch {
    return NextResponse.json(
      {
        error: `${file} not found.`,
        file,
        exists: false,
      },
      { status: 404 }
    );
  }

  const fd = await fs.open(filePath, "r");
  try {
    const bufToReadHead = Buffer.alloc(Math.min(READ_BYTES, stat.size));
    await fd.read(bufToReadHead, 0, bufToReadHead.length, 0);

    const headText = bufToReadHead.toString("utf-8");
    const lastNewlineIdx = headText.lastIndexOf("\n");
    const cleanHead =
      lastNewlineIdx >= 0 ? headText.slice(0, lastNewlineIdx) : headText;

    const parsed = parse(cleanHead, {
      columns: true,
      skip_empty_lines: true,
      relax_quotes: true,
      relax_column_count: true,
    }) as Record<string, string>[];

    const rows = parsed.slice(0, PREVIEW_ROWS);
    const columns = rows.length > 0 ? Object.keys(rows[0]) : [];

    let totalRows: number | null = null;
    if (stat.size <= 25_000_000) {
      const whole = await fs.readFile(filePath);
      const lines = countLines(whole);
      totalRows = Math.max(0, lines - 1);
    }

    return NextResponse.json({
      file,
      exists: true,
      sizeBytes: stat.size,
      columns,
      rows,
      totalRows,
      previewCount: rows.length,
      modifiedAt: stat.mtime.toISOString(),
    });
  } finally {
    await fd.close();
  }
}
