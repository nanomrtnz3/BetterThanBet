import { contraryIds, twinIds } from "./quotes.mjs?v=2";

const KEY = "btb-slip";

export function readSlip() {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || "[]");
    return Array.isArray(raw) ? raw.filter((id) => typeof id === "string") : [];
  } catch {
    return [];
  }
}

export function writeSlip(ids) {
  const unique = [...new Set(ids)].slice(0, 12);
  localStorage.setItem(KEY, JSON.stringify(unique));
  return unique;
}

export function addSlip(id) {
  return writeSlip([...readSlip(), id]);
}

export function removeSlip(id) {
  return writeSlip(readSlip().filter((item) => item !== id));
}

export function takePick(ids, id) {
  const rivals = contraryIds(id);
  const replaced = rivals.some((other) => ids.includes(other));
  const drop = new Set([...rivals, ...twinIds(id)]);
  const next = writeSlip([...ids.filter((item) => item !== id && !drop.has(item)), id]);
  return { ids: next, replaced, added: next.includes(id) };
}
