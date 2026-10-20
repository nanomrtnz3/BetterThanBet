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

function whenOf(label) {
  if (label.includes("1.ª parte")) return "en la primera parte";
  if (label.includes("2.ª parte")) return "en la segunda parte";
  if (label.startsWith("Desde el minuto")) return label.split(",")[0].replace("Desde el", "desde el");
  return "en el encuentro";
}

function baseOf(label) {
  if (label.startsWith("Desde el minuto")) {
    if (label.endsWith("recibidas")) return "Recibidas";
    if (label.endsWith("provocadas")) return "Provocadas";
    if (label.endsWith("en contra")) return "En contra";
    return "A favor";
  }
  return label.replace(/, 1\.ª parte$|, 2\.ª parte$/, "");
}

const VERBS = {
  Goles: {
    Anotados: "marca más goles",
    Recibidos: "encaja más goles",
    "A favor": "marca más goles",
    "En contra": "encaja más goles",
  },
  Córners: { "A favor": "saca más córners", "En contra": "recibe más córners" },
  Tarjetas: {
    Recibidas: "ve más tarjetas",
    Provocadas: "provoca más tarjetas",
    "Rojas a favor": "suma más tarjetas rojas a favor",
    "Rojas en contra": "suma más tarjetas rojas en contra",
  },
  "Fueras de juego": { "Al equipo": "cae más veces en fuera de juego" },
  Remates: { "A favor": "tira más", "En contra": "recibe más remates" },
  "Remates a puerta": { "A favor": "tira más a puerta", "En contra": "recibe más remates a puerta" },
  "Saques de puerta": { "A favor": "saca más saques de puerta", "En contra": "provoca más saques de puerta" },
  "Saques de banda": { "A favor": "saca más saques de banda", "En contra": "provoca más saques de banda" },
  Entradas: { "A favor": "hace más entradas", "En contra": "recibe más entradas" },
  "Tiros libres": { "A favor": "saca más tiros libres", "En contra": "provoca más tiros libres" },
  Faltas: { "A favor": "recibe más faltas", "En contra": "comete más faltas" },
};

export function betCopy(section, label, team, rival) {
  if (section === "Resultados") {
    const sentence = label === "Partido"
      ? "gana el encuentro"
      : label === "Al descanso"
        ? "va ganando al descanso"
        : "va ganando desde el minuto 0 al 15";
    return { html: `Apuesta a que <b>${team}</b> ${sentence}.`, text: `${team} ${sentence}` };
  }
  const when = whenOf(label);
  if (section === "Fueras de juego" && baseOf(label) === "Al rival") {
    const text = `El rival de ${team} cae más veces en fuera de juego que el de ${rival} ${when}`;
    return { html: `Apuesta a que el rival de <b>${team}</b> cae más veces en fuera de juego que el de ${rival} ${when}.`, text };
  }
  const verb = VERBS[section]?.[baseOf(label)] || "supera el dato";
  const text = `${team} ${verb} que ${rival} ${when}`;
  return { html: `Apuesta a que <b>${team}</b> ${verb} que ${rival} ${when}.`, text };
}

function flipSide(side) {
  if (side === "h") return "a";
  if (side === "a") return "h";
  return null;
}

export function contraryIds(id) {
  const parts = id.split(":");
  if (parts[0] === "g") {
    const side = flipSide(parts[2]);
    return side ? [`g:${parts[1]}:${side}`, `s:${parts[1]}:0:0:${side}`] : [];
  }
  if (parts[0] === "s") {
    const side = flipSide(parts[4]);
    if (!side) return [];
    const rivals = [`s:${parts[1]}:${parts[2]}:${parts[3]}:${side}`];
    if (parts[2] === "0" && parts[3] === "0") rivals.push(`g:${parts[1]}:${side}`);
    return rivals;
  }
  if (parts[0] === "b") {
    const side = flipSide(parts[3]);
    return side ? [`b:${parts[1]}:${parts[2]}:${side}`] : [];
  }
  return [];
}

