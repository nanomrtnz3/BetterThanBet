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
const count = document.querySelector("#count");
const openId = { current: null };

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
  if (!safe && !risky) return `<p class="sub">Con estas cuotas no hay una acción clara.</p>`;
  const line = (kind, row) =>
    row
      ? `<p><b>${kind}.</b> ${row.market} · ${row.hit}% de acierto · cuota ${row.odd.toFixed(2)}</p>`
      : "";
  return `<div class="value-pair">${line("Más probable", safe)}${line("Más arriesgada", risky)}</div>`;
}

function render() {
  const text = query.value.trim().toLocaleLowerCase("es");
  const rows = FIXTURES.filter((match) => {
    const blob = `${match.home} ${match.away} ${match.league}`.toLocaleLowerCase("es");
    return !text || blob.includes(text);
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
      bucket = { day, comps: [] };
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
    .map(
      (bucket) => `<section class="day"><h2>${bucket.day}</h2>${bucket.comps
        .map(
          (comp) => `<h3 class="comp">${comp.name}</h3>${comp.matches
            .map((match) => {
              const open = openId.current === match.id;
              return `<button class="fixture" type="button" data-id="${match.id}" aria-expanded="${open}">
                <strong>${match.home} vs ${match.away}</strong>
                <time>${hourLabel(match.kickoff)}</time>
              </button>${
                open ? `<div class="fixture-panel">${oddsBlock(match)}${actionBlock(match)}</div>` : ""
              }`;
            })
            .join("")}`
        )
        .join("")}</section>`
    )
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

render();
