import { loadCache, cacheAgeLabel } from "./cache.js";
import { rateValueActions } from "../tools/probability.mjs";

const $ = (id) => document.getElementById(id);

function formChips(form) {
  return [...form].map((c) => `<span class="form ${c}">${c}</span>`).join("");
}

function market1x2(match) {
  const m = match.markets.find((x) => x.type === "1x2");
  if (!m) return "";
  return `<div class="odds">${m.outcomes
    .map((o) => `<div class="odd"><small>${o.label}</small><b>${o.odd.toFixed(2)}</b></div>`)
    .join("")}</div>`;
}

function extraMarket(match, type) {
  const m = match.markets.find((x) => x.type === type);
  if (!m) return "";
  return m.outcomes
    .map((o) => `<div class="odd"><small>${o.label}</small><b>${o.odd.toFixed(2)}</b></div>`)
    .join("");
}

function playerRows(rows, cells) {
  return rows
    .map(
      (p) => `
      <tr>
        <td><span class="rank ${p.rank === 1 ? "gold" : ""}">${p.rank}</span></td>
        <td>${p.name}<div class="sub">${p.team}${p.league ? ` · ${p.league}` : ""}</div></td>
        ${cells(p)}
      </tr>`
    )
    .join("");
}

function render(data) {
  $("cacheChip").textContent = cacheAgeLabel(data.generatedAt);
  $("statLive").textContent = String(data.live.length);
  $("statUpcoming").textContent = String(data.upcoming.length);
  $("statScorers").textContent = String(data.topScorers[0]?.goals ?? "—");
  $("statWin").textContent = `${data.winrate[0]?.winrate ?? "—"}%`;

  $("liveGrid").innerHTML = data.live.length
    ? data.live
        .map(
          (m) => `
      <article class="card live-card">
        <div class="meta-row"><span class="badge">En directo · ${m.minute}'</span><span>${m.league}</span></div>
        <div class="teams">
          <strong>${m.home}</strong>
          <span class="score">${m.scoreHome}–${m.scoreAway}</span>
          <strong style="text-align:right">${m.away}</strong>
        </div>
        ${market1x2(m)}
        <div class="odds" style="margin-top:8px">${extraMarket(m, "overUnder")}</div>
      </article>`
        )
        .join("")
    : `<article class="card empty">No hay partidos en directo ahora mismo.</article>`;

  $("scorersBody").innerHTML = data.topScorers
    .map(
      (p) => `
      <tr>
        <td><span class="rank ${p.rank === 1 ? "gold" : ""}">${p.rank}</span></td>
        <td>${p.name}<div class="sub">${p.team} · ${p.league}</div></td>
        <td>${p.goals}</td>
        <td>${p.assists}</td>
        <td>${p.per90.toFixed(2)}</td>
        <td>${p.matches}</td>
      </tr>`
    )
    .join("");

  $("cardsBody").innerHTML = data.cards
    .map(
      (p) => `
      <tr>
        <td><span class="rank">${p.rank}</span></td>
        <td>${p.name}<div class="sub">${p.team}</div></td>
        <td>${p.yellowAvg.toFixed(2)}</td>
        <td>${p.redAvg.toFixed(2)}</td>
        <td>${p.yellow}/${p.red}</td>
      </tr>`
    )
    .join("");

  $("winrateList").innerHTML = data.winrate
    .map(
      (t) => `
      <article style="margin-bottom:16px">
        <div class="meta-row"><strong>${t.rank}. ${t.name}</strong><span>${t.league}</span></div>
        <div class="meta-row"><span>${t.wins}V · ${t.draws}E · ${t.losses}D</span><b>${t.winrate}%</b></div>
        <div class="bar"><i style="width:${t.winrate}%"></i></div>
        <div class="chips" style="margin-top:8px">${formChips(t.form)}</div>
      </article>`
    )
    .join("");

  $("shotsBody").innerHTML = playerRows(data.shots || [], (p) => `
        <td>${p.shotsPerGame.toFixed(2)}</td>
        <td>${p.sotPerGame.toFixed(2)}</td>
        <td>${p.shots}</td>
        <td>${p.sot}</td>`);

  $("streaks").innerHTML = data.streaks
    .map(
      (s) => `
      <article class="card streak">
        <b>${s.value}</b>
        <div>${s.team || s.player}</div>
        <span class="sub">${s.label}</span>
      </article>`
    )
    .join("");

  $("alerts").innerHTML = liveActionCards(data.live);
}

function liveActionCards(live) {
  if (!live.length) {
    return `<article class="card empty">No hay partidos en directo. Cuando empiece uno, aquí saldrán su acción más probable y la más arriesgada.</article>`;
  }
  return live
    .map((match) => {
      const rated = rateValueActions(match, null);
      const lines = [
        rated.safe && `<p><b>Más probable.</b> ${rated.safe.market} · ${rated.safe.hit}% de acierto · cuota ${rated.safe.odd}</p>`,
        rated.risky && `<p><b>Más arriesgada.</b> ${rated.risky.market} · ${rated.risky.hit}% de acierto · cuota ${rated.risky.odd}</p>`,
      ].filter(Boolean);
      return `<article class="alert">
        <div class="meta-row"><span class="badge">En directo · ${match.minute}'</span><span>${match.league}</span></div>
        <b>${match.home} ${match.scoreHome}–${match.scoreAway} ${match.away}</b>
        ${
          lines.length
            ? `<div class="value-pair">${lines.join("")}</div>`
            : `<span>Este partido no tiene cuotas suficientes para proponer una acción.</span>`
        }
      </article>`;
    })
    .join("");
}

let stamp = "";

async function refresh() {
  let data;
  try {
    data = await loadCache();
  } catch (err) {
    await new Promise((resolve) => setTimeout(resolve, 400));
    data = await loadCache().catch(() => {
      throw err;
    });
  }
  if (data.generatedAt !== stamp) {
    stamp = data.generatedAt;
    render(data);
    return;
  }
  $("cacheChip").textContent = cacheAgeLabel(data.generatedAt);
}

try {
  await refresh();
  setInterval(() => {
    refresh().catch((err) => {
      $("cacheChip").textContent = "sin datos";
      console.error(err);
    });
  }, 30_000);
} catch (err) {
  $("cacheChip").textContent = "sin datos";
  $("liveGrid").innerHTML = `<article class="card empty">No se pudieron cargar los datos.</article>`;
}
