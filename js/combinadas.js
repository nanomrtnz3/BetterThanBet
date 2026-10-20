import { FIXTURES, resolveLeg, searchBlob, dayKey, dayLabel, hourLabel } from "./demo.mjs";
import { quotePanel, resolveQuote } from "./quotes.mjs?v=4";
import { pickToast, readSlip, removeSlip, takePick, writeSlip } from "./slip.mjs?v=4";

const slipEl = document.querySelector("#slip");
const board = document.querySelector("#board");
const query = document.querySelector("#q");
const count = document.querySelector("#count");
const notice = document.querySelector("#notice");
const openId = { current: null };
const openDay = { current: null };

function legOf(id) {
  return resolveQuote(id) || resolveLeg(id);
}

function idsFromHash() {
  const raw = decodeURIComponent(location.hash.slice(1));
  if (!raw) return null;
  return raw.split(",").map((id) => id.trim()).filter(Boolean);
}

let ids = idsFromHash() || readSlip();
writeSlip(ids);

function syncHash() {
  const next = ids.length ? `#${encodeURIComponent(ids.join(","))}` : location.pathname;
  history.replaceState(null, "", ids.length ? `${location.pathname}${location.search}#${encodeURIComponent(ids.join(","))}` : location.pathname);
  return next;
}

function legs() {
  return ids.map((id) => legOf(id)).filter(Boolean);
}

function combined(rows) {
  const odd = rows.reduce((total, leg) => total * leg.odd, 1);
  const hit = rows.reduce((total, leg) => total * (leg.hit / 100), 1);
  return { odd, hit };
}

function formatHit(probability) {
  const pct = probability * 100;
  if (pct < 1) return `${pct.toFixed(2)}%`;
  if (pct < 10) return `${pct.toFixed(1)}%`;
  return `${Math.round(pct)}%`;
}

function summary(rows) {
  const { odd, hit } = combined(rows);
  const lines = rows.map((leg) => `${leg.title} (${leg.odd.toFixed(2)})`);
  return `Combinada BetterThanBet\n${lines.join("\n")}\nCuota ${odd.toFixed(2)} · acierto ${formatHit(hit)}\n${location.href}`;
}

function toast(message) {
  notice.textContent = message;
}

function renderSlip() {
  ids = ids.filter((id) => legOf(id));
  writeSlip(ids);
  syncHash();
  const rows = legs();
  if (!rows.length) {
    slipEl.innerHTML = `<p class="sub">Todavía no has añadido ninguna cuota. Abre un partido y pulsa la que quieras.</p>`;
    return;
  }
  const { odd, hit } = combined(rows);
  slipEl.innerHTML = `
    <div class="slip-totals">
      <div><small>Cuota combinada</small><b>${odd.toFixed(2)}</b></div>
      <div><small>Acierto</small><b>${formatHit(hit)}</b></div>
    </div>
    <ul class="slip-legs">
      ${rows.map((leg) => `<li><div><strong>${leg.title}</strong><span>${leg.detail} · cuota ${leg.odd.toFixed(2)} · ${leg.hit}% </span></div><button type="button" class="text-btn" data-remove="${leg.id}">Quitar</button></li>`).join("")}
    </ul>
    <p class="sub">El porcentaje multiplica el acierto de cada cuota, como si fueran independientes. Es un cálculo de ejemplo, no una recomendación.</p>
    <div class="slip-actions">
      <button type="button" id="copy">Copiar enlace</button>
      <button type="button" id="photo">Compartir foto</button>
      <button type="button" id="whatsapp">WhatsApp</button>
    </div>`;
  slipEl.querySelector("#copy").addEventListener("click", copyLink);
  slipEl.querySelector("#photo").addEventListener("click", sharePhoto);
  slipEl.querySelector("#whatsapp").addEventListener("click", shareWhatsApp);
}

function renderBoard() {
  const text = query.value.trim().toLocaleLowerCase("es");
  const rows = FIXTURES.filter((match) => !text || searchBlob(match).toLocaleLowerCase("es").includes(text));
  count.textContent = `${rows.length} partidos`;
  if (!rows.length) {
    board.innerHTML = `<p class="empty">Ningún partido coincide con la búsqueda.</p>`;
    return;
  }
  const groups = [];
  for (const match of rows) {
    const day = dayLabel(match.kickoff);
    let bucket = groups.find((item) => item.day === day);
    if (!bucket) {
      bucket = { day, key: dayKey(match.kickoff), comps: [] };
      groups.push(bucket);
    }
    let comp = bucket.comps.find((item) => item.name === match.league);
    if (!comp) {
      comp = { name: match.league, matches: [] };
      bucket.comps.push(comp);
    }
    comp.matches.push(match);
  }
  board.innerHTML = groups.map((bucket) => {
    const total = bucket.comps.reduce((sum, comp) => sum + comp.matches.length, 0);
    const holdsOpenMatch = bucket.comps.some((comp) => comp.matches.some((match) => match.id === openId.current));
    const open = text || holdsOpenMatch || bucket.key === openDay.current ? " open" : "";
    const noun = total === 1 ? "partido" : "partidos";
    return `<details class="day fold" data-day="${bucket.key}"${open}><summary><span>${bucket.day}</span><small>${total} ${noun}</small></summary>${bucket.comps.map((comp) => `<h3 class="comp">${comp.name}</h3>${comp.matches.map((match) => {
      const expanded = openId.current === match.id;
      return `<button class="fixture" type="button" data-id="${match.id}" aria-expanded="${expanded}"><strong>${match.home} vs ${match.away}</strong><time>${hourLabel(match.kickoff)}</time></button>${expanded ? `<div class="fixture-panel">${quotePanel(match, ids)}</div>` : ""}`;
    }).join("")}`).join("")}</details>`;
  }).join("");
}

