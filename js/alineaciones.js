import { FIXTURES, squad, searchBlob, dayKey, dayLabel, hourLabel, yellowText } from "./demo.mjs";

const board = document.querySelector("#board");
const query = document.querySelector("#q");
const count = document.querySelector("#count");

function personRow(player) {
  const note = player.note ? ` · ${player.note}` : "";
  return `<li><b>${player.name}</b> <span>${player.pos}</span><small>${yellowText(player.yellows)}${note}</small></li>`;
}

function side(team) {
  const group = squad(team);
  const absent = (list, empty) => list.length
    ? `<ul class="xi-list">${list.map(personRow).join("")}</ul>`
    : `<p class="sub">${empty}</p>`;
  return `<div>
    <h3>${team}</h3>
    <p class="market-label">Once probable</p>
    <ul class="xi-list">${group.xi.map(personRow).join("")}</ul>
    <p class="market-label">Lesionados</p>
    ${absent(group.injured, "Ninguno")}
    <p class="market-label">Sancionados</p>
    ${absent(group.suspended, "Ninguno")}
  </div>`;
}

function render() {
  const text = query.value.trim().toLocaleLowerCase("es");
  const rows = FIXTURES.filter((match) => !text || searchBlob(match).toLocaleLowerCase("es").includes(text));
  const days = new Set(rows.map((match) => dayKey(match.kickoff)));
  count.textContent = `${days.size} jornadas · ${rows.length} partidos`;
  if (!rows.length) {
    board.innerHTML = `<p class="empty">Ningún partido coincide con la búsqueda.</p>`;
    return;
  }
  const groups = [];
  for (const match of rows) {
    const key = dayKey(match.kickoff);
    let bucket = groups.find((item) => item.key === key);
    if (!bucket) {
      bucket = { key, day: dayLabel(match.kickoff), matches: [] };
      groups.push(bucket);
    }
    bucket.matches.push(match);
  }
  board.innerHTML = groups.map((bucket) => `<details class="day fold"${text ? " open" : ""}>
    <summary><span>${bucket.day}</span><small>${bucket.matches.length} partidos</small></summary>
    ${bucket.matches.map((match) => `<article class="card lineup-card">
      <div class="meta-row"><span>${match.league}</span><span>${hourLabel(match.kickoff)}</span></div>
      <div class="xi-grid">${side(match.home)}${side(match.away)}</div>
    </article>`).join("")}
  </details>`).join("");
}

query.addEventListener("input", render);
render();
