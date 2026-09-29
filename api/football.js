import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { get } from "@vercel/blob";

async function latestXml() {
  if (!process.env.BLOB_READ_WRITE_TOKEN) return null;
  try {
    const stored = await get("football.xml", { access: "private" });
    if (!stored?.stream) return null;
    return Buffer.from(await new Response(stored.stream).arrayBuffer());
  } catch {
    return null;
  }
}

export async function GET() {
  const fresh = await latestXml();
  const body = fresh || (await readFile(join(process.cwd(), "data", "football.xml")));
  return new Response(body, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=30",
    },
  });
}
