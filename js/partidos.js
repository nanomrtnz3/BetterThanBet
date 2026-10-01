import { rateValueActions } from "../tools/probability.mjs";

const COMPS = [
  { name: "Premier League", order: 1, teams: ["Arsenal", "Liverpool", "Manchester City", "Chelsea", "Tottenham", "Newcastle", "Aston Villa", "Brighton"] },
  { name: "LaLiga", order: 2, teams: ["Real Madrid", "Barcelona", "Atlético de Madrid", "Athletic Club", "Real Sociedad", "Villarreal", "Betis", "Sevilla"] },
  { name: "Serie A", order: 3, teams: ["Inter", "Milan", "Juventus", "Napoli", "Roma", "Lazio", "Atalanta", "Fiorentina"] },
  { name: "Bundesliga", order: 4, teams: ["Bayern", "Borussia Dortmund", "Leipzig", "Leverkusen", "Stuttgart", "Frankfurt", "Wolfsburg", "Freiburg"] },
  { name: "Ligue 1", order: 5, teams: ["PSG", "Marsella", "Mónaco", "Lille", "Lyon", "Lens", "Rennes", "Niza"] },
  { name: "Champions League", order: 6, teams: ["Real Madrid", "Manchester City", "Bayern", "PSG", "Inter", "Arsenal", "Barcelona", "Liverpool"] },
  { name: "Europa League", order: 7, teams: ["Roma", "Athletic Club", "Lyon", "Frankfurt", "Porto", "Ajax", "Rangers", "Betis"] },
  { name: "Conference League", order: 8, teams: ["Fiorentina", "Chelsea", "Betis", "Gent", "Legia", "Molde", "Basilea", "Hearts"] },
  { name: "Nations League", order: 9, teams: ["España", "Francia", "Inglaterra", "Portugal", "Alemania", "Italia", "Países Bajos", "Croacia"] },
  { name: "Clasificación Mundial", order: 10, teams: ["España", "Dinamarca", "Suiza", "Escocia", "Polonia", "Suecia", "Gales", "Irlanda"] },
  { name: "Amistosos", order: 11, teams: ["Brasil", "Argentina", "México", "Japón", "Estados Unidos", "Marruecos", "Senegal", "Corea del Sur"] },
];

const DAYS = {
  liga: ["2026-10-03", "2026-10-04", "2026-10-17", "2026-10-18", "2026-10-24", "2026-10-25", "2026-10-31", "2026-11-01", "2026-11-07", "2026-11-08", "2026-11-21", "2026-11-22", "2026-11-28", "2026-11-29"],
  europa: ["2026-10-06", "2026-10-07", "2026-10-20", "2026-10-21", "2026-11-03", "2026-11-04", "2026-11-24", "2026-11-25"],
  selecciones: ["2026-10-10", "2026-10-13", "2026-11-14", "2026-11-17"],
};

function mulberry32(seed) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function decimal(probability, rand) {
  const margin = 1.05 + rand() * 0.03;
  return Math.round((margin / Math.max(0.06, probability)) * 100) / 100;
}

function splitThree(rand, favorite) {
  let home = favorite ? 0.56 + rand() * 0.16 : 0.3 + rand() * 0.2;
  let draw = 0.16 + rand() * 0.1;
  let away = 1 - home - draw;
  if (away < 0.08) {
    away = 0.08;
    const scale = (1 - away) / (home + draw);
    home *= scale;
    draw *= scale;
  }
  return [home, draw, away];
}

