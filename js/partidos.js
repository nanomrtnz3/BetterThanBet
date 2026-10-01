import { devig } from "../tools/probability.mjs";

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

// Conserva el sorteo de la agenda al dejar de generar las cuotas antiguas.
function burnOldMarkets(rand, withOdds) {
  if (!withOdds) return;
  for (let i = 0; i < 20; i += 1) rand();
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
      burnOldMarkets(rand, comp.name !== "Amistosos" || day < "2026-11-14");
      fixtures.push({
        id: `demo-${n++}`,
        league: comp.name,
        order: comp.order,
        home: shuffled[index * 2],
        away: shuffled[index * 2 + 1],
        kickoff: kickoff(day, hour, minute),
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

const FIXTURES = buildFixtures();

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

function betWhat(section, label) {
  if (section === "Resultados") {
    if (label === "Partido") return "victorias en el partido";
    if (label === "Al descanso") return "victorias al descanso";
    return "victorias desde el minuto 0 al 15";
  }
  const noun = {
    Goles: "goles",
    Córners: "córners",
    Tarjetas: "tarjetas",
    "Fueras de juego": "fueras de juego",
    Remates: "remates",
    "Remates a puerta": "remates a puerta",
    "Saques de puerta": "saques de puerta",
    "Saques de banda": "saques de banda",
    Entradas: "entradas",
    "Tiros libres": "tiros libres",
    Faltas: "faltas",
  }[section] || "ese dato";
  if (label.startsWith("Desde el minuto")) {
    const range = label.split(",")[0].replace("Desde", "desde");
    if (label.endsWith("recibidas")) return `tarjetas recibidas, ${range}`;
    if (label.endsWith("provocadas")) return `tarjetas provocadas, ${range}`;
    if (label.endsWith("en contra")) return `${noun} en contra, ${range}`;
    return `${noun} a favor, ${range}`;
  }
  const named = {
    Anotados: `${noun} anotados por partido`,
    Recibidos: `${noun} recibidos por partido`,
    "Anotados, 1.ª parte": `${noun} anotados en la primera parte`,
    "Recibidos, 1.ª parte": `${noun} recibidos en la primera parte`,
    "Anotados, 2.ª parte": `${noun} anotados en la segunda parte`,
    "Recibidos, 2.ª parte": `${noun} recibidos en la segunda parte`,
    "A favor": `${noun} a favor por partido`,
    "En contra": `${noun} en contra por partido`,
    "A favor, 1.ª parte": `${noun} a favor en la primera parte`,
    "En contra, 1.ª parte": `${noun} en contra en la primera parte`,
    "A favor, 2.ª parte": `${noun} a favor en la segunda parte`,
    "En contra, 2.ª parte": `${noun} en contra en la segunda parte`,
    Recibidas: "tarjetas que le sacan al equipo, por partido",
    Provocadas: "tarjetas que el equipo provoca, por partido",
    "Recibidas, 1.ª parte": "tarjetas que le sacan en la primera parte",
    "Provocadas, 1.ª parte": "tarjetas que provoca en la primera parte",
    "Recibidas, 2.ª parte": "tarjetas que le sacan en la segunda parte",
    "Provocadas, 2.ª parte": "tarjetas que provoca en la segunda parte",
    "Rojas a favor": "tarjetas rojas a favor por partido",
    "Rojas en contra": "tarjetas rojas en contra por partido",
    "Al equipo": "fueras de juego pitados al equipo, por partido",
    "Al rival": "fueras de juego pitados al rival, por partido",
  };
  return named[label] || `${noun}, ${label.toLowerCase()}`;
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
    const what = betWhat(title, line.label);
    const side = (team, rival, odd, fair, figure) => ({ team, rival, odd, hit: hit(fair), what, figure, label: line.label });
    return [{
      label: line.label,
      kind: line.kind,
      home: side(match.home, match.away, homeOdd, fairHome, line.homeText ?? num(line.home)),
      away: side(match.away, match.home, awayOdd, fairAway, line.awayText ?? num(line.away)),
    }];
  });
}

function betCard(side, kind) {
  const clue = kind === "registro"
    ? `Registro de ejemplo: ${side.figure}.`
    : `Media de ejemplo: ${side.figure} por partido.`;
  return `<div class="bet"><p>Apuesta a que <b>${side.team}</b> supera a ${side.rival} en ${side.what}. ${clue}</p><div class="odd"><small>${side.team}</small><b>${side.odd.toFixed(2)}</b><small class="odd-kind">cuota</small></div></div>`;
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
    const losses = Math.max(0, played - wins - draws);
    return { wins, draws, losses, text: `${wins} V · ${draws} E · ${losses} D` };
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
    goalsForBins: split(goalsFor, 6),
    goalsAgainstBins: split(goalsAgainst, 6),
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

function fold(title, note, body) {
  return `<details class="stat-fold"><summary><span>${title}</span><small>${note}</small></summary><div class="stat-body">${body}</div></details>`;
}

function linesFrom(home, away, rows) {
  return rows.map(([label, key]) => ({ label, home: home[key], away: away[key] }));
}

function section(match, title, note, lines) {
  const rows = priceLines(match, title, lines);
  const cards = rows
    .map((row) => `<p class="market-label">${row.label}</p><div class="odds bets">${betCard(row.home, row.kind)}${betCard(row.away, row.kind)}</div>`)
    .join("");
  return fold(title, note, `${cards}${actionsHtml(rows)}`);
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
    section(match, "Goles", "Por partido", [
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
    section(match, "Córners", "Por partido", linesFrom(home, away, [
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
    section(match, "Fueras de juego", "Pitados por partido", linesFrom(home, away, [
      ["Al equipo", "offsidesFor"],
      ["Al rival", "offsidesAgainst"],
    ])),
    section(match, "Remates", "Por partido", linesFrom(home, away, [
      ["A favor", "shotsFor"],
      ["En contra", "shotsAgainst"],
      ["A favor, 1.ª parte", "shotsFor1"],
      ["En contra, 1.ª parte", "shotsAgainst1"],
      ["A favor, 2.ª parte", "shotsFor2"],
      ["En contra, 2.ª parte", "shotsAgainst2"],
    ])),
    section(match, "Remates a puerta", "Por partido", linesFrom(home, away, [
      ["A favor", "sotFor"],
      ["En contra", "sotAgainst"],
      ["A favor, 1.ª parte", "sotFor1"],
      ["En contra, 1.ª parte", "sotAgainst1"],
      ["A favor, 2.ª parte", "sotFor2"],
      ["En contra, 2.ª parte", "sotAgainst2"],
    ])),
    section(match, "Saques de puerta", "Por partido", linesFrom(home, away, [
      ["A favor", "goalKicksFor"],
      ["En contra", "goalKicksAgainst"],
      ["A favor, 1.ª parte", "goalKicksFor1"],
      ["En contra, 1.ª parte", "goalKicksAgainst1"],
      ["A favor, 2.ª parte", "goalKicksFor2"],
      ["En contra, 2.ª parte", "goalKicksAgainst2"],
    ])),
    section(match, "Saques de banda", "Por partido", linesFrom(home, away, [
      ["A favor", "throwInsFor"],
      ["En contra", "throwInsAgainst"],
      ["A favor, 1.ª parte", "throwInsFor1"],
      ["En contra, 1.ª parte", "throwInsAgainst1"],
      ["A favor, 2.ª parte", "throwInsFor2"],
      ["En contra, 2.ª parte", "throwInsAgainst2"],
    ])),
    section(match, "Entradas", "Por partido", linesFrom(home, away, [
      ["A favor", "tacklesFor"],
      ["En contra", "tacklesAgainst"],
      ["A favor, 1.ª parte", "tacklesFor1"],
      ["En contra, 1.ª parte", "tacklesAgainst1"],
      ["A favor, 2.ª parte", "tacklesFor2"],
      ["En contra, 2.ª parte", "tacklesAgainst2"],
    ])),
    section(match, "Tiros libres", "Faltas sacadas, por partido", linesFrom(home, away, [
      ["A favor", "freeKicksFor"],
      ["En contra", "freeKicksAgainst"],
      ["A favor, 1.ª parte", "freeKicksFor1"],
      ["En contra, 1.ª parte", "freeKicksAgainst1"],
      ["A favor, 2.ª parte", "freeKicksFor2"],
      ["En contra, 2.ª parte", "freeKicksAgainst2"],
    ])),
    section(match, "Faltas", "Por partido", linesFrom(home, away, [
      ["A favor", "foulsFor"],
      ["En contra", "foulsAgainst"],
      ["A favor, 1.ª parte", "foulsFor1"],
      ["En contra, 1.ª parte", "foulsAgainst1"],
      ["A favor, 2.ª parte", "foulsFor2"],
      ["En contra, 2.ª parte", "foulsAgainst2"],
    ])),
    section(match, "Resultados", "Victorias, empates y derrotas", [
      recordLine("Partido", home.results, away.results),
      recordLine("Al descanso", home.resultsHalf, away.resultsHalf),
      recordLine("Desde el minuto 0 al 15", home.results10, away.results10),
    ]),
  ];
  return `<p class="sub stat-note">Encima de cada recuadro está la apuesta. El número azul es la cuota, siempre mayor que 1: cuanto más baja, más probable es. La media o el registro van en el texto, solo para explicar de dónde sale. Los tramos son de 15 minutos.</p>${sections.join("")}`;
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
                expanded ? `<div class="fixture-panel">${statsBlock(match)}</div>` : ""
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
