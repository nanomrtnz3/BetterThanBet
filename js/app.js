import { loadCache, cacheAgeLabel } from "./cache.js";

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

function probabilityLine(match) {
  if (!match.probs) return "";
  const bits = [
    `local ${match.probs.home}%`,
    `empate ${match.probs.draw}%`,
    `visita ${match.probs.away}%`,
  ];
  if (match.probs.over25 != null) bits.push(`más 2.5 ${match.probs.over25}%`);
  if (match.probs.btts != null) bits.push(`ambos ${match.probs.btts}%`);
  return `<p class="sub" style="margin-bottom:10px">Modelo: ${bits.join(" · ")}</p>`;
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

function fmtKickoff(iso) {
  const d = new Date(iso);
  return d.toLocaleString("es-ES", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
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

  $("upcomingGrid").innerHTML = data.upcoming
    .map(
      (m) => `
      <article class="card">
        <div class="fixture-title">
          <strong>${m.home} vs ${m.away}</strong>
          <span class="kickoff">${fmtKickoff(m.kickoff)}</span>
        </div>
        <div class="sub" style="margin-bottom:10px">${m.league}</div>
        ${probabilityLine(m)}
        ${
          m.markets?.some((market) => market.outcomes?.length)
            ? `${market1x2(m)}
        <div class="odds" style="margin-top:8px">${extraMarket(m, "overUnder")}</div>
        <div class="odds" style="margin-top:8px">${extraMarket(m, "btts")}</div>`
            : `<p class="sub">Cuota aún no publicada.</p>`
        }
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

  $("alerts").innerHTML = data.alerts.length
    ? data.alerts
        .map(
          (a) => `
      <div class="alert">
        <b>${a.match}</b>
        <span class="bet">Apuesta: ${a.market}</span>
        <span class="edge">${a.hit}% de posibilidad de acierto</span>
        <span>${a.note}</span>
      </div>`
        )
        .join("")
    : `<article class="card empty">No hay partidos a futuro con cuotas para proponer una apuesta.</article>`;
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
