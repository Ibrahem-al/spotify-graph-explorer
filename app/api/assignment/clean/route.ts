import { NextResponse } from "next/server";
import { spawn } from "node:child_process";
import path from "node:path";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_OUTPUT_BYTES = 256_000;
const TIMEOUT_MS = 120_000;

type PythonAttempt = { cmd: string; args: string[] };

const PYTHON_CANDIDATES: PythonAttempt[] =
  process.platform === "win32"
    ? [
        { cmd: "python", args: [] },
        { cmd: "py", args: ["-3"] },
        { cmd: "python3", args: [] },
      ]
    : [
        { cmd: "python3", args: [] },
        { cmd: "python", args: [] },
      ];

interface RunResult {
  ok: boolean;
  stdout: string;
  stderr: string;
  exitCode: number | null;
  durationMs: number;
  usedCommand: string;
  truncated: boolean;
  timedOut: boolean;
}

function runPython(attempt: PythonAttempt, scriptPath: string, cwd: string): Promise<RunResult> {
  return new Promise((resolve) => {
    const started = performance.now();
    const child = spawn(attempt.cmd, [...attempt.args, "-u", scriptPath], {
      cwd,
      env: {
        ...process.env,
        PYTHONIOENCODING: "utf-8",
        PYTHONUNBUFFERED: "1",
      },
      windowsHide: true,
    });

    let stdout = "";
    let stderr = "";
    let truncated = false;
    let timedOut = false;
    let settled = false;

    const killTimer = setTimeout(() => {
      timedOut = true;
      try {
        child.kill("SIGKILL");
      } catch {
        /* ignore */
      }
    }, TIMEOUT_MS);

    child.stdout.on("data", (chunk: Buffer) => {
      if (stdout.length >= MAX_OUTPUT_BYTES) {
        truncated = true;
        return;
      }
      stdout += chunk.toString("utf-8");
      if (stdout.length > MAX_OUTPUT_BYTES) {
        stdout = stdout.slice(0, MAX_OUTPUT_BYTES);
        truncated = true;
      }
    });

    child.stderr.on("data", (chunk: Buffer) => {
      if (stderr.length >= MAX_OUTPUT_BYTES) {
        truncated = true;
        return;
      }
      stderr += chunk.toString("utf-8");
      if (stderr.length > MAX_OUTPUT_BYTES) {
        stderr = stderr.slice(0, MAX_OUTPUT_BYTES);
        truncated = true;
      }
    });

    child.on("error", (err: NodeJS.ErrnoException) => {
      if (settled) return;
      settled = true;
      clearTimeout(killTimer);
      resolve({
        ok: false,
        stdout,
        stderr: stderr + `\n[spawn error: ${err.message}${err.code ? ` (${err.code})` : ""}]`,
        exitCode: null,
        durationMs: Math.round(performance.now() - started),
        usedCommand: `${attempt.cmd} ${attempt.args.join(" ")}`.trim(),
        truncated,
        timedOut,
      });
    });

    child.on("close", (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(killTimer);
      resolve({
        ok: !timedOut && code === 0,
        stdout,
        stderr,
        exitCode: code,
        durationMs: Math.round(performance.now() - started),
        usedCommand: `${attempt.cmd} ${attempt.args.join(" ")}`.trim(),
        truncated,
        timedOut,
      });
    });
  });
}

export async function POST() {
  const cwd = process.cwd();
  const scriptPath = path.join(cwd, "cleaning.py");

  let lastError = "";
  for (const attempt of PYTHON_CANDIDATES) {
    const res = await runPython(attempt, scriptPath, cwd);

    // If the command isn't found on this platform, try the next candidate.
    const looksLikeNotFound =
      !res.ok &&
      res.exitCode === null &&
      /ENOENT|is not recognized|cannot find|not found/i.test(res.stderr);

    if (looksLikeNotFound) {
      lastError = res.stderr;
      continue;
    }

    return NextResponse.json({
      ...res,
      scriptPath,
    });
  }

  return NextResponse.json(
    {
      ok: false,
      stdout: "",
      stderr:
        "Could not find a Python interpreter on PATH. " +
        "Install Python 3 and make sure `python` or `py` is available, then try again.\n\n" +
        `Last error:\n${lastError}`,
      exitCode: null,
      durationMs: 0,
      usedCommand: "",
      truncated: false,
      timedOut: false,
      scriptPath,
    },
    { status: 500 }
  );
}

export async function GET() {
  return NextResponse.json({
    scriptPath: path.join(process.cwd(), "cleaning.py"),
    hint: "POST to execute cleaning.py locally.",
  });
}
