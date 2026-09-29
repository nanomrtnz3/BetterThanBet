/**
 * Escribe data/football.xml desde las APIs gratuitas.
 * La web no llama a estas APIs: solo lee el XML.
 *
 *   node tools/sync-cache.mjs
 *
 * Bzzoiro: goleadores, tarjetas, winrate, cuotas consenso y % del modelo.
 * API-Football: solo cuotas en directo, y como mucho API_FOOTBALL_DAILY_CAP veces al día.
 */
import { readFile, rename, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
  buildAlerts,
  eventId,
  fixturePriority,
  isLiveStatus,
  leagueId,
  mapApiFootballLive,
  mapCards,
  mapLiveEvent,
  mapScorers,
  mapStandings,
  mapUpcomingEvent,
  marketsFromOdds,
  oddsBlock,
  oddsFromBookmakers,
  overlayLiveOdds,
  predictionProbs,
  resultsOf,
  standingsRows,
  streaksFromTable,
  toXml,
} from "./assemble.mjs";
import { loadEnv } from "./env.mjs";
import { annotateProbabilities } from "./probability.mjs";

const root = process.env.DATA_DIR || join(dirname(fileURLToPath(import.meta.url)), "..");
const xmlPath = join(root, "data", "football.xml");
const snapshotPath = join(root, "data", "snapshot.json");
const leaguesPath = join(root, "data", "leagues.json");
const quotaPath = join(root, "data", "quota.json");

const LEAGUE_MATCHERS = [
  { key: "laliga", label: "LaLiga", test: (name, country) => /spain|españa/i.test(country) && /(la ?liga|primera)/i.test(name) && !/2|segunda|femenin|women/i.test(name) },
  { key: "premier", label: "Premier League", test: (name, country) => /england|inglaterra/i.test(country) && /premier league/i.test(name) && !/2|women|femenin/i.test(name) },
  { key: "seriea", label: "Serie A", test: (name, country) => /italy|italia/i.test(country) && /serie a/i.test(name) && !/b|women|femenin/i.test(name) },
  { key: "bundesliga", label: "Bundesliga", test: (name, country) => /germany|alemania/i.test(country) && /bundesliga/i.test(name) && !/2|women|femenin/i.test(name) },
  { key: "ucl", label: "Champions League", test: (name) => /champions league/i.test(name) && !/women|femenin/i.test(name) },
  { key: "nations", label: "Nations League", test: (name) => /nations league/i.test(name) && !/women|femenin|u19|u21/i.test(name) },
];

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function hoursSince(iso) {
  if (!iso) return Infinity;
  return (Date.now() - new Date(iso).getTime()) / 36e5;
}

async function readJson(path, fallback) {
  try {
    return JSON.parse(await readFile(path, "utf8"));
  } catch {
    return fallback;
  }
}

async function bzzoiroGet(path) {
  const key = process.env.BZZOIRO_API_KEY;
  const url = path.startsWith("http") ? path : `https://sports.bzzoiro.com/api/v2/${path.replace(/^\//, "")}`;
  const res = await fetch(url, {
    headers: { Authorization: `Token ${key}`, Accept: "application/json" },
  });
  if (res.status === 429) {
    const error = new Error("Bzzoiro ha limitado las peticiones (429). Este ciclo se detiene.");
    error.code = 429;
    throw error;
  }
  if (!res.ok) {
    const error = new Error(`Bzzoiro ${res.status} ${url}`);
    error.code = res.status;
    throw error;
  }
  return res.json();
}

function leagueCountry(league) {
  const country = league.country;
  if (typeof country === "string") return country;
  return country?.name || league.country_name || "";
}

async function discoverLeagues() {
  const cached = await readJson(leaguesPath, null);
  const wanted = new Set(LEAGUE_MATCHERS.map((item) => item.key));
  const cachedKeys = new Set((cached?.leagues || []).map((league) => league.key));
  const cacheComplete = [...wanted].every((key) => cachedKeys.has(key));
  if (cached?.leagues?.length && cacheComplete && hoursSince(cached.savedAt) < 24 * 7) return cached.leagues;

  const found = [];
  const countries = ["Spain", "England", "Italy", "Germany", "Europe"];
  const seen = new Set();
  for (const country of countries) {
    const body = await bzzoiroGet(`leagues/?country=${encodeURIComponent(country)}&limit=100`);
    for (const league of resultsOf(body)) {
      const name = league.name || "";
      const countryName = leagueCountry(league) || country;
      const matcher = LEAGUE_MATCHERS.find((item) => item.test(name, countryName));
      if (!matcher || seen.has(matcher.key)) continue;
      seen.add(matcher.key);
      found.push({ key: matcher.key, id: league.id, label: matcher.label, name });
    }
  }
  if (!found.length) throw new Error("No se reconocieron ligas en Bzzoiro. Revisa la clave.");
  await writeFile(leaguesPath, JSON.stringify({ savedAt: new Date().toISOString(), leagues: found }, null, 2));
  console.log("Ligas:", found.map((league) => `${league.label} (${league.id})`).join(", "));
  return found;
}

