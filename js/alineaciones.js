import { FIXTURES, searchBlob, dayKey, dayLabel, hourLabel } from "./demo.mjs";
import { bindLineups, teamPitch } from "./lineup.mjs";

const board = document.querySelector("#board");
const query = document.querySelector("#q");
const count = document.querySelector("#count");

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
    ${bucket.matches.map((match) => `<details class="match-fold">
      <summary><span>${match.home} vs ${match.away}</span><small>${match.league} · ${hourLabel(match.kickoff)}</small></summary>
      <div class="pitch-pair">${teamPitch(match.home)}${teamPitch(match.away)}</div>
    </details>`).join("")}
  </details>`).join("");
}

query.addEventListener("input", render);
bindLineups();
render();
