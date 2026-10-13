import { FIXTURES, playerProps, resolveLeg, searchBlob, dayLabel, hourLabel } from "./demo.mjs";
import { addSlip, readSlip, removeSlip, writeSlip } from "./slip.mjs";

const slipEl = document.querySelector("#slip");
const picks = document.querySelector("#picks");
const query = document.querySelector("#q");
const notice = document.querySelector("#notice");

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
  return ids.map((id) => resolveLeg(id)).filter(Boolean);
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
  ids = ids.filter((id) => resolveLeg(id));
  writeSlip(ids);
  syncHash();
  const rows = legs();
  if (!rows.length) {
    slipEl.innerHTML = `<p class="sub">Todavía no hay patas. Abre un partido de abajo y pulsa Añadir.</p>`;
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
    <p class="sub">El porcentaje multiplica el acierto de cada pata, como si fueran independientes. Es un cálculo de ejemplo, no una recomendación.</p>
    <div class="slip-actions">
      <button type="button" id="copy">Copiar enlace</button>
      <button type="button" id="photo">Compartir foto</button>
      <button type="button" id="whatsapp">WhatsApp</button>
    </div>`;
  slipEl.querySelector("#copy").addEventListener("click", copyLink);
  slipEl.querySelector("#photo").addEventListener("click", sharePhoto);
  slipEl.querySelector("#whatsapp").addEventListener("click", shareWhatsApp);
}

function renderPicks() {
  const text = query.value.trim().toLocaleLowerCase("es");
  const rows = FIXTURES.filter((match) => !text || searchBlob(match).toLocaleLowerCase("es").includes(text)).slice(0, 8);
  picks.innerHTML = rows.map((match) => {
    const goals = [
      ["h", `${match.home} marca más goles`],
      ["a", `${match.away} marca más goles`],
    ];
    const props = playerProps(match).map((prop) => `<button type="button" class="add-slip" data-leg="${prop.id}">${prop.player.name} ${prop.market.label}</button>`);
    return `<article class="card pick">
      <div class="meta-row"><span>${match.league}</span><span>${dayLabel(match.kickoff)} · ${hourLabel(match.kickoff)}</span></div>
      <strong>${match.home} vs ${match.away}</strong>
      <div class="pick-legs">
        ${goals.map(([side, label]) => `<button type="button" class="add-slip" data-leg="g:${match.id}:${side}">${label}</button>`).join("")}
        ${props.join("")}
      </div>
    </article>`;
  }).join("") || `<p class="empty">Ningún partido coincide.</p>`;
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
  const rows = legs();
  const text = summary(rows);
  const blob = await drawSlip();
  const file = new File([blob], "combinada.png", { type: "image/png" });
  const mobile = window.matchMedia("(pointer: coarse)").matches;
  if (mobile && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], text, title: "Combinada" });
      return;
    } catch (err) {
      if (err.name === "AbortError") return;
    }
  }
  window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank", "noopener");
}

slipEl.addEventListener("click", (event) => {
  const button = event.target.closest("[data-remove]");
  if (!button) return;
  ids = removeSlip(button.dataset.remove);
  renderSlip();
});

picks.addEventListener("click", (event) => {
  const button = event.target.closest(".add-slip");
  if (!button) return;
  ids = addSlip(button.dataset.leg);
  renderSlip();
  toast("Añadida a la combinada.");
});

query.addEventListener("input", renderPicks);
renderSlip();
renderPicks();