async function refreshStats(leagues) {
  const scorers = [];
  const cards = [];
  const tables = [];
  for (const league of leagues) {
    const tableBody = await bzzoiroGet(`leagues/${league.id}/standings/`);
    const scorerBody = await bzzoiroGet(`leagues/${league.id}/top/scorers/?limit=8`);
    const assistBody = await bzzoiroGet(`leagues/${league.id}/top/assists/?limit=20`);
    const yellowBody = await bzzoiroGet(`leagues/${league.id}/top/yellowcards/?limit=8`);
    const redBody = await bzzoiroGet(`leagues/${league.id}/top/redcards/?limit=20`);
    const assists = new Map(
      resultsOf(assistBody).map((row) => [Number(row.player_id ?? row.id), Number(row.value) || 0])
    );
    const seasonId = tableBody?.season?.id;
    scorers.push(
      ...mapScorers(resultsOf(scorerBody), league.label, assists).map((player) => ({
        ...player,
        seasonId,
      }))
    );
    cards.push(...mapCards(resultsOf(yellowBody), resultsOf(redBody), league.label));
    tables.push(...mapStandings(standingsRows(tableBody), league.label));
  }
  scorers.sort((a, b) => b.goals - a.goals || b.assists - a.assists);
  scorers.forEach((row, index) => {
    row.rank = index + 1;
  });
  cards.sort((a, b) => b.yellowAvg - a.yellowAvg);
  cards.forEach((row, index) => {
    row.rank = index + 1;
  });
  const strength = tables.filter((row) => row.played >= 2);
  const winrate = [...tables]
    .filter((row) => row.played >= 4)
    .sort((a, b) => b.winrate - a.winrate || b.played - a.played)
    .slice(0, 6)
    .map((row, index) => ({ ...row, rank: index + 1 }));
  const leaders = scorers.slice(0, 8);
  const shots = [];
  for (const player of leaders) {
    if (!player.id || !player.seasonId) continue;
    const totals = await seasonShots(player);
    if (!totals) continue;
    shots.push({
      name: player.name,
      team: player.team,
      league: player.league,
      ...totals,
    });
  }
  shots.sort((a, b) => b.shotsPerGame - a.shotsPerGame || b.sotPerGame - a.sotPerGame);
  shots.forEach((row, index) => {
    row.rank = index + 1;
  });
  const seenShots = new Set(shots.map((row) => row.name));
  const propShots = [];
  for (const player of scorers.filter((row) => row.league === "Nations League").slice(0, 8)) {
    if (!player.id || !player.seasonId || seenShots.has(player.name)) continue;
    const totals = await seasonShots(player);
    if (!totals) continue;
    propShots.push({ name: player.name, team: player.team, league: player.league, ...totals });
  }
  return {
    savedAt: new Date().toISOString(),
    version: 3,
    topScorers: leaders,
    cards: cards.slice(0, 8),
    cardPool: cards,
    winrate,
    strength,
    shots,
    propShots,
    streaks: streaksFromTable(winrate),
  };
}

async function seasonShots(player) {
  const body = await bzzoiroGet(`players/${player.id}/stats/?season_id=${player.seasonId}&limit=40`);
  let totalShots = 0;
  let onTarget = 0;
  let apps = 0;
  for (const row of resultsOf(body)) {
    apps += 1;
    totalShots += Number(row.total_shots) || 0;
    onTarget += Number(row.shots_on_target) || 0;
  }
  const matches = apps || player.matches || 0;
  if (!matches || !onTarget) return null;
  return {
    shots: totalShots,
    sot: onTarget,
    matches,
    shotsPerGame: Math.round((totalShots / matches) * 100) / 100,
    sotPerGame: Math.round((onTarget / matches) * 100) / 100,
  };
}

