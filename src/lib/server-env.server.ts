import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

let merged: Record<string, string | undefined> | null = null;

function parseDotEnv(content: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    out[key] = val;
  }
  return out;
}

function loadEnvFiles(): Record<string, string> {
  const mode = process.env.NODE_ENV === "production" ? "production" : "development";
  const cwd = process.cwd();
  const files = [".env", ".env.local", `.env.${mode}`, `.env.${mode}.local`];
  const out: Record<string, string> = {};
  for (const file of files) {
    const path = resolve(cwd, file);
    if (!existsSync(path)) continue;
    try {
      Object.assign(out, parseDotEnv(readFileSync(path, "utf8")));
    } catch {
      // Ignore unreadable env files.
    }
  }
  return out;
}

/** Merge process.env with local .env files (dev server often only loads via files). */
function getEnv(): Record<string, string | undefined> {
  if (merged) return merged;
  let fromFiles: Record<string, string> = {};
  try {
    fromFiles = loadEnvFiles();
  } catch {
    // Outside Node context — rely on process.env only.
  }
  merged = { ...fromFiles, ...process.env };
  return merged;
}

export function serverEnv(name: string): string | undefined {
  const raw = getEnv()[name];
  if (typeof raw !== "string") return undefined;
  const trimmed = raw.trim();
  return trimmed || undefined;
}

export function requireServerEnv(name: string, hint?: string): string {
  const value = serverEnv(name);
  if (value) return value;
  throw new Error(
    hint ??
      `Missing ${name}. Add it to .env locally, or set it in Lovable Cloud secrets / VPS environment for production.`,
  );
}