function marketsFor(rand, withOdds) {
  if (!withOdds) return [];
  const [home, draw, away] = splitThree(rand, rand() > 0.35);
  const over = 0.38 + rand() * 0.28;
  const btts = 0.4 + rand() * 0.22;
  const corners = 0.42 + rand() * 0.16;
  const cards = 0.4 + rand() * 0.2;
  const cornerLine = rand() > 0.5 ? "9.5" : "10.5";
  const cardLine = rand() > 0.5 ? "4.5" : "5.5";
  return [
    {
      type: "1x2",
      line: "",
      outcomes: [
        { name: "1", label: "Local", odd: decimal(home, rand) },
        { name: "X", label: "Empate", odd: decimal(draw, rand) },
        { name: "2", label: "Visitante", odd: decimal(away, rand) },
      ],
    },
    { type: "overUnder", line: "2.5", outcomes: [{ name: "over", label: "Más 2.5", odd: decimal(over, rand) }, { name: "under", label: "Menos 2.5", odd: decimal(1 - over, rand) }] },
    { type: "btts", line: "", outcomes: [{ name: "yes", label: "Ambos marcan", odd: decimal(btts, rand) }, { name: "no", label: "No ambos", odd: decimal(1 - btts, rand) }] },
    { type: "corners", line: cornerLine, outcomes: [{ name: "over", label: `Más ${cornerLine}`, odd: decimal(corners, rand) }, { name: "under", label: `Menos ${cornerLine}`, odd: decimal(1 - corners, rand) }] },
    { type: "cards", line: cardLine, outcomes: [{ name: "over", label: `Más ${cardLine}`, odd: decimal(cards, rand) }, { name: "under", label: `Menos ${cardLine}`, odd: decimal(1 - cards, rand) }] },
  ];
}

function kickoff(day, hour, minute) {
  return new Date(`${day}T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00+02:00`).toISOString();
}

function buildFixtures() {
  const rand = mulberry32(202610);
  const fixtures = [];
  let n = 0;
  const add = (day, comp, hours) => {
    const shuffled = [...comp.teams].sort(() => rand() - 0.5);
    hours.forEach((hour, index) => {
      const minute = rand() > 0.5 ? 0 : 30;
      const withOdds = comp.name !== "Amistosos" || day < "2026-11-14";
      fixtures.push({
        id: `demo-${n++}`,
        league: comp.name,
        order: comp.order,
        home: shuffled[index * 2],
        away: shuffled[index * 2 + 1],
        kickoff: kickoff(day, hour, minute),
        markets: marketsFor(rand, withOdds),
      });
    });
  };

  const ligas = COMPS.filter((comp) => comp.order <= 5);
  DAYS.liga.forEach((day, index) => {
    const slice = index % 2 === 0 ? ligas.slice(0, 3) : ligas.slice(3);
    slice.forEach((comp, i) => add(day, comp, [14 + i, 18 + i]));
  });
  const europas = COMPS.filter((comp) => comp.order >= 6 && comp.order <= 8);
  DAYS.europa.forEach((day, index) => add(day, europas[index % europas.length], [18, 21]));
  DAYS.selecciones.forEach((day, index) => {
    add(day, COMPS[8 + (index % 2)], [20]);
    if (index % 2 === 1) add(day, COMPS[10], [18]);
  });

  return fixtures.sort((a, b) => a.kickoff.localeCompare(b.kickoff) || a.order - b.order || a.home.localeCompare(b.home, "es"));
}

const FIXTURES = buildFixtures().map((match) => ({ ...match, actions: rateValueActions(match, null) }));

const board = document.querySelector("#board");
const query = document.querySelector("#q");
const dateSelect = document.querySelector("#day");
const count = document.querySelector("#count");
const openId = { current: null };

function dayKey(iso) {
  const date = new Date(iso);
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

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

function dayLabel(iso) {
  return new Date(iso).toLocaleDateString("es-ES", { weekday: "long", day: "2-digit", month: "long" });
}

function hourLabel(iso) {
  return new Date(iso).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });
}

function oddsBlock(match) {
  if (!match.markets.length) return `<p class="sub">Cuota aún no publicada.</p>`;
  return match.markets
    .map((market) => {
      const title = { "1x2": "Resultado", overUnder: "Goles", btts: "Ambos marcan", corners: "Córners", cards: "Tarjetas" }[market.type];
      return `<p class="market-label">${title}</p><div class="odds">${market.outcomes
        .map((item) => `<div class="odd"><small>${item.label}</small><b>${item.odd.toFixed(2)}</b></div>`)
        .join("")}</div>`;
    })
    .join("");
}

