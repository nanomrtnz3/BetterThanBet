import { devig } from "../tools/probability.mjs";

export const COMPS = [
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

export function mulberry32(seed) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hashName(name) {
  let hash = 2166136261;
  for (const char of name) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619);
  return hash >>> 0;
}

export function decimal(probability, rand) {
  const margin = 1.05 + rand() * 0.03;
  return Math.round((margin / Math.max(0.06, probability)) * 100) / 100;
}

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

export const FIXTURES = buildFixtures();

export function dayKey(iso) {
  const date = new Date(iso);
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

export function dayLabel(iso) {
  return new Date(iso).toLocaleDateString("es-ES", { weekday: "long", day: "2-digit", month: "long" });
}

export function hourLabel(iso) {
  return new Date(iso).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });
}

const profiles = new Map();

export function profile(name) {
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

const FIRST = ["Hugo", "Marc", "Leo", "Álvaro", "Iker", "Nico", "Pablo", "Diego", "Mario", "Sergio", "Ander", "Unai", "Raúl", "Adrián", "Bruno", "Mateo", "Enzo", "Thiago", "Lucas", "Martín", "Gael", "Nil"];
const LAST = ["García", "López", "Martín", "Ruiz", "Navarro", "Santos", "Vega", "Romero", "Iglesias", "Castro", "Ortiz", "Rubio", "Molina", "Serrano", "Blanco", "Reyes", "Campos", "Vidal", "León", "Herrera"];
const NOTES = ["molestia muscular", "rodilla", "tobillo", "isquio"];
const squads = new Map();

export function slug(value) {
  return value.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

export function yellowText(n) {
  const yellows = Number(n) || 0;
  if (yellows === 0) return "0/5 · faltan 5";
  if (yellows % 5 === 0) return `${yellows} · sanción por acumulación`;
  return `${yellows} · ${yellows % 5}/5 · faltan ${5 - (yellows % 5)}`;
}

export function squad(team) {
  const cached = squads.get(team);
  if (cached) return cached;
  const rand = mulberry32(hashName(`squad:${team}`) || 1);
  const positions = ["POR", "DEF", "DEF", "DEF", "DEF", "MED", "MED", "MED", "DEL", "DEL", "DEL", "DEF", "MED", "DEL", "MED", "POR"];
  const used = new Set();
  const players = positions.map((pos) => {
    let name = "";
    for (let i = 0; i < 8 && (!name || used.has(name)); i += 1) {
      name = `${FIRST[Math.floor(rand() * FIRST.length)]} ${LAST[Math.floor(rand() * LAST.length)]}`;
    }
    used.add(name);
    return { name, pos, team, yellows: Math.floor(rand() * 5), status: "ok", note: "" };
  });
  if (rand() < 0.8) {
    const player = players[13];
    player.status = "lesionado";
    player.note = NOTES[Math.floor(rand() * NOTES.length)];
  }
  if (rand() < 0.45) {
    const player = players[4];
    player.status = "lesionado";
    player.note = NOTES[Math.floor(rand() * NOTES.length)];
  }
  if (rand() < 0.85) {
    const player = players[10];
    player.status = "sancionado";
    player.yellows = 5 + Math.floor(rand() * 3);
    player.note = "acumulación de amarillas";
  }
  const xi = [];
  const need = { POR: 1, DEF: 4, MED: 3, DEL: 3 };
  for (const player of players) {
    if (player.status !== "ok" || need[player.pos] <= 0) continue;
    need[player.pos] -= 1;
    xi.push(player);
  }
  for (const player of players) {
    if (xi.length >= 11) break;
    if (player.status === "ok" && !xi.includes(player)) xi.push(player);
  }
  const row = {
    team,
    xi,
    bench: players.filter((player) => player.status === "ok" && !xi.includes(player)),
    injured: players.filter((player) => player.status === "lesionado"),
    suspended: players.filter((player) => player.status === "sancionado"),
    all: players,
  };
  squads.set(team, row);
  return row;
}

export function searchBlob(match) {
  const names = [...squad(match.home).all, ...squad(match.away).all].map((player) => player.name).join(" ");
  return `${match.home} ${match.away} ${match.league} ${names}`;
}

function hitOf(fair) {
  return Math.round(fair * 1000) / 10;
}

export function goalQuote(match) {
  const home = profile(match.home);
  const away = profile(match.away);
  const total = home.goalsFor + away.goalsFor;
  const pHome = Math.min(0.82, Math.max(0.18, total > 0 ? home.goalsFor / total : 0.5));
  const rand = mulberry32(hashName(`${match.id}:Goles`) || 1);
  const homeOdd = Math.max(1.01, decimal(pHome, rand));
  const awayOdd = Math.max(1.01, decimal(1 - pHome, rand));
  const [fairHome, fairAway] = devig([homeOdd, awayOdd]);
  return {
    home: { team: match.home, odd: homeOdd, hit: hitOf(fairHome) },
    away: { team: match.away, odd: awayOdd, hit: hitOf(fairAway) },
  };
}

export const BOOKS = [
  { id: "bet365", name: "Bet365", factor: 0.98 },
  { id: "william-hill", name: "William Hill", factor: 1.04 },
  { id: "betfair", name: "Betfair", factor: 0.96 },
  { id: "codere", name: "Codere", factor: 1.07 },
];

export function bookQuote(match, book) {
  const base = goalQuote(match);
  const rand = mulberry32(hashName(`${match.id}:${book.id}`) || 1);
  const jitter = 0.99 + rand() * 0.03;
  const homeOdd = Math.max(1.01, Math.round(base.home.odd * book.factor * jitter * 100) / 100);
  const awayOdd = Math.max(1.01, Math.round(base.away.odd * (2 - book.factor) * jitter * 100) / 100);
  const [fairHome, fairAway] = devig([homeOdd, awayOdd]);
  return {
    home: { team: match.home, odd: homeOdd, hit: hitOf(fairHome) },
    away: { team: match.away, odd: awayOdd, hit: hitOf(fairAway) },
  };
}

const PROP_MARKETS = [
  { key: "gol", label: "marca", base: 0.22 },
  { key: "asistencia", label: "da una asistencia", base: 0.16 },
  { key: "tarjeta", label: "ve tarjeta", base: 0.2 },
];

function propPrice(match, player, market) {
  const rand = mulberry32(hashName(`${match.id}:${player.team}:${player.name}:${market.key}`) || 1);
  let chance = market.base + (rand() - 0.5) * 0.08;
  if (player.pos === "DEL" && market.key === "gol") chance += 0.12;
  if (player.pos === "DEF" && market.key === "gol") chance = 0.07 + rand() * 0.04;
  if (player.pos === "POR" && market.key !== "tarjeta") chance = 0.04 + rand() * 0.03;
  if (player.pos === "POR" && market.key === "tarjeta") chance = 0.06 + rand() * 0.04;
  chance = Math.min(0.7, Math.max(0.05, chance));
  const yes = Math.max(1.01, decimal(chance, rand));
  const no = Math.max(1.01, decimal(1 - chance, rand));
  const [fair] = devig([yes, no]);
  return { odd: yes, hit: hitOf(fair) };
}

export function playerProps(match) {
  const ordered = [...squad(match.home).xi, ...squad(match.away).xi];
  const picks = [...ordered.filter((player) => player.pos === "DEL"), ...ordered.filter((player) => player.pos === "MED")].slice(0, 4);
  return picks.flatMap((player) => PROP_MARKETS.map((market) => {
    const price = propPrice(match, player, market);
    return {
      id: `p:${match.id}:${slug(player.team)}:${slug(player.name)}:${market.key}`,
      player,
      market,
      ...price,
    };
  }));
}

export function resolveLeg(id) {
  const parts = id.split(":");
  const kind = parts[0];
  const match = FIXTURES.find((item) => item.id === parts[1]);
  if (!match) return null;
  const detail = `${match.home} vs ${match.away}`;
  if (kind === "g") {
    const quote = goalQuote(match);
    const side = parts[2] === "a" ? quote.away : quote.home;
    const rival = side === quote.home ? quote.away.team : quote.home.team;
    return { id, title: `${side.team} marca más goles que ${rival} en el encuentro`, detail, odd: side.odd, hit: side.hit };
  }
  if (kind === "b") {
    const book = BOOKS.find((item) => item.id === parts[2]);
    if (!book) return null;
    const quote = bookQuote(match, book);
    const side = parts[3] === "a" ? quote.away : quote.home;
    const rival = side === quote.home ? quote.away.team : quote.home.team;
    return { id, title: `${side.team} marca más goles que ${rival} en el encuentro · ${book.name}`, detail, odd: side.odd, hit: side.hit };
  }
  if (kind === "p") {
    const market = PROP_MARKETS.find((item) => item.key === parts[4]);
    const person = [...squad(match.home).all, ...squad(match.away).all].find((player) => slug(player.team) === parts[2] && slug(player.name) === parts[3]);
    if (!market || !person || person.status !== "ok") return null;
    const price = propPrice(match, person, market);
    return { id, title: `${person.name} ${market.label} en el encuentro`, detail: `${person.team} · ${detail}`, odd: price.odd, hit: price.hit };
  }
  return null;
}
