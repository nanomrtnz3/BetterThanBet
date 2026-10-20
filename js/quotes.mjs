import { devig } from "../tools/probability.mjs";
import {
  BOOKS,
  FIXTURES,
  bookQuote,
  decimal,
  hashName,
  mulberry32,
  playerProps,
  profile,
  yellowText,
} from "./demo.mjs";

function num(value) {
  return Number(value).toFixed(Math.abs(value) < 0.3 ? 2 : 1);
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
    const side = (team, rival, odd, fair) => ({ team, rival, odd, hit: hit(fair), what, label: line.label });
    return [{
      label: line.label,
      home: side(match.home, match.away, homeOdd, fairHome),
      away: side(match.away, match.home, awayOdd, fairAway),
    }];
  });
}

function linesFrom(home, away, rows) {
  return rows.map(([label, key]) => ({ label, home: home[key], away: away[key] }));
}

function catalog(match) {
  const home = profile(match.home);
  const away = profile(match.away);
  const windows = [[0, 15], [16, 30], [31, 45], [46, 60], [61, 75], [76, 90]];
  const bins = windows.flatMap(([from, to], index) => [
    { label: `Desde el minuto ${from} al ${to}, a favor`, home: home.goalsForBins[index], away: away.goalsForBins[index] },
    { label: `Desde el minuto ${from} al ${to}, en contra`, home: home.goalsAgainstBins[index], away: away.goalsAgainstBins[index] },
  ]);
  const record = (label, homeRecord, awayRecord) => ({
    label,
    home: homeRecord.wins,
    away: awayRecord.wins,
  });
  return [
    ["Goles", "Por partido", [
      ...linesFrom(home, away, [
        ["Anotados", "goalsFor"],
        ["Recibidos", "goalsAgainst"],
        ["Anotados, 1.ª parte", "goalsFor1"],
        ["Recibidos, 1.ª parte", "goalsAgainst1"],
        ["Anotados, 2.ª parte", "goalsFor2"],
        ["Recibidos, 2.ª parte", "goalsAgainst2"],
      ]),
      ...bins,
    ]],
    ["Córners", "Por partido", linesFrom(home, away, [
      ["A favor", "cornersFor"], ["En contra", "cornersAgainst"],
      ["A favor, 1.ª parte", "cornersFor1"], ["En contra, 1.ª parte", "cornersAgainst1"],
      ["A favor, 2.ª parte", "cornersFor2"], ["En contra, 2.ª parte", "cornersAgainst2"],
      ["Desde el minuto 0 al 15, a favor", "cornersFor10"], ["Desde el minuto 0 al 15, en contra", "cornersAgainst10"],
    ])],
    ["Tarjetas", "Recibidas y provocadas", linesFrom(home, away, [
      ["Recibidas", "cardsFor"], ["Provocadas", "cardsAgainst"],
      ["Recibidas, 1.ª parte", "cardsFor1"], ["Provocadas, 1.ª parte", "cardsAgainst1"],
      ["Recibidas, 2.ª parte", "cardsFor2"], ["Provocadas, 2.ª parte", "cardsAgainst2"],
      ["Desde el minuto 0 al 15, recibidas", "cardsFor10"], ["Desde el minuto 0 al 15, provocadas", "cardsAgainst10"],
      ["Rojas a favor", "redsFor"], ["Rojas en contra", "redsAgainst"],
    ])],
    ["Fueras de juego", "Pitados por partido", linesFrom(home, away, [
      ["Al equipo", "offsidesFor"], ["Al rival", "offsidesAgainst"],
    ])],
    ["Remates", "Por partido", linesFrom(home, away, [
      ["A favor", "shotsFor"], ["En contra", "shotsAgainst"],
      ["A favor, 1.ª parte", "shotsFor1"], ["En contra, 1.ª parte", "shotsAgainst1"],
      ["A favor, 2.ª parte", "shotsFor2"], ["En contra, 2.ª parte", "shotsAgainst2"],
    ])],
    ["Remates a puerta", "Por partido", linesFrom(home, away, [
      ["A favor", "sotFor"], ["En contra", "sotAgainst"],
      ["A favor, 1.ª parte", "sotFor1"], ["En contra, 1.ª parte", "sotAgainst1"],
      ["A favor, 2.ª parte", "sotFor2"], ["En contra, 2.ª parte", "sotAgainst2"],
    ])],
    ["Saques de puerta", "Por partido", linesFrom(home, away, [
      ["A favor", "goalKicksFor"], ["En contra", "goalKicksAgainst"],
      ["A favor, 1.ª parte", "goalKicksFor1"], ["En contra, 1.ª parte", "goalKicksAgainst1"],
      ["A favor, 2.ª parte", "goalKicksFor2"], ["En contra, 2.ª parte", "goalKicksAgainst2"],
    ])],
    ["Saques de banda", "Por partido", linesFrom(home, away, [
      ["A favor", "throwInsFor"], ["En contra", "throwInsAgainst"],
      ["A favor, 1.ª parte", "throwInsFor1"], ["En contra, 1.ª parte", "throwInsAgainst1"],
      ["A favor, 2.ª parte", "throwInsFor2"], ["En contra, 2.ª parte", "throwInsAgainst2"],
    ])],
    ["Entradas", "Por partido", linesFrom(home, away, [
      ["A favor", "tacklesFor"], ["En contra", "tacklesAgainst"],
      ["A favor, 1.ª parte", "tacklesFor1"], ["En contra, 1.ª parte", "tacklesAgainst1"],
      ["A favor, 2.ª parte", "tacklesFor2"], ["En contra, 2.ª parte", "tacklesAgainst2"],
    ])],
    ["Tiros libres", "Faltas sacadas, por partido", linesFrom(home, away, [
      ["A favor", "freeKicksFor"], ["En contra", "freeKicksAgainst"],
      ["A favor, 1.ª parte", "freeKicksFor1"], ["En contra, 1.ª parte", "freeKicksAgainst1"],
      ["A favor, 2.ª parte", "freeKicksFor2"], ["En contra, 2.ª parte", "freeKicksAgainst2"],
    ])],
    ["Faltas", "Por partido", linesFrom(home, away, [
      ["A favor", "foulsFor"], ["En contra", "foulsAgainst"],
      ["A favor, 1.ª parte", "foulsFor1"], ["En contra, 1.ª parte", "foulsAgainst1"],
      ["A favor, 2.ª parte", "foulsFor2"], ["En contra, 2.ª parte", "foulsAgainst2"],
    ])],
    ["Resultados", "Victorias, empates y derrotas", [
      record("Partido", home.results, away.results),
      record("Al descanso", home.resultsHalf, away.resultsHalf),
      record("Desde el minuto 0 al 15", home.results10, away.results10),
    ]],
  ];
}