function actionBlock(match) {
  const { safe, risky } = match.actions;
  const line = (kind, row) =>
    row
      ? `<p><b>${kind}.</b> ${row.market} · ${row.hit}% de acierto · cuota ${row.odd.toFixed(2)}</p>`
      : "";
  const body = safe || risky
    ? `<div class="value-pair">${line("Más probable", safe)}${line("Más arriesgada", risky)}</div>`
    : `<p class="sub">Con estas cuotas no hay una acción clara.</p>`;
  return fold("Acciones de valor", "La más probable y la más arriesgada", body);
}

const profiles = new Map();

function profile(name) {
  const cached = profiles.get(name);
  if (cached) return cached;
  const rand = mulberry32(hashName(name) || 1);
  const rate = (base, spread, digits = 1) => {
    const factor = 10 ** digits;
    return Math.round((base + rand() * spread) * factor) / factor;
  };
  const split = (total, parts) => {
    const weights = Array.from({ length: parts }, () => 0.35 + rand());
    const sum = weights.reduce((totalWeight, weight) => totalWeight + weight, 0);
    return weights.map((weight) => Math.round((total * weight / sum) * 100) / 100);
  };
  const record = (played) => {
    const wins = Math.round(played * (0.28 + rand() * 0.35));
    const draws = Math.round((played - wins) * (0.2 + rand() * 0.35));
    return `${wins}-${draws}-${Math.max(0, played - wins - draws)}`;
  };
  const played = 10 + Math.floor(rand() * 8);
  const goalsFor = rate(0.9, 1.5);
  const goalsAgainst = rate(0.7, 1.3);
  const row = {
    goalsFor,
    goalsAgainst,
    goalsFor1: rate(0.35, 0.7),
    goalsAgainst1: rate(0.3, 0.6),
    goalsFor2: rate(0.4, 0.8),
    goalsAgainst2: rate(0.35, 0.7),
    goalsForBins: split(goalsFor, 9),
    goalsAgainstBins: split(goalsAgainst, 9),
    cornersFor: rate(3.4, 3.2),
    cornersAgainst: rate(3.2, 3),
    cornersFor1: rate(1.4, 1.6),
    cornersAgainst1: rate(1.3, 1.5),
    cornersFor2: rate(1.6, 1.8),
    cornersAgainst2: rate(1.5, 1.6),
    cornersFor10: rate(0.4, 0.8),
    cornersAgainst10: rate(0.3, 0.8),
    cardsFor: rate(1.4, 1.4),
    cardsAgainst: rate(1.3, 1.4),
    cardsFor1: rate(0.5, 0.7),
    cardsAgainst1: rate(0.4, 0.7),
    cardsFor2: rate(0.7, 0.9),
    cardsAgainst2: rate(0.6, 0.9),
    cardsFor10: rate(0.1, 0.25, 2),
    cardsAgainst10: rate(0.08, 0.22, 2),
    redsFor: rate(0.04, 0.12, 2),
    redsAgainst: rate(0.03, 0.1, 2),
    offsidesFor: rate(1.2, 1.6),
    offsidesAgainst: rate(1.1, 1.5),
    shotsFor: rate(10, 8),
    shotsAgainst: rate(9, 7),
    shotsFor1: rate(4.2, 3.5),
    shotsAgainst1: rate(4, 3.2),
    shotsFor2: rate(5, 4),
    shotsAgainst2: rate(4.6, 3.6),
    sotFor: rate(3.4, 3),
    sotAgainst: rate(3.1, 2.8),
    sotFor1: rate(1.4, 1.4),
    sotAgainst1: rate(1.3, 1.3),
    sotFor2: rate(1.6, 1.6),
    sotAgainst2: rate(1.5, 1.5),
    goalKicksFor: rate(5, 4),
    goalKicksAgainst: rate(4.8, 3.8),
    goalKicksFor1: rate(2.2, 1.8),
    goalKicksAgainst1: rate(2.1, 1.7),
    goalKicksFor2: rate(2.4, 2),
    goalKicksAgainst2: rate(2.3, 1.9),
    throwInsFor: rate(16, 8),
    throwInsAgainst: rate(15, 8),
    throwInsFor1: rate(7, 4),
    throwInsAgainst1: rate(6.5, 4),
    throwInsFor2: rate(8, 4.5),
    throwInsAgainst2: rate(7.5, 4.2),
    tacklesFor: rate(13, 6),
    tacklesAgainst: rate(12, 6),
    tacklesFor1: rate(6, 3),
    tacklesAgainst1: rate(5.5, 2.8),
    tacklesFor2: rate(6.5, 3.2),
    tacklesAgainst2: rate(6, 3),
    freeKicksFor: rate(11, 5),
    freeKicksAgainst: rate(10, 5),
    freeKicksFor1: rate(5, 2.4),
    freeKicksAgainst1: rate(4.6, 2.2),
    freeKicksFor2: rate(5.4, 2.6),
    freeKicksAgainst2: rate(5, 2.4),
    foulsFor: rate(10, 5),
    foulsAgainst: rate(11, 5),
    foulsFor1: rate(4.4, 2.2),
    foulsAgainst1: rate(4.8, 2.4),
    foulsFor2: rate(5, 2.6),
    foulsAgainst2: rate(5.4, 2.6),
    results: record(played),
    resultsHalf: record(played),
    results10: record(played),
  };
  const tie = (total, first, second) => {
    const part = Math.min(row[total], Math.round(row[total] * (0.4 + rand() * 0.15) * 10) / 10);
    row[first] = part;
    row[second] = Math.max(0, Math.round((row[total] - part) * 10) / 10);
  };
  [
    ["goalsFor", "goalsFor1", "goalsFor2"],
    ["goalsAgainst", "goalsAgainst1", "goalsAgainst2"],
    ["cornersFor", "cornersFor1", "cornersFor2"],
    ["cornersAgainst", "cornersAgainst1", "cornersAgainst2"],
    ["cardsFor", "cardsFor1", "cardsFor2"],
    ["cardsAgainst", "cardsAgainst1", "cardsAgainst2"],
    ["shotsFor", "shotsFor1", "shotsFor2"],
    ["shotsAgainst", "shotsAgainst1", "shotsAgainst2"],
    ["sotFor", "sotFor1", "sotFor2"],
    ["sotAgainst", "sotAgainst1", "sotAgainst2"],
    ["goalKicksFor", "goalKicksFor1", "goalKicksFor2"],
    ["goalKicksAgainst", "goalKicksAgainst1", "goalKicksAgainst2"],
    ["throwInsFor", "throwInsFor1", "throwInsFor2"],
    ["throwInsAgainst", "throwInsAgainst1", "throwInsAgainst2"],
    ["tacklesFor", "tacklesFor1", "tacklesFor2"],
    ["tacklesAgainst", "tacklesAgainst1", "tacklesAgainst2"],
    ["freeKicksFor", "freeKicksFor1", "freeKicksFor2"],
    ["freeKicksAgainst", "freeKicksAgainst1", "freeKicksAgainst2"],
    ["foulsFor", "foulsFor1", "foulsFor2"],
    ["foulsAgainst", "foulsAgainst1", "foulsAgainst2"],
  ].forEach(([total, first, second]) => tie(total, first, second));
  profiles.set(name, row);
  return row;
}

