import { squad } from "./demo.mjs";

function yellowLabel(count) {
  const yellows = Number(count) || 0;
  return yellows === 1 ? "1 amarilla" : `${yellows} amarillas`;
}

function playerButton(player, number) {
  const shirt = number ? `<b>${number}</b>` : "";
  return `<button type="button" class="pitch-player" aria-expanded="false">${shirt}<span>${player.name}</span><i class="bubble">${yellowLabel(player.yellows)}</i></button>`;
}

function listed(players) {
  if (!players.length) return `<p class="sub">Ninguno</p>`;
  return `<ul class="xi-list">${players.map((player) => `<li>${playerButton(player)}</li>`).join("")}</ul>`;
}

export function teamPitch(team) {
  const group = squad(team);
  const numbered = [];
  for (const pos of ["POR", "DEF", "MED", "DEL"]) {
    for (const player of group.xi.filter((item) => item.pos === pos)) {
      numbered.push({ ...player, number: numbered.length + 1 });
    }
  }
  const lines = ["DEL", "MED", "DEF", "POR"].map((pos) => {
    const row = numbered.filter((player) => player.pos === pos);
    if (!row.length) return "";
    return `<div class="pitch-line">${row.map((player) => playerButton(player, player.number)).join("")}</div>`;
  }).join("");
  return `<section class="side-pitch">
    <h3>${team}</h3>
    <div class="pitch">${lines}</div>
    <p class="market-label">Banquillo</p>
    ${listed(group.bench)}
    <p class="market-label">Lesionados</p>
    ${listed(group.injured)}
    <p class="market-label">Sancionados</p>
    ${listed(group.suspended)}
  </section>`;
}

let bound = false;

export function bindLineups() {
  if (bound) return;
  bound = true;
  document.addEventListener("click", (event) => {
    const player = event.target.closest(".pitch-player");
    document.querySelectorAll(".pitch-player.is-open").forEach((el) => {
      if (el !== player) {
        el.classList.remove("is-open");
        el.setAttribute("aria-expanded", "false");
      }
    });
    if (!player) return;
    const open = !player.classList.contains("is-open");
    player.classList.toggle("is-open", open);
    player.setAttribute("aria-expanded", String(open));
  });
}
