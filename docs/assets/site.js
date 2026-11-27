(() => {
  const menu = document.querySelector(".menu-button");
  if (menu) {
    const header = menu.closest(".mast");
    const close = () => {
      header.classList.remove("menu-open");
      menu.setAttribute("aria-expanded", "false");
    };
    menu.addEventListener("click", () => {
      const opened = header.classList.toggle("menu-open");
      menu.setAttribute("aria-expanded", String(opened));
    });
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && header.classList.contains("menu-open")) {
        close();
        menu.focus();
      }
    });
    document.addEventListener("click", (event) => {
      if (!header.contains(event.target) || event.target.closest(".nav-links a")) close();
    });
  }
  for (const range of document.querySelectorAll(".compare input[type=range]")) {
    const update = () => {
      range.closest(".compare").style.setProperty("--split", range.value + "%");
      range.setAttribute("aria-valuetext", range.value + " percent of the before image visible");
    };
    range.addEventListener("input", update);
    update();
  }
  const form = document.querySelector("#quote-form");
  if (form) {
    const selector = form.elements.namedItem("service");
    const requested = new URLSearchParams(location.search).get("service");
    if ([...selector.options].some((o) => o.value === requested)) selector.value = requested;
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      if (!form.reportValidity()) return;
      const fields = new FormData(form);
      const lines = ["Hello PureClean, I would like a cleaning quote."];
      for (const [key, label] of [
        ["name", "Name"],
        ["service", "Service"],
        ["area", "Neighbourhood"],
        ["phone", "Phone"],
        ["email", "Email"],
        ["notes", "Job details"],
      ]) {
        const value = String(fields.get(key) || "").trim();
        if (value) lines.push(label + ": " + value);
      }
      location.assign("https://wa.me/16478038776?text=" + encodeURIComponent(lines.join("\n")));
    });
  }
  if (location.protocol === "file:") {
    for (const node of document.querySelectorAll("a[href],iframe[src]")) {
      const att = node.tagName === "IFRAME" ? "src" : "href",
        raw = node.getAttribute(att);
      if (!raw || raw.startsWith("#") || /^(?:[a-z]+:|\/\/)/i.test(raw)) continue;
      const match = raw.match(/^([^?#]*\/)([?#].*)?$/);
      if (match) node.setAttribute(att, match[1] + "index.html" + (match[2] || ""));
    }
  }
})();
const designBoard = document.querySelector("#design-board");
if (designBoard) {
  for (const control of document.querySelectorAll(".device-select input")) {
    control.addEventListener("change", () => {
      if (control.checked) designBoard.dataset.size = control.value;
    });
  }
}
