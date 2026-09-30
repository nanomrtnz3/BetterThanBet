/** Probabilidades a partir de las cuotas y, si existe, de la fuerza del equipo. */

function poisson(lambda, k) {
  let value = Math.exp(-lambda);
  for (let i = 1; i <= k; i += 1) value *= lambda / i;
  return value;
}

function scoreline(lambdaHome, lambdaAway) {
  let home = 0;
  let draw = 0;
  let away = 0;
  let over25 = 0;
  let btts = 0;
  for (let h = 0; h <= 8; h += 1) {
    for (let a = 0; a <= 8; a += 1) {
      const probability = poisson(lambdaHome, h) * poisson(lambdaAway, a);
      if (h > a) home += probability;
      else if (h === a) draw += probability;
      else away += probability;
      if (h + a >= 3) over25 += probability;
      if (h > 0 && a > 0) btts += probability;
    }
  }
  return { home, draw, away, over25, btts };
}

export function devig(odds) {
  const raw = odds.map((odd) => (odd > 1 ? 1 / odd : null));
  const sum = raw.reduce((total, value) => total + (value || 0), 0);
  if (!sum) return raw.map(() => null);
  return raw.map((value) => (value == null ? null : value / sum));
}

function oddNamed(match, type, name) {
  const market = match.markets?.find((item) => item.type === type);
  const outcome = market?.outcomes?.find((item) => item.name === name);
  return outcome?.odd > 1 ? outcome.odd : null;
}

function fitLambdas(target) {
  let best = null;
  for (let home = 0.2; home <= 3.6; home += 0.1) {
    for (let away = 0.2; away <= 3.6; away += 0.1) {
      const grid = scoreline(home, away);
      let error = 0;
      error += (grid.home - target.home) ** 2;
      error += (grid.draw - target.draw) ** 2;
      error += (grid.away - target.away) ** 2;
      if (target.over25 != null) error += 0.7 * (grid.over25 - target.over25) ** 2;
      if (target.btts != null) error += 0.45 * (grid.btts - target.btts) ** 2;
      if (!best || error < best.error) best = { home, away, error, grid };
    }
  }
  return best;
}

