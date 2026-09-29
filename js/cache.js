/**
 * La página solo lee data/football.xml.
 * tools/sync-loop.mjs es quien habla con Bzzoiro y API-Football.
 */
export function xmlUrl() {
  const host = typeof location === "undefined" ? "" : location.hostname;
  if (host && host !== "localhost" && host !== "127.0.0.1") return "/api/football";
  return "data/football.xml";
}

export function parseXml(xmlText) {
  const doc = new DOMParser().parseFromString(xmlText, "application/xml");
  if (doc.querySelector("parsererror")) {
    throw new Error("XML inválido");
  }
  const root = doc.documentElement;
  const attr = (el, name) => el?.getAttribute(name) ?? "";
  const list = (selector) => [...root.querySelectorAll(selector)];

  const probsOf = (matchEl) => {
    const el = matchEl.querySelector("probs");
    if (!el) return null;
    const value = (name) => {
      const raw = attr(el, name);
      return raw === "" ? null : Number(raw);
    };
    return {
      home: value("home"),
      draw: value("draw"),
      away: value("away"),
      over25: value("over25"),
      btts: value("btts"),
    };
  };

  const marketsOf = (matchEl) =>
    [...matchEl.querySelectorAll("market")].map((m) => ({
      type: attr(m, "type"),
      line: attr(m, "line"),
      outcomes: [...m.querySelectorAll("outcome")].map((o) => ({
        name: attr(o, "name"),
        label: attr(o, "label"),
        odd: Number(attr(o, "odd")),
      })),
    }));

  return {
    generatedAt: attr(root, "generatedAt"),
    source: attr(root, "source"),
    ttlMinutes: Number(attr(root, "ttlMinutes") || 15),
    topScorers: list("topScorers > player").map((p) => ({
      rank: Number(attr(p, "rank")),
      name: attr(p, "name"),
      team: attr(p, "team"),
      league: attr(p, "league"),
      goals: Number(attr(p, "goals")),
      assists: Number(attr(p, "assists")),
      matches: Number(attr(p, "matches")),
      per90: Number(attr(p, "per90")),
    })),
    cards: list("cardRankings > player").map((p) => ({
      rank: Number(attr(p, "rank")),
      name: attr(p, "name"),
      team: attr(p, "team"),
      yellowAvg: Number(attr(p, "yellowAvg")),
      redAvg: Number(attr(p, "redAvg")),
      yellow: Number(attr(p, "yellow")),
      red: Number(attr(p, "red")),
      matches: Number(attr(p, "matches")),
    })),
    winrate: list("winrateTeams > team").map((t) => ({
      rank: Number(attr(t, "rank")),
      name: attr(t, "name"),
      league: attr(t, "league"),
      winrate: Number(attr(t, "winrate")),
      wins: Number(attr(t, "wins")),
      draws: Number(attr(t, "draws")),
      losses: Number(attr(t, "losses")),
      form: attr(t, "form"),
    })),
    live: list("liveOdds > match").map((m) => ({
      league: attr(m, "league"),
      minute: attr(m, "minute"),
      home: attr(m, "home"),
      away: attr(m, "away"),
      scoreHome: attr(m, "scoreHome"),
      scoreAway: attr(m, "scoreAway"),
      markets: marketsOf(m),
    })),
    upcoming: list("upcomingOdds > match").map((m) => ({
      league: attr(m, "league"),
      kickoff: attr(m, "kickoff"),
      home: attr(m, "home"),
      away: attr(m, "away"),
      markets: marketsOf(m),
      probs: probsOf(m),
    })),
    shots: list("shotLeaders > player").map((p) => ({
      rank: Number(attr(p, "rank")),
      name: attr(p, "name"),
      team: attr(p, "team"),
      league: attr(p, "league"),
      shotsPerGame: Number(attr(p, "shotsPerGame")),
      sotPerGame: Number(attr(p, "sotPerGame")),
      shots: Number(attr(p, "shots")),
      sot: Number(attr(p, "sot")),
      matches: Number(attr(p, "matches")),
    })),
    streaks: list("streaks > item").map((s) => ({
      team: attr(s, "team"),
      player: attr(s, "player"),
      value: attr(s, "value"),
      label: attr(s, "label"),
    })),
    alerts: list("valueAlerts > alert").map((a) => ({
      match: attr(a, "match"),
      market: attr(a, "market"),
      hit: attr(a, "hit"),
      note: attr(a, "note"),
    })),
  };
}

export async function loadCache() {
  const url = xmlUrl();
  const remote = url !== "data/football.xml";
  const res = await fetch(url, remote ? {} : { cache: "no-store" });
  if (!res.ok) throw new Error("No se pudieron cargar los datos");
  return parseXml(await res.text());
}

export function cacheAgeLabel(iso) {
  const then = new Date(iso);
  if (Number.isNaN(then.getTime())) return "ahora";
  const mins = Math.max(0, Math.round((Date.now() - then.getTime()) / 60000));
  return mins < 1 ? "ahora" : `hace ${mins} min`;
}
