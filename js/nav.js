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