export function twinIds(id) {
  const parts = id.split(":");
  if (parts[0] === "g" && flipSide(parts[2])) return [`s:${parts[1]}:0:0:${parts[2]}`];
  if (parts[0] === "s" && parts[2] === "0" && parts[3] === "0" && flipSide(parts[4])) return [`g:${parts[1]}:${parts[4]}`];
  return [];
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
    const side = (team, rival, odd, fair) => ({
      team,
      rival,
      odd,
      hit: hit(fair),
      label: line.label,
      copy: betCopy(title, line.label, team, rival),
    });
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
    ["Goles", "En el encuentro", [
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
    ["Córners", "En el encuentro", linesFrom(home, away, [
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
    ["Fueras de juego", "En el encuentro", linesFrom(home, away, [
      ["Al equipo", "offsidesFor"], ["Al rival", "offsidesAgainst"],
    ])],
    ["Remates", "En el encuentro", linesFrom(home, away, [
      ["A favor", "shotsFor"], ["En contra", "shotsAgainst"],
      ["A favor, 1.ª parte", "shotsFor1"], ["En contra, 1.ª parte", "shotsAgainst1"],
      ["A favor, 2.ª parte", "shotsFor2"], ["En contra, 2.ª parte", "shotsAgainst2"],
    ])],
    ["Remates a puerta", "En el encuentro", linesFrom(home, away, [
      ["A favor", "sotFor"], ["En contra", "sotAgainst"],
      ["A favor, 1.ª parte", "sotFor1"], ["En contra, 1.ª parte", "sotAgainst1"],
      ["A favor, 2.ª parte", "sotFor2"], ["En contra, 2.ª parte", "sotAgainst2"],
    ])],
    ["Saques de puerta", "En el encuentro", linesFrom(home, away, [
      ["A favor", "goalKicksFor"], ["En contra", "goalKicksAgainst"],
      ["A favor, 1.ª parte", "goalKicksFor1"], ["En contra, 1.ª parte", "goalKicksAgainst1"],
      ["A favor, 2.ª parte", "goalKicksFor2"], ["En contra, 2.ª parte", "goalKicksAgainst2"],
    ])],
    ["Saques de banda", "En el encuentro", linesFrom(home, away, [
      ["A favor", "throwInsFor"], ["En contra", "throwInsAgainst"],
      ["A favor, 1.ª parte", "throwInsFor1"], ["En contra, 1.ª parte", "throwInsAgainst1"],
      ["A favor, 2.ª parte", "throwInsFor2"], ["En contra, 2.ª parte", "throwInsAgainst2"],
    ])],
    ["Entradas", "En el encuentro", linesFrom(home, away, [
      ["A favor", "tacklesFor"], ["En contra", "tacklesAgainst"],
      ["A favor, 1.ª parte", "tacklesFor1"], ["En contra, 1.ª parte", "tacklesAgainst1"],
      ["A favor, 2.ª parte", "tacklesFor2"], ["En contra, 2.ª parte", "tacklesAgainst2"],
    ])],
    ["Tiros libres", "En el encuentro", linesFrom(home, away, [
      ["A favor", "freeKicksFor"], ["En contra", "freeKicksAgainst"],
      ["A favor, 1.ª parte", "freeKicksFor1"], ["En contra, 1.ª parte", "freeKicksAgainst1"],
      ["A favor, 2.ª parte", "freeKicksFor2"], ["En contra, 2.ª parte", "freeKicksAgainst2"],
    ])],
    ["Faltas", "En el encuentro", linesFrom(home, away, [
      ["A favor", "foulsFor"], ["En contra", "foulsAgainst"],
      ["A favor, 1.ª parte", "foulsFor1"], ["En contra, 1.ª parte", "foulsAgainst1"],
      ["A favor, 2.ª parte", "foulsFor2"], ["En contra, 2.ª parte", "foulsAgainst2"],
    ])],
    ["Resultados", "En el encuentro", [
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
  return `<button type="button" class="bet pickable${selected ? " is-on" : ""}" data-leg="${id}" aria-pressed="${selected}"><p>${side.copy.html}</p><div class="odd"><small>${side.team}</small><b>${side.odd.toFixed(2)}</b><small class="odd-kind">cuota</small></div><small class="pick-state">${selected ? "En la combinada" : "Pulsar para añadir"}</small></button>`;
}

export function quotePanel(match, selected) {
  const has = (id) => selected.includes(id);
  const blocks = sectionsFor(match).map((section) => {
    const body = section.rows.map((row) => `<p class="market-label">${row.label}</p><div class="odds bets">${card(row.home, row.homeId, has(row.homeId))}${card(row.away, row.awayId, has(row.awayId))}</div>`).join("");
    return `<details class="stat-fold"><summary><span>${section.title}</span><small>${section.note}</small></summary><div class="stat-body">${body}</div></details>`;
  });
  const props = playerProps(match).map((prop) => {
    const on = has(prop.id);
    return `<button type="button" class="bet pickable prop${on ? " is-on" : ""}" data-leg="${prop.id}" aria-pressed="${on}"><p>Apuesta a que <b>${prop.player.name}</b> ${prop.market.label} en el encuentro. <span class="sub">${prop.player.team} · ${yellowText(prop.player.yellows)}</span></p><div class="odd"><small>cuota</small><b>${prop.odd.toFixed(2)}</b><small class="odd-kind">${prop.hit}%</small></div><small class="pick-state">${on ? "En la combinada" : "Pulsar para añadir"}</small></button>`;
  }).join("");
  blocks.push(`<details class="stat-fold"><summary><span>Cuotas de jugadores</span><small>Gol, asistencia o tarjeta</small></summary><div class="stat-body"><div class="prop-grid">${props}</div></div></details>`);
  const books = BOOKS.map((book) => {
    const quote = bookQuote(match, book);
    const homeId = `b:${match.id}:${book.id}:h`;
    const awayId = `b:${match.id}:${book.id}:a`;
    const sideCard = (side, id) => {
      const on = has(id);
      const rival = side.team === match.home ? match.away : match.home;
      return `<button type="button" class="bet pickable${on ? " is-on" : ""}" data-leg="${id}" aria-pressed="${on}"><p>Apuesta a que <b>${side.team}</b> marca más goles que ${rival} en el encuentro. Cuota de ejemplo de ${book.name}.</p><div class="odd"><small>${book.name}</small><b>${side.odd.toFixed(2)}</b><small class="odd-kind">${side.hit}%</small></div><small class="pick-state">${on ? "En la combinada" : "Pulsar para añadir"}</small></button>`;
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
    title: pick.copy.text,
    detail: `${match.home} vs ${match.away} · ${section.title}`,
    odd: pick.odd,
    hit: pick.hit,
  };
}