function sectionsFor(match) {
  return catalog(match).map(([title, note, lines], sectionIndex) => ({
    title,
    note,
    rows: priceLines(match, title, lines).map((row, lineIndex) => ({
      ...row,
      homeId: `s:${match.id}:${sectionIndex}:${lineIndex}:h`,
      awayId: `s:${match.id}:${sectionIndex}:${lineIndex}:a`,
    })),
  }));
}

function card(side, id, selected) {
  return `<button type="button" class="bet pickable${selected ? " is-on" : ""}" data-leg="${id}" aria-pressed="${selected}"><p>Apuesta a que <b>${side.team}</b> supera a ${side.rival} en ${side.what}.</p><div class="odd"><small>${side.team}</small><b>${side.odd.toFixed(2)}</b><small class="odd-kind">cuota</small></div><small class="pick-state">${selected ? "En la combinada" : "Pulsar para añadir"}</small></button>`;
}

export function quotePanel(match, selected) {
  const has = (id) => selected.includes(id);
  const blocks = sectionsFor(match).map((section) => {
    const body = section.rows.map((row) => `<p class="market-label">${row.label}</p><div class="odds bets">${card(row.home, row.homeId, has(row.homeId))}${card(row.away, row.awayId, has(row.awayId))}</div>`).join("");
    return `<details class="stat-fold"><summary><span>${section.title}</span><small>${section.note}</small></summary><div class="stat-body">${body}</div></details>`;
  });
  const props = playerProps(match).map((prop) => {
    const on = has(prop.id);
    return `<button type="button" class="bet pickable prop${on ? " is-on" : ""}" data-leg="${prop.id}" aria-pressed="${on}"><p><b>${prop.player.name}</b> ${prop.market.label}. <span class="sub">${prop.player.team} · ${yellowText(prop.player.yellows)}</span></p><div class="odd"><small>cuota</small><b>${prop.odd.toFixed(2)}</b><small class="odd-kind">${prop.hit}%</small></div><small class="pick-state">${on ? "En la combinada" : "Pulsar para añadir"}</small></button>`;
  }).join("");
  blocks.push(`<details class="stat-fold"><summary><span>Cuotas de jugadores</span><small>Gol, asistencia o tarjeta</small></summary><div class="stat-body"><div class="prop-grid">${props}</div></div></details>`);
  const books = BOOKS.map((book) => {
    const quote = bookQuote(match, book);
    const homeId = `b:${match.id}:${book.id}:h`;
    const awayId = `b:${match.id}:${book.id}:a`;
    const sideCard = (side, id) => {
      const on = has(id);
      return `<button type="button" class="bet pickable${on ? " is-on" : ""}" data-leg="${id}" aria-pressed="${on}"><p><b>${side.team}</b> marca más goles. Cuota de ejemplo de ${book.name}.</p><div class="odd"><small>${book.name}</small><b>${side.odd.toFixed(2)}</b><small class="odd-kind">${side.hit}%</small></div><small class="pick-state">${on ? "En la combinada" : "Pulsar para añadir"}</small></button>`;
    };
    return `<details class="stat-fold"><summary><span>${book.name}</span><small>Cuotas de ejemplo</small></summary><div class="stat-body"><div class="odds bets">${sideCard(quote.home, homeId)}${sideCard(quote.away, awayId)}</div></div></details>`;
  }).join("");
  blocks.push(`<details class="stat-fold"><summary><span>Casas de apuestas</span><small>Cuatro casas</small></summary><div class="stat-body">${books}</div></details>`);
  return blocks.join("");
}

export function resolveQuote(id) {
  if (!id.startsWith("s:")) return null;
  const [, matchId, sectionIndex, lineIndex, side] = id.split(":");
  const match = FIXTURES.find((item) => item.id === matchId);
  if (!match) return null;
  const section = sectionsFor(match)[Number(sectionIndex)];
  const row = section?.rows[Number(lineIndex)];
  if (!row) return null;
  const pick = side === "a" ? row.away : row.home;
  return {
    id,
    title: `${pick.team} supera en ${pick.what}`,
    detail: `${match.home} vs ${match.away} · ${section.title}`,
    odd: pick.odd,
    hit: pick.hit,
  };
}
