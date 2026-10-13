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
