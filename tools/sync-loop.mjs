/**
 * Repite el sync cada SYNC_EVERY_MINUTES (15 por defecto).
 * Un ciclo no empieza si el anterior sigue en marcha.
 *
 *   node tools/sync-loop.mjs
 */
import { syncOnce } from "./sync-cache.mjs";
import { loadEnv } from "./env.mjs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
await loadEnv(root);

const minutes = Number(process.env.SYNC_EVERY_MINUTES || 15);
let running = false;

async function tick() {
  if (running) {
    console.log("El sync anterior sigue en marcha; se salta este turno.");
    return;
  }
  running = true;
  try {
    await syncOnce();
  } catch (error) {
    console.error(error.message || error);
  } finally {
    running = false;
  }
}

console.log(`Sync cada ${minutes} min. La página lee solo data/football.xml.`);
await tick();
setInterval(tick, minutes * 60 * 1000);