function dateShift(days) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

async function refreshFixtures(leagues) {
  const ids = new Set(leagues.map((league) => Number(league.id)));
  const labels = new Map(leagues.map((league) => [Number(league.id), league.label]));
  const from = dateShift(0);
  const to = dateShift(14);
  const liveBody = await bzzoiroGet("events/live/");
  const liveEvents = resultsOf(liveBody).filter((event) => ids.has(Number(leagueId(event))));
  const upcomingEvents = [];
  for (const league of leagues) {
    const body = await bzzoiroGet(
      `events/?league_id=${league.id}&status=notstarted&date_from=${from}&date_to=${to}&limit=${league.key === "nations" ? 40 : 12}`
    );
    for (const event of resultsOf(body)) {
      if (!event.league && !event.league_name) event.league_name = labels.get(Number(league.id)) || league.label;
      if (!event.league_id) event.league_id = league.id;
      upcomingEvents.push(event);
    }
  }
  upcomingEvents.sort((a, b) => String(a.event_date || a.date || "").localeCompare(String(b.event_date || b.date || "")));
  const soon = upcomingEvents.slice(0, 40);
  const wanted = new Set(soon.map((event) => eventId(event)));
  const probsById = new Map();
  for (let offset = 0; offset < 300 && probsById.size < wanted.size; offset += 100) {
    const predictionsBody = await bzzoiroGet(
      `predictions/?date_from=${from}&date_to=${to}&limit=100&offset=${offset}`
    );
    const rows = resultsOf(predictionsBody);
    if (!rows.length) break;
    for (const row of rows) {
      const id = eventId(row.event || row);
      if (id == null || !wanted.has(id)) continue;
      if (row.event?.league_id && !ids.has(Number(row.event.league_id))) continue;
      probsById.set(id, predictionProbs(row));
    }
    if (rows.length < 100) break;
  }
  for (const event of soon) {
    const id = eventId(event);
    if (id == null || probsById.has(id)) continue;
    try {
      const body = await bzzoiroGet(`events/${id}/prediction/`);
      const row = body?.markets ? body : body?.data;
      if (row?.markets) probsById.set(id, predictionProbs(row));
    } catch (error) {
      if (error.code === 429) throw error;
    }
  }
  return { liveEvents, upcomingEvents: soon, probsById };
}

async function oddsFor(events) {
  const map = new Map();
  const queue = events.filter((event) => eventId(event) != null).slice(0, 8);
  for (const event of queue) {
    const id = eventId(event);
    try {
      const body = await bzzoiroGet(`events/${id}/odds/`);
      map.set(id, oddsBlock(body));
    } catch (error) {
      if (error.code === 429) throw error;
      console.warn(`Sin cuotas para el partido ${id}: ${error.message}`);
    }
  }
  return map;
}

async function apiFootballGet(path) {
  const key = process.env.API_FOOTBALL_KEY;
  if (!key) return null;
  const cap = Number(process.env.API_FOOTBALL_DAILY_CAP || 40);
  const quota = await readJson(quotaPath, { day: todayKey(), count: 0, lastAt: null });
  if (quota.day !== todayKey()) {
    quota.day = todayKey();
    quota.count = 0;
  }
  if (quota.count >= cap) {
    console.log(`API-Football agotada hoy (${quota.count}/${cap}).`);
    return null;
  }
  const res = await fetch(`https://v3.football.api-sports.io/${path}`, {
    headers: { "x-apisports-key": key },
  });
  quota.count += 1;
  quota.lastAt = new Date().toISOString();
  await writeFile(quotaPath, JSON.stringify(quota, null, 2));
  if (!res.ok) {
    console.warn(`API-Football ${res.status} en ${path}`);
    return null;
  }
  const body = await res.json();
  if (body.errors && Object.keys(body.errors).length) {
    console.warn(`API-Football: ${JSON.stringify(body.errors)}`);
    return null;
  }
  console.log(`API-Football ${quota.count}/${cap}: ${path}`);
  return body;
}

