import { devig } from "../tools/probability.mjs";
import { betCopy } from "./quotes.mjs";
import { readSlip, takePick } from "./slip.mjs";
import { bindLineups, teamPitch } from "./lineup.mjs";
import {
  BOOKS,
  FIXTURES,
  bookQuote,
  dayKey,
  dayLabel,
  decimal,
  hashName,
  hourLabel,
  mulberry32,
  playerProps,
  profile,
  searchBlob,
  yellowText,
} from "./demo.mjs";

const board = document.querySelector("#board");
const query = document.querySelector("#q");
const dateSelect = document.querySelector("#day");
const count = document.querySelector("#count");
const openId = { current: null };
const openDay = { current: null };

const seenDays = new Set();
for (const match of FIXTURES) {
  const key = dayKey(match.kickoff);
  if (seenDays.has(key)) continue;
  seenDays.add(key);
  const option = document.createElement("option");
  option.value = key;
  option.textContent = dayLabel(match.kickoff);
  dateSelect.append(option);
}

function priceLines(match, title, lines) {
  const rand = mulberry32(hashName(`${match.id}:${title}`) || 1);
  const hit = (value) => Math.round(value * 1000) / 10;
  return lines.flatMap((line) => {
    const home = Number(line.home);
    const away = Number(line.away);
    const total = home + away;
    if (!(total > 0)) return [];
    const pHome = Math.min(0.82, Math.max(0.18, home / total));
    const homeOdd = Math.max(1.01, decimal(pHome, rand));
    const awayOdd = Math.max(1.01, decimal(1 - pHome, rand));
    const [fairHome, fairAway] = devig([homeOdd, awayOdd]);
    const side = (team, rival, odd, fair, figure) => ({
      team,
      rival,
      odd,
      hit: hit(fair),
      figure,
      label: line.label,
      copy: betCopy(title, line.label, team, rival),
    });
    return [{
      label: line.label,
      kind: line.kind,
      home: side(match.home, match.away, homeOdd, fairHome, line.homeText ?? num(line.home)),
      away: side(match.away, match.home, awayOdd, fairAway, line.awayText ?? num(line.away)),
    }];
  });
}

function betCard(side, legId) {
  const add = legId ? `<button type="button" class="add-slip" data-leg="${legId}">Añadir</button>` : "";
  return `<div class="bet"><p>${side.copy.html}</p><div class="odd"><small>${side.team}</small><b>${side.odd.toFixed(2)}</b><small class="odd-kind">cuota</small></div>${add}</div>`;
}

function actionsHtml(rows) {
  const actions = rows.flatMap((row) => [
    { market: `${row.label}: más ${row.home.team}`, hit: row.home.hit, odd: row.home.odd, group: row.label },
    { market: `${row.label}: más ${row.away.team}`, hit: row.away.hit, odd: row.away.odd, group: row.label },
  ]);
  const safe = actions.filter((row) => row.hit >= 55).sort((a, b) => b.hit - a.hit)[0] || null;
  const risky = actions
    .filter((row) => row.hit >= 25 && row.hit <= 45 && row.group !== safe?.group)
    .sort((a, b) => b.odd - a.odd)[0] || null;
  const text = (kind, row) =>
    row ? `<p><b>${kind}.</b> ${row.market} · ${row.hit}% de acierto · cuota ${row.odd.toFixed(2)}</p>` : "";
  const body = safe || risky
    ? `<div class="value-pair">${text("Más probable", safe)}${text("Más arriesgada", risky)}</div>`
    : `<p class="sub">Con estas cuotas no hay una acción clara.</p>`;
  return `<p class="market-label">Acciones de valor</p>${body}`;
}

function num(value) {
  return Number(value).toFixed(Math.abs(value) < 0.3 ? 2 : 1);
}

function fold(title, note, body) {
  return `<details class="stat-fold"><summary><span>${title}</span><small>${note}</small></summary><div class="stat-body">${body}</div></details>`;
}

function linesFrom(home, away, rows) {
  return rows.map(([label, key]) => ({ label, home: home[key], away: away[key] }));
}

