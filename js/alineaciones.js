import { FIXTURES, searchBlob, dayKey, dayLabel, hourLabel } from "./demo.mjs";
import { bindLineups, teamPitch } from "./lineup.mjs";

const board = document.querySelector("#board");
const query = document.querySelector("#q");
const dateSelect = document.querySelector("#day");
const count = document.querySelector("#count");

const seenDays = new Set();
for (const match of FIXTURES) {
  const key = dayKey(match.kickoff);
  if (seenDays.has(key)) continue;
  seenDays.add(key);
  const option = document.createElement("option");
  option.value = key;
  option.textContent = dayLabel(match.kickoff);
  dateSelect.append(option);
}

function render() {
  const text = query.value.trim().toLocaleLowerCase("es");
  const picked = dateSelect.value;
  const rows = FIXTURES.filter((match) => {
    const sameDay = !picked || dayKey(match.kickoff) === picked;
    return sameDay && (!text || searchBlob(match).toLocaleLowerCase("es").includes(text));
  });
  const days = new Set(rows.map((match) => dayKey(match.kickoff)));
  const dayNoun = days.size === 1 ? "jornada" : "jornadas";
  const matchNoun = rows.length === 1 ? "partido" : "partidos";
  count.textContent = `${days.size} ${dayNoun} · ${rows.length} ${matchNoun}`;
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
  board.innerHTML = groups.map((bucket) => {
    const open = text || bucket.key === picked ? " open" : "";
    return `<details class="day fold"${open}>
    <summary><span>${bucket.day}</span><small>${bucket.matches.length} ${bucket.matches.length === 1 ? "partido" : "partidos"}</small></summary>
    ${bucket.matches.map((match) => `<details class="match-fold">
      <summary><span>${match.home} vs ${match.away}</span><small>${match.league} · ${hourLabel(match.kickoff)}</small></summary>
      <div class="pitch-pair">${teamPitch(match.home)}${teamPitch(match.away)}</div>
    </details>`).join("")}
  </details>`;
  }).join("");
}

query.addEventListener("input", render);
dateSelect.addEventListener("change", () => {
  render();
  if (dateSelect.value) board.querySelector("details[open]")?.scrollIntoView({ block: "start" });
});
bindLineups();
render();