async function fetchPricedBoard() {
  const fixtures = [];
  for (const date of [dateShift(0), dateShift(1)]) {
    const body = await apiFootballGet(`fixtures?date=${date}`);
    if (body?.response) fixtures.push(...body.response);
  }
  const done = new Set(["FT", "AET", "PEN", "CANC", "ABD", "AWD", "WO"]);
  const open = fixtures
    .filter((fixture) => fixturePriority(fixture) > 1 && !done.has(fixture.fixture?.status?.short))
    .sort((a, b) => {
      const rank = fixturePriority(b) - fixturePriority(a);
      if (rank) return rank;
      return String(a.fixture?.date || "").localeCompare(String(b.fixture?.date || ""));
    });
  const matches = [];
  let attempts = 0;
  for (const fixture of open) {
    if (matches.length >= 8 || attempts >= 12) break;
    attempts += 1;
    await new Promise((resolve) => setTimeout(resolve, 400));
    let body = await apiFootballGet(`odds?fixture=${fixture.fixture.id}`);
    if (!body) {
      await new Promise((resolve) => setTimeout(resolve, 2500));
      body = await apiFootballGet(`odds?fixture=${fixture.fixture.id}`);
    }
    if (!body) continue;
    const odds = oddsFromBookmakers(body.response?.[0]?.bookmakers);
    if (odds.home == null) continue;
    const status = fixture.fixture?.status?.short || "NS";
    matches.push({
      id: fixture.fixture.id,
      status,
      league: fixture.league?.name || "",
      home: fixture.teams?.home?.name || "",
      away: fixture.teams?.away?.name || "",
      kickoff: fixture.fixture?.date || "",
      minute: fixture.fixture?.status?.elapsed ?? "",
      scoreHome: fixture.goals?.home ?? 0,
      scoreAway: fixture.goals?.away ?? 0,
      markets: marketsFromOdds(odds, { live: isLiveStatus(status) }),
      _odds: odds,
    });
  }
  console.log(`Cuotas con precio: ${matches.length}.`);
  return { savedAt: new Date().toISOString(), version: 2, matches };
}

async function maybeLiveOddsFromApiFootball(hasLive) {
  const key = process.env.API_FOOTBALL_KEY;
  if (!key || !hasLive) return { matches: [], used: false };
  const cap = Number(process.env.API_FOOTBALL_DAILY_CAP || 40);
  const quota = await readJson(quotaPath, { day: todayKey(), count: 0, lastAt: null });
  if (quota.day !== todayKey()) {
    quota.day = todayKey();
    quota.count = 0;
  }
  const minutesSince = quota.lastAt ? (Date.now() - new Date(quota.lastAt).getTime()) / 60000 : Infinity;
  if (quota.count >= cap || minutesSince < 30) {
    console.log(`API-Football en pausa (${quota.count}/${cap} hoy).`);
    return { matches: [], used: false };
  }
  const res = await fetch("https://v3.football.api-sports.io/odds/live", {
    headers: { "x-apisports-key": key },
  });
  quota.count += 1;
  quota.lastAt = new Date().toISOString();
  await writeFile(quotaPath, JSON.stringify(quota, null, 2));
  if (!res.ok) {
    console.warn(`API-Football ${res.status}. Se conservan las cuotas de Bzzoiro.`);
    return { matches: [], used: true };
  }
  const body = await res.json();
  console.log(`API-Football cuotas en directo: ${quota.count}/${cap} hoy.`);
  return { matches: mapApiFootballLive(body), used: true };
}

async function writeXml(model) {
  const xml = toXml(model);
  const temp = `${xmlPath}.tmp`;
  await writeFile(temp, xml, "utf8");
  await rm(xmlPath, { force: true });
  await rename(temp, xmlPath);
}

