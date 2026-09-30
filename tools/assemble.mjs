/** Convierte respuestas de Bzzoiro / API-Football al modelo que serializa el XML. */

export function num(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export function pick(obj, keys) {
  if (!obj) return undefined;
  for (const key of keys) {
    if (obj[key] != null && obj[key] !== "") return obj[key];
  }
  return undefined;
}

export function resultsOf(body) {
  if (Array.isArray(body)) return body;
  if (Array.isArray(body?.leaders)) return body.leaders;
  if (Array.isArray(body?.results)) return body.results;
  if (Array.isArray(body?.events)) return body.events;
  if (Array.isArray(body?.data)) return body.data;
  if (Array.isArray(body?.standings)) return body.standings;
  return [];
}

export function teamName(event, side) {
  const direct = pick(event, [`${side}_team`, `${side}_team_name`, side]);
  if (typeof direct === "string") return direct;
  if (direct && typeof direct === "object") {
    return pick(direct, ["name", "team_name", "short_name"]) || "";
  }
  return "";
}

export function leagueName(event) {
  const league = event?.league ?? event?.competition;
  if (typeof league === "string") return league;
  return pick(league, ["name"]) || pick(event, ["league_name", "competition_name"]) || "";
}

export function leagueId(event) {
  const league = event?.league;
  if (typeof league === "number") return league;
  return num(pick(event, ["league_id"])) ?? num(pick(league, ["id"]));
}

export function eventId(event) {
  return num(pick(event, ["id", "event_id", "fixture_id"]));
}

export function kickoffOf(event) {
  return pick(event, ["event_date", "date", "kickoff", "start_time", "starting_at", "utc_date"]) || "";
}

export function minuteOf(event) {
  const minute = pick(event, ["current_minute", "minute", "elapsed"]);
  return minute == null ? "" : String(minute);
}

function formString(value) {
  if (Array.isArray(value)) {
    return value
      .map((item) => (typeof item === "string" ? item : item?.result || item?.form || ""))
      .join("")
      .toUpperCase()
      .replace(/[^WDL]/g, "");
  }
  return String(value || "")
    .toUpperCase()
    .replace(/[^WDL]/g, "");
}

export function standingsRows(body) {
  if (body?.groups && typeof body.groups === "object" && !Array.isArray(body.groups)) {
    return Object.values(body.groups).flatMap((group) => (Array.isArray(group) ? group : group?.standings || group?.rows || []));
  }
  if (Array.isArray(body?.groups)) {
    return body.groups.flatMap((group) => group.standings || group.rows || group.table || []);
  }
  if (Array.isArray(body?.standings)) return body.standings;
  return resultsOf(body);
}

export function mapStandings(rows, leagueLabel) {
  return rows
    .map((row) => {
      const played = num(pick(row, ["played", "matches_played", "matches", "mp", "games"])) ?? 0;
      const wins = num(pick(row, ["won", "wins", "win", "w"])) ?? 0;
      const draws = num(pick(row, ["drawn", "draws", "draw", "d"])) ?? 0;
      const losses = num(pick(row, ["lost", "losses", "lose", "l"])) ?? 0;
      const winrate = played > 0 ? Math.round((wins / played) * 1000) / 10 : 0;
      return {
        name: pick(row, ["team_name", "name"]) || teamName(row, "team") || "Equipo",
        league: leagueLabel,
        winrate,
        wins,
        draws,
        losses,
        gf: num(pick(row, ["goals_for", "gf", "goalsFor", "scored"])) ?? 0,
        ga: num(pick(row, ["goals_against", "ga", "goalsAgainst", "conceded"])) ?? 0,
        form: formString(pick(row, ["form", "recent_form"])).slice(-5),
        played,
      };
    })
    .filter((team) => team.played > 0)
    .sort((a, b) => b.winrate - a.winrate || b.wins - a.wins);
}

export function mapScorers(rows, leagueLabel, assistsById) {
  return rows.slice(0, 12).map((row, index) => {
    const id = num(pick(row, ["player_id", "id"]));
    const goals = num(pick(row, ["value", "goals", "total"])) ?? 0;
    const matches = num(pick(row, ["matches", "appearances", "played"])) ?? 0;
    const minutes = num(pick(row, ["minutes"])) ?? 0;
    const assists = assistsById?.get(id) ?? num(pick(row, ["assists"])) ?? 0;
    const per90 = minutes > 0 ? (goals * 90) / minutes : matches > 0 ? goals / matches : 0;
    return {
      id,
      rank: index + 1,
      name: pick(row, ["player_name", "name"]) || "Jugador",
      team: pick(row, ["team_name", "team"]) || "",
      league: leagueLabel,
      goals,
      assists,
      matches,
      per90: Math.round(per90 * 100) / 100,
    };
  });
}

export function mapCards(yellowRows, redRows, leagueLabel) {
  const reds = new Map();
  for (const row of redRows) {
    const id = num(pick(row, ["player_id", "id"]));
    if (id != null) reds.set(id, num(pick(row, ["value", "red", "total"])) ?? 0);
  }
  return yellowRows
    .map((row) => {
      const id = num(pick(row, ["player_id", "id"]));
      const matches = num(pick(row, ["matches", "appearances", "played"])) ?? 0;
      const yellow = num(pick(row, ["value", "yellow", "total"])) ?? 0;
      const red = (id != null && reds.get(id)) || 0;
      return {
        name: pick(row, ["player_name", "name"]) || "Jugador",
        team: pick(row, ["team_name", "team"]) || "",
        league: leagueLabel,
        yellow,
        red,
        matches,
        yellowAvg: matches > 0 ? yellow / matches : yellow,
        redAvg: matches > 0 ? red / matches : red,
      };
    })
    .sort((a, b) => b.yellowAvg - a.yellowAvg || b.redAvg - a.redAvg)
    .slice(0, 8)
    .map((player, index) => ({ ...player, rank: index + 1 }));
}

export function oddsBlock(payload) {
  const odds = payload?.odds || payload || {};
  return {
    home: num(pick(odds, ["home_win", "home"])),
    draw: num(pick(odds, ["draw"])),
    away: num(pick(odds, ["away_win", "away"])),
    over25: num(pick(odds, ["over_25_goals", "over_25"])),
    under25: num(pick(odds, ["under_25_goals", "under_25"])),
    bttsYes: num(pick(odds, ["btts_yes"])),
    bttsNo: num(pick(odds, ["btts_no"])),
  };
}

export function predictionProbs(pred) {
  const markets = pred?.markets || pred?.predictions || pred || {};
  const result = markets.match_result || markets.fulltime || {};
  const over = markets.over_under || {};
  const btts = markets.btts || {};
  return {
    home: num(pick(result, ["prob_home", "home"])),
    draw: num(pick(result, ["prob_draw", "draw"])),
    away: num(pick(result, ["prob_away", "away"])),
    over25: num(pick(over, ["prob_over_25", "over_25"])),
    bttsYes: num(pick(btts, ["prob_yes", "yes"])),
  };
}

export function edgePoints(modelPercent, decimalOdd) {
  if (modelPercent == null || decimalOdd == null || decimalOdd <= 1) return null;
  const implied = 100 / decimalOdd;
  return Math.round((modelPercent - implied) * 10) / 10;
}

function market1x2(odds) {
  const outcomes = [
    odds.home != null ? { name: "1", label: "Local", odd: odds.home } : null,
    odds.draw != null ? { name: "X", label: "Empate", odd: odds.draw } : null,
    odds.away != null ? { name: "2", label: "Visitante", odd: odds.away } : null,
  ].filter(Boolean);
  return outcomes.length ? [{ type: "1x2", line: "", outcomes }] : [];
}

export function marketsFromOdds(odds, { live }) {
  const markets = market1x2(odds);
  if (odds.over25 != null || odds.under25 != null) {
    markets.push({
      type: "overUnder",
      line: "2.5",
      outcomes: [
        odds.over25 != null ? { name: "over", label: "Más 2.5", odd: odds.over25 } : null,
        odds.under25 != null ? { name: "under", label: "Menos 2.5", odd: odds.under25 } : null,
      ].filter(Boolean),
    });
  }
  if (!live && (odds.bttsYes != null || odds.bttsNo != null)) {
    markets.push({
      type: "btts",
      line: "",
      outcomes: [
        odds.bttsYes != null ? { name: "yes", label: "Ambos marcan", odd: odds.bttsYes } : null,
        odds.bttsNo != null ? { name: "no", label: "No ambos", odd: odds.bttsNo } : null,
      ].filter(Boolean),
    });
  }
  return markets;
}

export function mapLiveEvent(event, odds) {
  return {
    id: eventId(event),
    league: leagueName(event),
    minute: minuteOf(event),
    home: teamName(event, "home"),
    away: teamName(event, "away"),
    scoreHome: pick(event, ["home_score", "score_home"]) ?? "0",
    scoreAway: pick(event, ["away_score", "score_away"]) ?? "0",
    markets: marketsFromOdds(odds || {}, { live: true }),
  };
}

export function mapUpcomingEvent(event, odds) {
  return {
    id: eventId(event),
    league: leagueName(event),
    kickoff: kickoffOf(event),
    home: teamName(event, "home"),
    away: teamName(event, "away"),
    markets: marketsFromOdds(odds || {}, { live: false }),
    h2h: headToHead(event),
  };
}

function headToHead(event) {
  const h2h = event?.head_to_head;
  const total = Number(h2h?.total_matches);
  if (!total || total < 4) return null;
  return {
    home: Number(h2h.home_win_rate),
    draw: Number(h2h.draws) / total,
    away: Number(h2h.away_win_rate),
  };
}

/** Cuotas en directo de API-Football (`/odds/live`). */
export function mapApiFootballLive(body) {
  const rows = Array.isArray(body?.response) ? body.response : [];
  return rows.map((row) => {
    const bets = row.odds || row.bookmakers?.[0]?.bets || [];
    const winner = bets.find((bet) => /match winner|1x2|home\/draw\/away/i.test(bet.name || ""));
    const totals = bets.find((bet) => /over\/under|goals over/i.test(bet.name || ""));
    const valueOf = (bet, pattern) => {
      const found = bet?.values?.find((item) => pattern.test(item.value || ""));
      return num(found?.odd);
    };
    const odds = {
      home: valueOf(winner, /^home$/i),
      draw: valueOf(winner, /^draw$/i),
      away: valueOf(winner, /^away$/i),
      over25: valueOf(totals, /over\s*2\.5/i),
      under25: valueOf(totals, /under\s*2\.5/i),
    };
    return {
      id: num(row.fixture?.id),
      league: row.league?.name || "",
      minute: row.fixture?.status?.elapsed ?? "",
      home: row.teams?.home?.name || "",
      away: row.teams?.away?.name || "",
      scoreHome: row.goals?.home ?? "",
      scoreAway: row.goals?.away ?? "",
      markets: marketsFromOdds(odds, { live: true }),
    };
  });
}

function norm(name) {
  return String(name || "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/\b(fc|cf|ac|sc)\b/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

const TOP_LEAGUES = new Set([1, 2, 3, 4, 9, 10, 29, 30, 32, 34, 39, 40, 45, 61, 78, 88, 94, 135, 140, 144, 179, 203, 307, 848]);
const LIVE_STATUS = new Set(["1H", "2H", "HT", "ET", "BT", "P", "LIVE", "INT"]);

export function fixturePriority(fixture) {
  const league = fixture?.league || fixture;
  const teams = `${fixture?.teams?.home?.name || ""} ${fixture?.teams?.away?.name || ""}`;
  const blob = `${league?.name || ""} ${league?.country || ""} ${teams}`;
  if (/women|femen|u17|u19|u20|u21|u23|\bu-\d|youth/i.test(blob)) return 1;
  if (TOP_LEAGUES.has(Number(league?.id))) return 100;
  if (/nations league|champions league|europa league|world cup|premier league|la liga|serie a|bundesliga|ligue 1|cup of nations|friendlies/i.test(blob)) return 70;
  if (/cup/i.test(blob)) return 40;
  return 25;
}

export function oddsFromBookmakers(bookmakers) {
  const books = bookmakers || [];
  const preferred = books.find((book) => /bet365|pinnacle|william hill|unibet/i.test(book.name || "")) || books[0];
  const findBet = (pattern) => {
    for (const book of [preferred, ...books]) {
      const bet = book?.bets?.find((item) => pattern.test(item.name || ""));
      if (bet) return bet;
    }
    return null;
  };
  const valueOf = (bet, pattern) => num(bet?.values?.find((item) => pattern.test(item.value || ""))?.odd);
  const winner = findBet(/^match winner$/i);
  const totals = findBet(/^goals over\/under$/i);
  const btts = findBet(/^both teams score$/i);
  return {
    home: valueOf(winner, /^home$/i),
    draw: valueOf(winner, /^draw$/i),
    away: valueOf(winner, /^away$/i),
    over25: valueOf(totals, /^over 2\.5$/i),
    under25: valueOf(totals, /^under 2\.5$/i),
    bttsYes: valueOf(btts, /^yes$/i),
    bttsNo: valueOf(btts, /^no$/i),
  };
}

export function isLiveStatus(short) {
  return LIVE_STATUS.has(short);
}

export function isFinishedStatus(status) {
  return /^(ft|aet|pen|canc|abd|awd|wo|finished|closed|ended|complete)$/i.test(String(status || ""));
}

function kickoffMs(iso) {
  const ms = new Date(iso || "").getTime();
  return Number.isFinite(ms) ? ms : null;
}

/** Ya ha empezado (con 5 min de margen por si el directo tarda en aparecer). */
export function isPastKickoff(iso, now = Date.now()) {
  const ms = kickoffMs(iso);
  if (ms == null) return false;
  return ms <= now - 5 * 60 * 1000;
}

/** Un partido no sigue en juego dos horas después del inicio. */
export function isStaleLive(iso, now = Date.now()) {
  const ms = kickoffMs(iso);
  if (ms == null) return false;
  return now - ms >= 120 * 60 * 1000;
}

export function overlayLiveOdds(live, apiFootballMatches) {
  if (!apiFootballMatches?.length) return live;
  return live.map((match) => {
    const found = apiFootballMatches.find(
      (other) =>
        (match.id && other.id === match.id) ||
        (norm(other.home) === norm(match.home) && norm(other.away) === norm(match.away))
    );
    if (!found?.markets?.length) return match;
    return {
      ...match,
      minute: match.minute || found.minute,
      scoreHome: match.scoreHome === "" ? found.scoreHome : match.scoreHome,
      scoreAway: match.scoreAway === "" ? found.scoreAway : match.scoreAway,
      markets: found.markets,
    };
  });
}

export function buildAlerts(upcoming, probsById) {
  const alerts = [];
  for (const match of upcoming) {
    const probs = probsById.get(match.id);
    if (!probs) continue;
    const odds = match._odds || {};
    const options = [
      ["Local", probs.home, odds.home],
      ["Empate", probs.draw, odds.draw],
      ["Visitante", probs.away, odds.away],
      ["Más 2.5", probs.over25, odds.over25],
      ["Ambos marcan", probs.bttsYes, odds.bttsYes],
    ];
    for (const [label, model, odd] of options) {
      const edge = edgePoints(model, odd);
      if (edge == null || edge < 4) continue;
      alerts.push({
        match: `${match.home} vs ${match.away}`,
        market: `${label} ${odd.toFixed(2)}`,
        edge: String(edge),
        note: `Cuota ${odd.toFixed(2)}.`,
      });
    }
  }
  return alerts.sort((a, b) => Number(b.edge) - Number(a.edge)).slice(0, 5);
}

export function streaksFromTable(teams) {
  const items = [];
  for (const team of teams) {
    const form = team.form || "";
    let wins = 0;
    for (let i = form.length - 1; i >= 0 && form[i] === "W"; i -= 1) wins += 1;
    let unbeaten = 0;
    for (let i = form.length - 1; i >= 0 && form[i] !== "L"; i -= 1) unbeaten += 1;
    if (wins >= 3) items.push({ team: team.name, value: String(wins), label: "victorias consecutivas" });
    if (unbeaten >= 4 && unbeaten !== wins) {
      items.push({ team: team.name, value: String(unbeaten), label: "partidos sin perder" });
    }
  }
  return items.slice(0, 4);
}

export function escapeAttr(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;");
}

function attrs(pairs) {
  return Object.entries(pairs)
    .map(([key, value]) => `${key}="${escapeAttr(value)}"`)
    .join(" ");
}

export function toXml(model) {
  const player = (tag, row, fields) => `    <${tag} ${attrs(Object.fromEntries(fields.map((key) => [key, row[key]])))}/>`;
  const outcome = (item) => `          <outcome ${attrs({ name: item.name, label: item.label, odd: item.odd })}/>`;
  const market = (item) => {
    const line = item.line ? ` line="${escapeAttr(item.line)}"` : "";
    return `        <market type="${escapeAttr(item.type)}"${line}>\n${item.outcomes.map(outcome).join("\n")}\n        </market>`;
  };
  const live = model.live
    .map(
      (match) => `    <match ${attrs({
        id: match.id ?? "",
        league: match.league,
        minute: match.minute,
        status: "live",
        home: match.home,
        away: match.away,
        scoreHome: match.scoreHome,
        scoreAway: match.scoreAway,
      })}>\n${(match.markets || []).map(market).join("\n")}\n    </match>`
    )
    .join("\n");
  const upcoming = model.upcoming
    .map(
      (match) => `    <match ${attrs({
        id: match.id ?? "",
        league: match.league,
        kickoff: match.kickoff,
        status: "scheduled",
        home: match.home,
        away: match.away,
      })}>\n${(match.markets || []).map(market).join("\n")}${match.probs ? `\n        <probs ${attrs(match.probs)}/>` : ""}\n    </match>`
    )
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<footballCache ${attrs({
    generatedAt: model.generatedAt,
    source: model.source,
    ttlMinutes: model.ttlMinutes,
  })}>
  <meta>
    <app>BetterThanBet</app>
    <tagline>Datos, no apuestas a ciegas</tagline>
    <season>${escapeAttr(model.season || "")}</season>
  </meta>
  <topScorers>
${model.topScorers.map((row) => player("player", row, ["rank", "name", "team", "league", "goals", "assists", "matches", "per90"])).join("\n")}
  </topScorers>
  <cardRankings>
${model.cards.map((row) => player("player", { ...row, yellowAvg: row.yellowAvg.toFixed(2), redAvg: row.redAvg.toFixed(2) }, ["rank", "name", "team", "league", "yellowAvg", "redAvg", "yellow", "red", "matches"])).join("\n")}
  </cardRankings>
  <winrateTeams>
${model.winrate.map((row) => player("team", row, ["rank", "name", "league", "winrate", "wins", "draws", "losses", "gf", "ga", "form"])).join("\n")}
  </winrateTeams>
  <liveOdds>
${live}
  </liveOdds>
  <upcomingOdds>
${upcoming}
  </upcomingOdds>
  <shotLeaders>
${(model.shots || []).map((row) => player("player", row, ["rank", "name", "team", "league", "shotsPerGame", "sotPerGame", "shots", "sot", "matches"])).join("\n")}
  </shotLeaders>
  <streaks>
${(model.streaks || []).map((row) => `    <item ${attrs({ team: row.team || "", player: row.player || "", value: row.value, label: row.label })}/>`).join("\n")}
  </streaks>
  <valueAlerts>
${(model.alerts || []).map((row) => `    <alert ${attrs(row)}/>`).join("\n")}
  </valueAlerts>
</footballCache>
`;
}