function normName(name) {
  return String(name || "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/\b(fc|cf|ac|sc|sv)\b/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function findTeam(teams, name) {
  const key = normName(name);
  return teams.find((team) => normName(team.name) === key);
}

function formFactor(form) {
  const recent = String(form || "").slice(-5);
  if (!recent) return 1;
  let points = 0;
  for (const char of recent) points += char === "W" ? 3 : char === "D" ? 1 : 0;
  return 0.85 + (points / (recent.length * 3)) * 0.3;
}

function teamLambdas(home, away) {
  const homeFor = home.gf / home.played;
  const homeAgainst = home.ga / home.played;
  const awayFor = away.gf / away.played;
  const awayAgainst = away.ga / away.played;
  const league = (homeFor + homeAgainst + awayFor + awayAgainst) / 4 || 1.3;
  return {
    home: (homeFor / league) * (awayAgainst / league) * league * 1.1 * formFactor(home.form),
    away: (awayFor / league) * (homeAgainst / league) * league * 0.95 * formFactor(away.form),
  };
}

function roundPct(value) {
  return Math.round(value * 1000) / 10;
}

function atLeast(lambda, count) {
  let term = Math.exp(-lambda);
  let below = term;
  for (let i = 1; i < count; i += 1) {
    term *= lambda / i;
    below += term;
  }
  return 1 - below;
}

function shrunkLambda(total, matches, priorMean, priorGames) {
  const played = Number(matches) || 0;
  const observed = Number(total) || 0;
  if (played < 1) return null;
  return (priorGames * priorMean + observed) / (priorGames + played);
}

function proposeLine(lambda, maxLine, firstFloor) {
  if (!(lambda > 0)) return null;
  let chosen = null;
  for (let count = 1; count <= maxLine; count += 1) {
    const probability = atLeast(lambda, count);
    const floor = count === 1 ? firstFloor : 0.55;
    if (probability < floor) break;
    chosen = { count, probability, lambda };
  }
  return chosen;
}

function shotPhrase(count, name) {
  const noun = count === 1 ? "tiro a puerta" : "tiros a puerta";
  return `al menos ${count} ${noun} de ${name}`;
}

function cardPhrase(count, name) {
  const noun = count === 1 ? "amarilla" : "amarillas";
  return `al menos ${count} ${noun} de ${name}`;
}

function shrinkLambda(lambda, played) {
  const weight = Math.min(played || 0, 6) / 6;
  return Math.max(0.2, lambda * weight + 1.2 * (1 - weight));
}

function playersIn(match, rows) {
  return rows.filter((row) => {
    const team = normName(row.team);
    return team && (team === normName(match.home) || team === normName(match.away));
  });
}

function pushAction(actions, market, probability, odd, group) {
  if (!(probability > 0) || !(probability < 1) || !(odd > 1)) return;
  actions.push({ market, hit: roundPct(probability), odd: Number(odd.toFixed(2)), group });
}

function fairOrModel(modelValue, fairValue) {
  return modelValue != null ? modelValue : fairValue;
}

/**
 * Porcentaje de acierto de cada mercado con cuota.
 * En un mercado de dos o tres resultados se reparte el margen de la casa
 * para que las probabilidades sumen 1. Si el modelo de goles ya estimó
 * ese resultado, se usa esa cifra. La más probable necesita al menos un 55%.
 * La arriesgada es la cuota más alta entre el 25% y el 45%, de otro mercado.
 */
export function rateValueActions(match, model) {
  const actions = [];
  const homeOdd = oddNamed(match, "1x2", "1");
  const drawOdd = oddNamed(match, "1x2", "X");
  const awayOdd = oddNamed(match, "1x2", "2");
  if (homeOdd && drawOdd && awayOdd) {
    const [fairHome, fairDraw, fairAway] = devig([homeOdd, drawOdd, awayOdd]);
    pushAction(actions, `gana ${match.home}`, fairOrModel(model?.home, fairHome), homeOdd, "1x2");
    pushAction(actions, "empate", fairOrModel(model?.draw, fairDraw), drawOdd, "1x2");
    pushAction(actions, `gana ${match.away}`, fairOrModel(model?.away, fairAway), awayOdd, "1x2");
  }

  const pairs = [
    ["overUnder", "over", "under", "goles", "over25"],
    ["btts", "yes", "no", "btts", "btts"],
    ["corners", "over", "under", "corners", null],
    ["cards", "over", "under", "cards", null],
  ];
  for (const [type, overName, underName, group, modelKey] of pairs) {
    const overOdd = oddNamed(match, type, overName);
    const underOdd = oddNamed(match, type, underName);
    if (!overOdd || !underOdd) continue;
    const [fairOver, fairUnder] = devig([overOdd, underOdd]);
    const line = match.markets?.find((item) => item.type === type)?.line;
    const noun = group === "goles" ? "goles" : group === "corners" ? "córners" : group === "cards" ? "tarjetas" : "";
    const overText = group === "btts" ? "marcan los dos" : `más de ${line || "2.5"} ${noun}`;
    const underText = group === "btts" ? "no marcan los dos" : `menos de ${line || "2.5"} ${noun}`;
    const modelOver = modelKey ? model?.[modelKey] : null;
    pushAction(actions, overText, fairOrModel(modelOver, fairOver), overOdd, group);
    pushAction(actions, underText, fairOrModel(modelOver == null ? null : 1 - modelOver, fairUnder), underOdd, group);
  }

  const safe = actions.filter((row) => row.hit >= 55).sort((a, b) => b.hit - a.hit)[0] || null;
  const risky = actions
    .filter((row) => row.hit >= 25 && row.hit <= 45 && row.group !== safe?.group)
    .sort((a, b) => b.odd - a.odd)[0] || null;
  return {
    safe: safe && { market: safe.market, hit: safe.hit, odd: safe.odd },
    risky: risky && { market: risky.market, hit: risky.hit, odd: risky.odd },
  };
}

function betOptions(match, model, odds) {
  return [
    { label: `gana ${match.home}`, probability: model.home, odd: odds.home },
    { label: "empate", probability: model.draw, odd: odds.draw },
    { label: `gana ${match.away}`, probability: model.away, odd: odds.away },
    { label: "más de 2.5 goles", probability: model.over25, odd: odds.over },
    { label: "menos de 2.5 goles", probability: model.over25 == null ? null : 1 - model.over25, odd: odds.under },
    { label: "marcan los dos", probability: model.btts, odd: odds.yes },
    { label: "no marcan los dos", probability: model.btts == null ? null : 1 - model.btts, odd: odds.no },
  ].filter((row) => row.probability != null && (row.odd || odds.open));
}

/**
 * Escribe match.probs (0-100) y propone apuestas.
 * Con cuota: quita el margen y ajusta un Poisson. Si los dos equipos
 * están en la clasificación, mezcla goles y forma.
 * Sin cuota (Nations League a varios días): usa la clasificación.
 * Además propone tiros a puerta y amarillas del jugador que juega ese partido.
 */
export function annotateProbabilities(matches, teams = [], props = {}) {
  const alerts = [];
  const shots = props.shots || [];
  const cards = props.cards || [];
  for (const match of matches) {
    const homeOdd = oddNamed(match, "1x2", "1");
    const drawOdd = oddNamed(match, "1x2", "X");
    const awayOdd = oddNamed(match, "1x2", "2");
    const overOdd = oddNamed(match, "overUnder", "over");
    const underOdd = oddNamed(match, "overUnder", "under");
    const bttsYes = oddNamed(match, "btts", "yes");
    const bttsNo = oddNamed(match, "btts", "no");
    const homeTeam = findTeam(teams, match.home);
    const awayTeam = findTeam(teams, match.away);
    let model = null;
    let fromTable = false;

    if (homeOdd && drawOdd && awayOdd) {
      const [fairHome, fairDraw, fairAway] = devig([homeOdd, drawOdd, awayOdd]);
      const fairOver = overOdd && underOdd ? devig([overOdd, underOdd])[0] : null;
      const fairBtts = bttsYes && bttsNo ? devig([bttsYes, bttsNo])[0] : null;
      const fitted = fitLambdas({
        home: fairHome,
        draw: fairDraw,
        away: fairAway,
        over25: fairOver,
        btts: fairBtts,
      });
      model = fitted.grid;
      if (homeTeam?.played && awayTeam?.played) {
        const lambdas = teamLambdas(homeTeam, awayTeam);
        const table = scoreline(Math.max(0.2, lambdas.home), Math.max(0.2, lambdas.away));
        model = {
          home: 0.55 * fitted.grid.home + 0.45 * table.home,
          draw: 0.55 * fitted.grid.draw + 0.45 * table.draw,
          away: 0.55 * fitted.grid.away + 0.45 * table.away,
          over25: 0.55 * fitted.grid.over25 + 0.45 * table.over25,
          btts: 0.55 * fitted.grid.btts + 0.45 * table.btts,
        };
        fromTable = true;
      }
    } else if (homeTeam?.played && awayTeam?.played) {
      const lambdas = teamLambdas(homeTeam, awayTeam);
      const played = Math.min(homeTeam.played, awayTeam.played);
      let table = scoreline(shrinkLambda(lambdas.home, played), shrinkLambda(lambdas.away, played));
      if (match.h2h?.home != null) {
        table = {
          home: 0.7 * table.home + 0.3 * match.h2h.home,
          draw: 0.7 * table.draw + 0.3 * match.h2h.draw,
          away: 0.7 * table.away + 0.3 * match.h2h.away,
          over25: table.over25,
          btts: table.btts,
        };
      }
      model = table;
      fromTable = true;
    }

    if (model || homeOdd) {
      const rated = rateValueActions(match, model);
      if (rated.safe || rated.risky) match.valueActions = rated;
    }

    if (model) {
      match.probs = {
        home: roundPct(model.home),
        draw: roundPct(model.draw),
        away: roundPct(model.away),
        over25: roundPct(model.over25),
        btts: roundPct(model.btts),
      };
      const best = betOptions(match, model, {
        home: homeOdd,
        draw: drawOdd,
        away: awayOdd,
        over: overOdd,
        under: underOdd,
        yes: bttsYes,
        no: bttsNo,
        open: !homeOdd,
      })
        .filter((row) => homeOdd || !row.odd)
        .sort((a, b) => b.probability - a.probability)[0];
      if (best) {
        const hit = roundPct(best.probability);
        const source = homeOdd ? `Cuota ${best.odd.toFixed(2)}.` : "Sin cuota publicada.";
        alerts.push({
          match: `${match.home} vs ${match.away}`,
          market: best.label,
          hit: String(hit),
          note: source,
        });
      }
    }

    const shot = playersIn(match, shots)
      .map((player) => ({
        player,
        line: proposeLine(shrunkLambda(player.sot, player.matches, 1, 10), player.matches >= 6 ? 2 : 1, 0.5),
      }))
      .filter((row) => row.line)
      .sort((a, b) => b.line.probability - a.line.probability)[0];
    if (shot) {
      const games = shot.player.matches === 1 ? "partido" : "partidos";
      alerts.push({
        match: `${match.home} vs ${match.away}`,
        market: shotPhrase(shot.line.count, shot.player.name),
        hit: String(roundPct(shot.line.probability)),
        note: `${shot.player.sot} a puerta en ${shot.player.matches} ${games}.`,
      });
    }

    const card = playersIn(match, cards)
      .map((player) => ({
        player,
        line: proposeLine(shrunkLambda(player.yellow, player.matches, 0.2, 10), 1, 0.38),
      }))
      .filter((row) => row.line)
      .sort((a, b) => b.line.probability - a.line.probability)[0];
    if (card) {
      const games = card.player.matches === 1 ? "partido" : "partidos";
      alerts.push({
        match: `${match.home} vs ${match.away}`,
        market: cardPhrase(card.line.count, card.player.name),
        hit: String(roundPct(card.line.probability)),
        note: `${card.player.yellow} amarillas en ${card.player.matches} ${games}.`,
      });
    }
  }
  const unique = [];
  const seenBet = new Set();
  for (const row of alerts) {
    if (seenBet.has(row.market)) continue;
    seenBet.add(row.market);
    unique.push(row);
  }
  const playerBets = unique.filter((row) => /tiros? a puerta|amarillas?/.test(row.market));
  const results = unique.filter((row) => !/tiros? a puerta|amarillas?/.test(row.market));
  const byHit = (a, b) => Number(b.hit) - Number(a.hit);
  return [...playerBets.sort(byHit).slice(0, 5), ...results.sort(byHit).slice(0, 3)];
}