export async function syncOnce() {
  await loadEnv(root);
  if (!process.env.BZZOIRO_API_KEY) {
    console.log("Falta BZZOIRO_API_KEY en .env. El XML de ejemplo no se toca.");
    console.log("Regístrate en https://sports.bzzoiro.com/register/ y pega la clave en .env");
    return { wrote: false };
  }

  const everyMinutes = Number(process.env.SYNC_EVERY_MINUTES || 15);
  const statsHours = Number(process.env.STATS_EVERY_HOURS || 12);
  const previous = await readJson(snapshotPath, null);
  let pricedBoard = previous?.apiFootballBoard;
  if (!pricedBoard?.matches?.length || pricedBoard.version !== 2 || hoursSince(pricedBoard.savedAt) >= 8) {
    console.log("Buscando cuotas de hoy y mañana…");
    const fresh = await fetchPricedBoard();
    if (fresh?.matches?.length) pricedBoard = fresh;
  } else {
    console.log("Cuotas de API-Football aún frescas; no se vuelven a pedir.");
  }

  const leagues = await discoverLeagues();
  let stats = previous?.stats;
  if (!stats || stats.version !== 3 || hoursSince(stats.savedAt) >= statsHours) {
    console.log("Actualizando goleadores, tarjetas y winrate…");
    stats = await refreshStats(leagues);
  } else {
    console.log("Estadísticas aún frescas; no se vuelven a pedir.");
  }

  console.log("Actualizando partidos, cuotas y probabilidades…");
  const fixtures = await refreshFixtures(leagues);
  const oddsEvents = [...fixtures.liveEvents, ...fixtures.upcomingEvents];
  const odds = await oddsFor(oddsEvents);

  let live = fixtures.liveEvents.map((event) => mapLiveEvent(event, odds.get(eventId(event))));
  const football = await maybeLiveOddsFromApiFootball(live.length > 0);
  live = overlayLiveOdds(live, football.matches);

  const fromBzzoiro = fixtures.upcomingEvents.map((event) => {
    const id = eventId(event);
    const block = odds.get(id) || {};
    const match = mapUpcomingEvent(event, block);
    match._odds = block;
    return match;
  });
  const priced = pricedBoard?.matches || [];
  const hasPrice = (match) => match.markets?.some((market) => market.type === "1x2" && market.outcomes?.length);
  const teamKey = (name) =>
    String(name || "")
      .normalize("NFD")
      .replace(/\p{Diacritic}/gu, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .trim();
  const propTeams = new Set(
    [...(stats.propShots || []), ...(stats.shots || []), ...(stats.cardPool || stats.cards || [])].map((row) => teamKey(row.team))
  );
  const pricedOnes = [...priced.filter((item) => !isLiveStatus(item.status)), ...fromBzzoiro.filter(hasPrice)];
  const nations = fromBzzoiro.filter((match) => /nations league/i.test(match.league || ""));
  const starred = [];
  const usedPlayers = new Set();
  const shooters = [...(stats.propShots || [])].sort((a, b) => (b.sotPerGame || 0) - (a.sotPerGame || 0));
  for (const player of shooters) {
    if (usedPlayers.has(player.name)) continue;
    const match = nations.find(
      (item) => teamKey(item.home) === teamKey(player.team) || teamKey(item.away) === teamKey(player.team)
    );
    if (!match || starred.includes(match)) continue;
    starred.push(match);
    usedPlayers.add(player.name);
    if (starred.length >= 2) break;
  }
  const otherNations = nations.filter((match) => !starred.includes(match));
  const seen = new Set();
  const upcoming = [];
  for (const match of [...starred, ...pricedOnes, ...otherNations]) {
    const key = `${match.home}|${match.away}`.toLowerCase();
    if (!key.trim() || seen.has(key)) continue;
    seen.add(key);
    upcoming.push(match);
    if (upcoming.length >= 8) break;
  }
  const pricedLive = priced
    .filter((match) => isLiveStatus(match.status) && hasPrice(match))
    .map((match) => ({
      ...match,
      scoreHome: match.scoreHome ?? "",
      scoreAway: match.scoreAway ?? "",
    }));
  live = [...pricedLive, ...live.filter(hasPrice)];
  const calculated = annotateProbabilities(upcoming, stats.strength || stats.winrate, {
    shots: [...(stats.shots || []), ...(stats.propShots || [])],
    cards: stats.cardPool || stats.cards || [],
  });
  const alerts = calculated.length ? calculated : buildAlerts(upcoming, fixtures.probsById);
  for (const match of upcoming) delete match._odds;

  const model = {
    generatedAt: new Date().toISOString(),
    source: priced?.length || football.used ? "bzzoiro+api-football" : "bzzoiro",
    ttlMinutes: everyMinutes,
    season: "2026/27",
    topScorers: stats.topScorers,
    cards: stats.cards,
    winrate: stats.winrate,
    shots: stats.shots || [],
    streaks: stats.streaks,
    live,
    upcoming,
    alerts,
  };

  await writeFile(
    snapshotPath,
    JSON.stringify({ stats, apiFootballBoard: pricedBoard, generatedAt: model.generatedAt }, null, 2)
  );
  await writeXml(model);
  console.log(
    `XML escrito: ${live.length} en directo, ${upcoming.length} a futuro, ${alerts.length} alertas de valor.`
  );
  return { wrote: true, model };
}

const invoked = process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url;
if (invoked) {
  syncOnce().catch((error) => {
    console.error(error.message || error);
    process.exitCode = 1;
  });
}
