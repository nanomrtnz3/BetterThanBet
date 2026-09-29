import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { get, put } from "@vercel/blob";

export const maxDuration = 60;

const DATA_DIR = "/tmp/betterthanbet";
const STORED = ["snapshot.json", "leagues.json", "quota.json", "football.xml"];

function allowed(request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

async function pull(name, dest) {
  try {
    const stored = await get(name, { access: "private" });
    if (!stored?.stream) return;
    const bytes = Buffer.from(await new Response(stored.stream).arrayBuffer());
    await writeFile(dest, bytes);
  } catch {
    // La primera vez todavía no hay copia en el almacén.
  }
}

async function push(name, filePath, contentType) {
  const body = await readFile(filePath);
  await put(name, body, {
    access: "private",
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType,
  });
}

export async function GET(request) {
  return run(request);
}

export async function POST(request) {
  return run(request);
}

async function run(request) {
  if (!allowed(request)) {
    return new Response("No autorizado", { status: 401 });
  }
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return new Response("Falta el almacén de datos", { status: 500 });
  }
  if (!process.env.BZZOIRO_API_KEY) {
    return new Response("Falta BZZOIRO_API_KEY", { status: 500 });
  }

  const dataDir = join(DATA_DIR, "data");
  await mkdir(dataDir, { recursive: true });
  for (const name of STORED) await pull(name, join(dataDir, name));

  process.env.DATA_DIR = DATA_DIR;
  const { syncOnce } = await import("../tools/sync-cache.mjs");
  const result = await syncOnce();

  await push("football.xml", join(dataDir, "football.xml"), "application/xml");
  for (const name of ["snapshot.json", "leagues.json", "quota.json"]) {
    try {
      await push(name, join(dataDir, name), "application/json");
    } catch {
      // Si un auxiliar no existe, el XML ya publicado sigue valiendo.
    }
  }

  return Response.json({ ok: true, wrote: Boolean(result?.wrote) });
}
