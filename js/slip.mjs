import { contraryIds, incompatibleIds, twinIds } from "./quotes.mjs?v=4";

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
  const base = ids.filter((item) => item !== id && !drop.has(item));
  const logic = incompatibleIds(base, id);
  const blocked = new Set(logic);
  const next = writeSlip([...base.filter((item) => !blocked.has(item)), id]);
  return { ids: next, replaced: replaced || logic.length > 0, logic: logic.length > 0, added: next.includes(id) };
}

export function pickToast(result) {
  if (!result.added) return "La combinada admite 12 cuotas.";
  if (result.logic) return "Se quitaron cuotas que no encajan con esta.";
  if (result.replaced) return "Se sustituyó la cuota contraria.";
  return "Añadida a la combinada.";
}