function section(match, title, note, lines) {
  const rows = priceLines(match, title, lines);
  const cards = rows
    .map((row) => {
      const goal = title === "Goles" && row.label === "Anotados";
      return `<p class="market-label">${row.label}</p><div class="odds bets">${betCard(row.home, goal ? `g:${match.id}:h` : "")}${betCard(row.away, goal ? `g:${match.id}:a` : "")}</div>`;
    })
    .join("");
  return fold(title, note, `${cards}${actionsHtml(rows)}`);
}

function extraFolds(match) {
  const home = profile(match.home);
  const away = profile(match.away);
  const statsRows = [
    ["Goles a favor", home.goalsFor, away.goalsFor],
    ["Goles en contra", home.goalsAgainst, away.goalsAgainst],
    ["Córners a favor", home.cornersFor, away.cornersFor],
    ["Tarjetas recibidas", home.cardsFor, away.cardsFor],
    ["Remates", home.shotsFor, away.shotsFor],
    ["Remates a puerta", home.sotFor, away.sotFor],
    ["Faltas", home.foulsFor, away.foulsFor],
  ];
  const stats = fold(
    "Estadísticas",
    "Comparación",
    `<p class="sub">Medias de ejemplo por partido.</p><table class="cmp"><thead><tr><th>Dato</th><th>${match.home}</th><th>${match.away}</th></tr></thead><tbody>${statsRows
      .map(([label, left, right]) => `<tr><td>${label}</td><td>${num(left)}</td><td>${num(right)}</td></tr>`)
      .join("")}</tbody></table>`
  );
  const lineup = fold("Alineación probable", "Once, banquillo y bajas", `<div class="pitch-pair">${teamPitch(match.home)}${teamPitch(match.away)}</div><p class="sub">Pulsa un jugador para ver sus amarillas. El ciclo de ejemplo es de 5. Estas plantillas no son las reales.</p>`);
  const props = playerProps(match)
    .map((prop) => `<div class="bet prop"><p>Apuesta a que <b>${prop.player.name}</b> ${prop.market.label} en el encuentro. <span class="sub">${prop.player.team} · ${yellowText(prop.player.yellows)}</span></p><div class="odd"><small>cuota</small><b>${prop.odd.toFixed(2)}</b><small class="odd-kind">${prop.hit}%</small></div><button type="button" class="add-slip" data-leg="${prop.id}">Añadir</button></div>`)
    .join("");
  const players = fold("Cuotas de jugadores", "Gol, asistencia o tarjeta", `<div class="prop-grid">${props}</div>`);
  const books = BOOKS.map((book) => {
    const quote = bookQuote(match, book);
    const card = (side, key) => {
      const rival = side.team === match.home ? match.away : match.home;
      return `<div class="bet"><p>Apuesta a que <b>${side.team}</b> marca más goles que ${rival} en el encuentro. Cuota de ejemplo de ${book.name}.</p><div class="odd"><small>${book.name}</small><b>${side.odd.toFixed(2)}</b><small class="odd-kind">${side.hit}%</small></div><button type="button" class="add-slip" data-leg="b:${match.id}:${book.id}:${key}">Añadir</button></div>`;
    };
    return fold(book.name, "Cuotas de ejemplo", `<div class="odds bets">${card(quote.home, "h")}${card(quote.away, "a")}</div>`);
  }).join("");
  return `${stats}${lineup}${players}${fold("Casas de apuestas", "Cuatro casas", books)}`;
}

