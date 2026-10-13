const nav = document.querySelector(".nav");
const toggle = document.querySelector(".nav-toggle");

if (nav && toggle) {
  const setOpen = (open) => {
    nav.classList.toggle("nav-open", open);
    toggle.setAttribute("aria-expanded", String(open));
    toggle.setAttribute("aria-label", open ? "Cerrar menú" : "Abrir menú");
  };

  toggle.addEventListener("click", () => {
    setOpen(toggle.getAttribute("aria-expanded") !== "true");
  });

  nav.querySelectorAll(".nav-links a").forEach((link) => {
    link.addEventListener("click", () => {
      requestAnimationFrame(() => setOpen(false));
    });
  });
}

const toTop = document.createElement("button");
toTop.className = "to-top";
toTop.type = "button";
toTop.setAttribute("aria-label", "Subir al principio");
toTop.innerHTML = "<span></span>";
document.body.append(toTop);
toTop.addEventListener("click", () => window.scrollTo({ top: 0, behavior: "smooth" }));
const toggleTop = () => toTop.classList.toggle("show", window.scrollY > 480);
toggleTop();
window.addEventListener("scroll", toggleTop, { passive: true });

function prepareTables() {
  document.querySelectorAll(".drag-table").forEach((el) => {
    if (el.dataset.ready) return;
    el.dataset.ready = "1";
    const wrap = el.closest(".drag-wrap");
    el.addEventListener("scroll", () => {
      wrap?.classList.toggle("is-scrolled", el.scrollLeft > 12);
    }, { passive: true });
    let startX = 0;
    let startLeft = 0;
    let dragging = false;
    el.addEventListener("pointerdown", (event) => {
      if (event.pointerType === "touch" || event.button !== 0) return;
      dragging = true;
      startX = event.clientX;
      startLeft = el.scrollLeft;
      el.classList.add("is-dragging");
      el.setPointerCapture(event.pointerId);
    });
    el.addEventListener("pointermove", (event) => {
      if (!dragging) return;
      el.scrollLeft = startLeft - (event.clientX - startX);
    });
    const stop = () => {
      dragging = false;
      el.classList.remove("is-dragging");
    };
    el.addEventListener("pointerup", stop);
    el.addEventListener("pointercancel", stop);
  });
}
prepareTables();
window.prepareTables = prepareTables;