function hashName(name) {
  let hash = 2166136261;
  for (const char of name) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619);
  return hash >>> 0;
}

function num(value) {
  return Number(value).toFixed(Math.abs(value) < 0.3 ? 2 : 1);
}

function pairRows(home, away, rows) {
  return rows
    .map(([label, key]) => `<tr><td>${label}</td><td>${num(home[key])}</td><td>${num(away[key])}</td></tr>`)
    .join("");
}

function fold(title, note, body) {
  return `<details class="stat-fold"><summary><span>${title}</span><small>${note}</small></summary><div class="stat-body">${body}</div></details>`;
}

function compareTable(homeName, awayName, rows) {
  return `<table class="cmp"><thead><tr><th></th><th>${homeName}</th><th>${awayName}</th></tr></thead><tbody>${rows}</tbody></table>`;
}

function statsBlock(match) {
  const home = profile(match.home);
  const away = profile(match.away);
  const bins = ["0-10", "10-20", "20-30", "30-40", "40-50", "50-60", "60-70", "70-80", "80-90"]
    .map(
      (label, index) =>
        `<tr><td>${label}</td><td>${num(home.goalsForBins[index])} / ${num(home.goalsAgainstBins[index])}</td><td>${num(away.goalsForBins[index])} / ${num(away.goalsAgainstBins[index])}</td></tr>`
    )
    .join("");
  const sections = [
    ["Goles", "Por partido", compareTable(match.home, match.away, `${pairRows(home, away, [
      ["Anotados", "goalsFor"],
      ["Recibidos", "goalsAgainst"],
      ["Anotados, 1.ª parte", "goalsFor1"],
      ["Recibidos, 1.ª parte", "goalsAgainst1"],
      ["Anotados, 2.ª parte", "goalsFor2"],
      ["Recibidos, 2.ª parte", "goalsAgainst2"],
    ])}<tr><td colspan="3">A favor / en contra cada 10 min</td></tr>${bins}`)],
    ["Córners", "Por partido", compareTable(match.home, match.away, pairRows(home, away, [
      ["A favor", "cornersFor"],
      ["En contra", "cornersAgainst"],
      ["A favor, 1.ª parte", "cornersFor1"],
      ["En contra, 1.ª parte", "cornersAgainst1"],
      ["A favor, 2.ª parte", "cornersFor2"],
      ["En contra, 2.ª parte", "cornersAgainst2"],
      ["A favor, primeros 10 min", "cornersFor10"],
      ["En contra, primeros 10 min", "cornersAgainst10"],
    ]))],
    ["Tarjetas", "Recibidas y provocadas", compareTable(match.home, match.away, pairRows(home, away, [
      ["Recibidas", "cardsFor"],
      ["Provocadas", "cardsAgainst"],
      ["Recibidas, 1.ª parte", "cardsFor1"],
      ["Provocadas, 1.ª parte", "cardsAgainst1"],
      ["Recibidas, 2.ª parte", "cardsFor2"],
      ["Provocadas, 2.ª parte", "cardsAgainst2"],
      ["Recibidas, primeros 10 min", "cardsFor10"],
      ["Provocadas, primeros 10 min", "cardsAgainst10"],
      ["Rojas a favor", "redsFor"],
      ["Rojas en contra", "redsAgainst"],
    ]))],
    ["Fueras de juego", "Pitados por partido", compareTable(match.home, match.away, pairRows(home, away, [
      ["Al equipo", "offsidesFor"],
      ["Al rival", "offsidesAgainst"],
    ]))],
    ["Remates", "Por partido", compareTable(match.home, match.away, pairRows(home, away, [
      ["A favor", "shotsFor"],
      ["En contra", "shotsAgainst"],
      ["A favor, 1.ª parte", "shotsFor1"],
      ["En contra, 1.ª parte", "shotsAgainst1"],
      ["A favor, 2.ª parte", "shotsFor2"],
      ["En contra, 2.ª parte", "shotsAgainst2"],
    ]))],
    ["Remates a puerta", "Por partido", compareTable(match.home, match.away, pairRows(home, away, [
      ["A favor", "sotFor"],
      ["En contra", "sotAgainst"],
      ["A favor, 1.ª parte", "sotFor1"],
      ["En contra, 1.ª parte", "sotAgainst1"],
      ["A favor, 2.ª parte", "sotFor2"],
      ["En contra, 2.ª parte", "sotAgainst2"],
    ]))],
    ["Saques de puerta", "Por partido", compareTable(match.home, match.away, pairRows(home, away, [
      ["A favor", "goalKicksFor"],
      ["En contra", "goalKicksAgainst"],
      ["A favor, 1.ª parte", "goalKicksFor1"],
      ["En contra, 1.ª parte", "goalKicksAgainst1"],
      ["A favor, 2.ª parte", "goalKicksFor2"],
      ["En contra, 2.ª parte", "goalKicksAgainst2"],
    ]))],
    ["Saques de banda", "Por partido", compareTable(match.home, match.away, pairRows(home, away, [
      ["A favor", "throwInsFor"],
      ["En contra", "throwInsAgainst"],
      ["A favor, 1.ª parte", "throwInsFor1"],
      ["En contra, 1.ª parte", "throwInsAgainst1"],
      ["A favor, 2.ª parte", "throwInsFor2"],
      ["En contra, 2.ª parte", "throwInsAgainst2"],
    ]))],
    ["Entradas", "Por partido", compareTable(match.home, match.away, pairRows(home, away, [
      ["A favor", "tacklesFor"],
      ["En contra", "tacklesAgainst"],
      ["A favor, 1.ª parte", "tacklesFor1"],
      ["En contra, 1.ª parte", "tacklesAgainst1"],
      ["A favor, 2.ª parte", "tacklesFor2"],
      ["En contra, 2.ª parte", "tacklesAgainst2"],
    ]))],
    ["Tiros libres", "Faltas sacadas, por partido", compareTable(match.home, match.away, pairRows(home, away, [
      ["A favor", "freeKicksFor"],
      ["En contra", "freeKicksAgainst"],
      ["A favor, 1.ª parte", "freeKicksFor1"],
      ["En contra, 1.ª parte", "freeKicksAgainst1"],
      ["A favor, 2.ª parte", "freeKicksFor2"],
      ["En contra, 2.ª parte", "freeKicksAgainst2"],
    ]))],
    ["Faltas", "Por partido", compareTable(match.home, match.away, pairRows(home, away, [
      ["A favor", "foulsFor"],
      ["En contra", "foulsAgainst"],
      ["A favor, 1.ª parte", "foulsFor1"],
      ["En contra, 1.ª parte", "foulsAgainst1"],
      ["A favor, 2.ª parte", "foulsFor2"],
      ["En contra, 2.ª parte", "foulsAgainst2"],
    ]))],
    ["Resultados", "Victorias-empates-derrotas", `<table class="cmp"><thead><tr><th></th><th>${match.home}</th><th>${match.away}</th></tr></thead><tbody>
      <tr><td>Partido</td><td>${home.results}</td><td>${away.results}</td></tr>
      <tr><td>Al descanso</td><td>${home.resultsHalf}</td><td>${away.resultsHalf}</td></tr>
      <tr><td>Primeros 10 min</td><td>${home.results10}</td><td>${away.results10}</td></tr>
    </tbody></table>`],
  ];
  return `<p class="sub stat-note">Medias de ejemplo por partido. Todavía no salen de una fuente real.</p>${sections
    .map(([title, note, body]) => fold(title, note, body))
    .join("")}`;
}