function statsBlock(match) {
  const home = profile(match.home);
  const away = profile(match.away);
  const windows = [
    [0, 15],
    [16, 30],
    [31, 45],
    [46, 60],
    [61, 75],
    [76, 90],
  ];
  const bins = windows.flatMap(([from, to], index) => [
    {
      label: `Desde el minuto ${from} al ${to}, a favor`,
      home: home.goalsForBins[index],
      away: away.goalsForBins[index],
    },
    {
      label: `Desde el minuto ${from} al ${to}, en contra`,
      home: home.goalsAgainstBins[index],
      away: away.goalsAgainstBins[index],
    },
  ]);
  const recordLine = (label, homeRecord, awayRecord) => ({
    label,
    home: homeRecord.wins,
    away: awayRecord.wins,
    homeText: homeRecord.text,
    awayText: awayRecord.text,
    kind: "registro",
  });
  const sections = [
    section(match, "Goles", "En el encuentro", [
      ...linesFrom(home, away, [
        ["Anotados", "goalsFor"],
        ["Recibidos", "goalsAgainst"],
        ["Anotados, 1.ª parte", "goalsFor1"],
        ["Recibidos, 1.ª parte", "goalsAgainst1"],
        ["Anotados, 2.ª parte", "goalsFor2"],
        ["Recibidos, 2.ª parte", "goalsAgainst2"],
      ]),
      ...bins,
    ]),
    section(match, "Córners", "En el encuentro", linesFrom(home, away, [
      ["A favor", "cornersFor"],
      ["En contra", "cornersAgainst"],
      ["A favor, 1.ª parte", "cornersFor1"],
      ["En contra, 1.ª parte", "cornersAgainst1"],
      ["A favor, 2.ª parte", "cornersFor2"],
      ["En contra, 2.ª parte", "cornersAgainst2"],
      ["Desde el minuto 0 al 15, a favor", "cornersFor10"],
      ["Desde el minuto 0 al 15, en contra", "cornersAgainst10"],
    ])),
    section(match, "Tarjetas", "Recibidas y provocadas", linesFrom(home, away, [
      ["Recibidas", "cardsFor"],
      ["Provocadas", "cardsAgainst"],
      ["Recibidas, 1.ª parte", "cardsFor1"],
      ["Provocadas, 1.ª parte", "cardsAgainst1"],
      ["Recibidas, 2.ª parte", "cardsFor2"],
      ["Provocadas, 2.ª parte", "cardsAgainst2"],
      ["Desde el minuto 0 al 15, recibidas", "cardsFor10"],
      ["Desde el minuto 0 al 15, provocadas", "cardsAgainst10"],
      ["Rojas a favor", "redsFor"],
      ["Rojas en contra", "redsAgainst"],
    ])),
    section(match, "Fueras de juego", "En el encuentro", linesFrom(home, away, [
      ["Al equipo", "offsidesFor"],
      ["Al rival", "offsidesAgainst"],
    ])),
    section(match, "Remates", "En el encuentro", linesFrom(home, away, [
      ["A favor", "shotsFor"],
      ["En contra", "shotsAgainst"],
      ["A favor, 1.ª parte", "shotsFor1"],
      ["En contra, 1.ª parte", "shotsAgainst1"],
      ["A favor, 2.ª parte", "shotsFor2"],
      ["En contra, 2.ª parte", "shotsAgainst2"],
    ])),
    section(match, "Remates a puerta", "En el encuentro", linesFrom(home, away, [
      ["A favor", "sotFor"],
      ["En contra", "sotAgainst"],
      ["A favor, 1.ª parte", "sotFor1"],
      ["En contra, 1.ª parte", "sotAgainst1"],
      ["A favor, 2.ª parte", "sotFor2"],
      ["En contra, 2.ª parte", "sotAgainst2"],
    ])),
    section(match, "Saques de puerta", "En el encuentro", linesFrom(home, away, [
      ["A favor", "goalKicksFor"],
      ["En contra", "goalKicksAgainst"],
      ["A favor, 1.ª parte", "goalKicksFor1"],
      ["En contra, 1.ª parte", "goalKicksAgainst1"],
      ["A favor, 2.ª parte", "goalKicksFor2"],
      ["En contra, 2.ª parte", "goalKicksAgainst2"],
    ])),
    section(match, "Saques de banda", "En el encuentro", linesFrom(home, away, [
      ["A favor", "throwInsFor"],
      ["En contra", "throwInsAgainst"],
      ["A favor, 1.ª parte", "throwInsFor1"],
      ["En contra, 1.ª parte", "throwInsAgainst1"],
      ["A favor, 2.ª parte", "throwInsFor2"],
      ["En contra, 2.ª parte", "throwInsAgainst2"],
    ])),
    section(match, "Entradas", "En el encuentro", linesFrom(home, away, [
      ["A favor", "tacklesFor"],
      ["En contra", "tacklesAgainst"],
      ["A favor, 1.ª parte", "tacklesFor1"],
      ["En contra, 1.ª parte", "tacklesAgainst1"],
      ["A favor, 2.ª parte", "tacklesFor2"],
      ["En contra, 2.ª parte", "tacklesAgainst2"],
    ])),
    section(match, "Tiros libres", "En el encuentro", linesFrom(home, away, [
      ["A favor", "freeKicksFor"],
      ["En contra", "freeKicksAgainst"],
      ["A favor, 1.ª parte", "freeKicksFor1"],
      ["En contra, 1.ª parte", "freeKicksAgainst1"],
      ["A favor, 2.ª parte", "freeKicksFor2"],
      ["En contra, 2.ª parte", "freeKicksAgainst2"],
    ])),
    section(match, "Faltas", "En el encuentro", linesFrom(home, away, [
      ["A favor", "foulsFor"],
      ["En contra", "foulsAgainst"],
      ["A favor, 1.ª parte", "foulsFor1"],
      ["En contra, 1.ª parte", "foulsAgainst1"],
      ["A favor, 2.ª parte", "foulsFor2"],
      ["En contra, 2.ª parte", "foulsAgainst2"],
    ])),
    section(match, "Resultados", "En el encuentro", [
      recordLine("Partido", home.results, away.results),
      recordLine("Al descanso", home.resultsHalf, away.resultsHalf),
      recordLine("Desde el minuto 0 al 15", home.results10, away.results10),
    ]),
  ];
  return `${extraFolds(match)}${sections.join("")}`;
}