async function copyLink() {
  syncHash();
  try {
    await navigator.clipboard.writeText(location.href);
    toast("Enlace copiado.");
  } catch {
    toast(location.href);
  }
}

function drawSlip() {
  const rows = legs();
  const { odd, hit } = combined(rows);
  const width = 800;
  const height = 220 + rows.length * 72;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#07080d";
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = "#c8ff3d";
  ctx.font = "700 28px sans-serif";
  ctx.fillText("Combinada", 36, 58);
  ctx.fillStyle = "#9aa3b8";
  ctx.font = "16px sans-serif";
  ctx.fillText("BetterThanBet · cifras de ejemplo", 36, 86);
  rows.forEach((leg, index) => {
    const y = 140 + index * 72;
    ctx.fillStyle = "#f4f6fb";
    ctx.font = "600 22px sans-serif";
    ctx.fillText(leg.title.slice(0, 42), 36, y);
    ctx.fillStyle = "#9aa3b8";
    ctx.font = "16px sans-serif";
    ctx.fillText(`${leg.detail} · ${leg.hit}%`.slice(0, 52), 36, y + 26);
    ctx.fillStyle = "#5ce1ff";
    ctx.font = "700 22px sans-serif";
    ctx.fillText(leg.odd.toFixed(2), 680, y);
  });
  ctx.fillStyle = "#c8ff3d";
  ctx.font = "700 26px sans-serif";
  ctx.fillText(`Cuota ${odd.toFixed(2)}   ·   Acierto ${formatHit(hit)}`, 36, height - 36);
  return new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
}

async function sharePhoto() {
  const blob = await drawSlip();
  const file = new File([blob], "combinada.png", { type: "image/png" });
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: "Combinada", text: summary(legs()) });
      return;
    } catch (err) {
      if (err.name === "AbortError") return;
    }
  }
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "combinada.png";
  link.click();
  URL.revokeObjectURL(url);
  toast("Foto guardada. En el móvil puedes adjuntarla al chat.");
}

async function shareWhatsApp() {
  syncHash();
  const link = location.href;
  const blob = await drawSlip();
  const file = new File([blob], "combinada.png", { type: "image/png" });
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: "Combinada", text: link });
      return;
    } catch (err) {
      if (err.name === "AbortError") return;
    }
  }
  const url = URL.createObjectURL(blob);
  const download = document.createElement("a");
  download.href = url;
  download.download = "combinada.png";
  download.click();
  URL.revokeObjectURL(url);
  window.open(`https://wa.me/?text=${encodeURIComponent(link)}`, "_blank", "noopener");
  toast("Foto guardada. WhatsApp abre solo con el enlace para que adjuntes la foto.");
}

function paintSelection() {
  board.querySelectorAll(".pickable").forEach((button) => {
    const on = ids.includes(button.dataset.leg);
    button.classList.toggle("is-on", on);
    button.setAttribute("aria-pressed", String(on));
    const state = button.querySelector(".pick-state");
    if (state) state.textContent = on ? "En la combinada" : "Pulsar para añadir";
  });
}

slipEl.addEventListener("click", (event) => {
  const button = event.target.closest("[data-remove]");
  if (!button) return;
  ids = removeSlip(button.dataset.remove);
  renderSlip();
  paintSelection();
});

board.addEventListener("click", (event) => {
  const pick = event.target.closest(".pickable");
  if (pick) {
    const id = pick.dataset.leg;
    if (ids.includes(id)) {
      ids = removeSlip(id);
      toast("Quitada de la combinada.");
    } else {
      const next = takePick(ids, id);
      if (!next.added) {
        toast(pickToast(next));
        return;
      }
      ids = next.ids;
      toast(pickToast(next));
    }
    renderSlip();
    paintSelection();
    return;
  }
  const button = event.target.closest(".fixture");
  if (!button) return;
  openDay.current = button.closest("details.day")?.dataset.day || openDay.current;
  openId.current = openId.current === button.dataset.id ? null : button.dataset.id;
  renderBoard();
  document.querySelector(`[data-id="${CSS.escape(openId.current || "")}"]`)?.scrollIntoView({ block: "nearest" });
});

query.addEventListener("input", () => {
  openId.current = null;
  openDay.current = null;
  renderBoard();
});
renderSlip();
renderBoard();