function render() {
  const text = query.value.trim().toLocaleLowerCase("es");
  const picked = dateSelect.value;
  const rows = FIXTURES.filter((match) => {
    const blob = `${match.home} ${match.away} ${match.league}`.toLocaleLowerCase("es");
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
      const open = (picked && bucket.key === picked) || holdsOpenMatch ? " open" : "";
      const noun = total === 1 ? "partido" : "partidos";
      return `<details class="day fold"${open}><summary><span>${bucket.day}</span><small>${total} ${noun}</small></summary>${bucket.comps
        .map(
          (comp) => `<h3 class="comp">${comp.name}</h3>${comp.matches
            .map((match) => {
              const expanded = openId.current === match.id;
              return `<button class="fixture" type="button" data-id="${match.id}" aria-expanded="${expanded}">
                <strong>${match.home} vs ${match.away}</strong>
                <time>${hourLabel(match.kickoff)}</time>
              </button>${
                expanded ? `<div class="fixture-panel">${oddsBlock(match)}${actionBlock(match)}${statsBlock(match)}</div>` : ""
              }`;
            })
            .join("")}`
        )
        .join("")}</details>`;
    })
    .join("");
}

board.addEventListener("click", (event) => {
  const button = event.target.closest(".fixture");
  if (!button) return;
  openId.current = openId.current === button.dataset.id ? null : button.dataset.id;
  render();
  document.querySelector(`[data-id="${CSS.escape(openId.current || "")}"]`)?.scrollIntoView({ block: "nearest" });
});

query.addEventListener("input", () => {
  openId.current = null;
  render();
});

dateSelect.addEventListener("change", () => {
  openId.current = null;
  render();
  if (dateSelect.value) board.querySelector("details[open]")?.scrollIntoView({ block: "start" });
});

render();