function render() {
  const text = query.value.trim().toLocaleLowerCase("es");
  const picked = dateSelect.value;
  const rows = FIXTURES.filter((match) => {
    const blob = searchBlob(match).toLocaleLowerCase("es");
    const sameDay = !picked || dayKey(match.kickoff) === picked;
    return sameDay && (!text || blob.includes(text));
  });
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
  board.innerHTML = groups
    .map((bucket) => {
      const total = bucket.comps.reduce((sum, comp) => sum + comp.matches.length, 0);
      const holdsOpenMatch = bucket.comps.some((comp) => comp.matches.some((match) => match.id === openId.current));
      const open = text || (picked && bucket.key === picked) || holdsOpenMatch || bucket.key === openDay.current ? " open" : "";
      const noun = total === 1 ? "partido" : "partidos";
      return `<details class="day fold" data-day="${bucket.key}"${open}><summary><span>${bucket.day}</span><small>${total} ${noun}</small></summary>${bucket.comps
        .map(
          (comp) => `<h3 class="comp">${comp.name}</h3>${comp.matches
            .map((match) => {
              const expanded = openId.current === match.id;
              return `<button class="fixture" type="button" data-id="${match.id}" aria-expanded="${expanded}">
                <strong>${match.home} vs ${match.away}</strong>
                <time>${hourLabel(match.kickoff)}</time>
              </button>${
                expanded ? `<div class="fixture-panel">${statsBlock(match)}</div>` : ""
              }`;
            })
            .join("")}`
        )
        .join("")}</details>`;
    })
    .join("");
}

function toast(message) {
  let el = document.querySelector(".toast");
  if (!el) {
    el = document.createElement("p");
    el.className = "toast";
    document.body.append(el);
  }
  el.textContent = message;
  el.classList.add("show");
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => el.classList.remove("show"), 2200);
}

board.addEventListener("click", (event) => {
  const add = event.target.closest(".add-slip");
  if (add) {
    const next = takePick(readSlip(), add.dataset.leg);
    toast(next.added ? (next.replaced ? "Se sustituyó la cuota contraria." : "Añadida a la combinada.") : "La combinada admite 12 cuotas.");
    return;
  }
  const button = event.target.closest(".fixture");
  if (!button) return;
  openDay.current = button.closest("details.day")?.dataset.day || openDay.current;
  openId.current = openId.current === button.dataset.id ? null : button.dataset.id;
  render();
  document.querySelector(`[data-id="${CSS.escape(openId.current || "")}"]`)?.scrollIntoView({ block: "nearest" });
});

query.addEventListener("input", () => {
  openId.current = null;
  openDay.current = null;
  render();
});

dateSelect.addEventListener("change", () => {
  openId.current = null;
  openDay.current = dateSelect.value || null;
  render();
  if (dateSelect.value) board.querySelector("details[open]")?.scrollIntoView({ block: "start" });
});

bindLineups();
render();
