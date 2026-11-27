(() => {
  const page = document.body.dataset.analyticsPage;
  if (!page || !/^https?:$/.test(location.protocol) || window.top !== window) return;

  const preferenceKey = "pureclean.analytics.consent";
  const legacyOptOutKey = "pureclean.analytics.optout";
  const protectedByGpc = navigator.globalPrivacyControl === true;
  const screenCategory = matchMedia("(max-width: 680px)").matches ? "mobile" : "wide";
  let consent = readConsent();
  let countedView = false;

  function readConsent() {
    try {
      const saved = localStorage.getItem(preferenceKey);
      if (saved === "accepted" || saved === "declined") return saved;
      if (localStorage.getItem(legacyOptOutKey) === "1") return "declined";
    } catch {
      // Analytics stays off until the visitor accepts.
    }
    return null;
  }

  const preference = document.querySelector("#analytics-consent");
  const feedback = document.querySelector("#analytics-preference");
  let banner;
  if (preference) {
    preference.disabled = protectedByGpc;
    preference.addEventListener("change", () => {
      saveConsent(preference.checked ? "accepted" : "declined");
    });
  } else if (!protectedByGpc) {
    banner = document.createElement("aside");
    banner.className = "analytics-banner";
    banner.hidden = true;
    banner.setAttribute("aria-labelledby", "analytics-banner-title");
    banner.innerHTML = `
      <h2 id="analytics-banner-title">Cookie preferences</h2>
      <p>Allow optional analytics to help us understand how people use our site. We count page views and actions like phone taps, WhatsApp taps, and video plays.</p>
      <div class="analytics-banner-actions">
        <button type="button" data-choice="declined">Decline</button>
        <button type="button" data-choice="accepted">Accept analytics</button>
      </div>
      <a>Analytics and privacy</a>
    `;
    banner.querySelector("a").href = new URL("../privacy/", document.currentScript.src).href;
    for (const button of banner.querySelectorAll("button")) {
      button.addEventListener("click", () => saveConsent(button.dataset.choice));
    }
    const skipLink = document.querySelector(".skip");
    if (skipLink) skipLink.after(banner);
    else document.body.prepend(banner);
  }

  function saveConsent(choice) {
    if (protectedByGpc) return;
    consent = choice;
    let saved = true;
    try {
      localStorage.setItem(preferenceKey, choice);
    } catch {
      saved = false;
    }
    applyConsent(saved);
  }

  function applyConsent(saved = true) {
    const enabled = consent === "accepted" && !protectedByGpc;
    if (banner) banner.hidden = consent !== null;
    if (preference) {
      preference.checked = enabled;
      if (protectedByGpc) feedback.textContent = "Analytics is off because your browser sends Global Privacy Control.";
      else if (!saved) feedback.textContent = "Your choice applies to this page only.";
      else feedback.textContent = enabled ? "Analytics is on for this browser." : "Analytics is off for this browser.";
    }
    if (enabled && !countedView) {
      countedView = true;
      count("view");
    }
  }

  function count(control) {
    if (protectedByGpc || consent !== "accepted") return;
    const payload = JSON.stringify({ page, control, screen: screenCategory });
    if (navigator.sendBeacon?.("/api/analytics", new Blob([payload], { type: "application/json" }))) return;
    fetch("/api/analytics", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: payload,
      keepalive: true,
      credentials: "same-origin",
    }).catch(() => {});
  }

  function refreshConsent() {
    consent = readConsent();
    applyConsent();
  }
  window.addEventListener("storage", (event) => {
    if (event.key === preferenceKey || event.key === null) refreshConsent();
  });
  window.addEventListener("pageshow", (event) => {
    if (event.persisted) refreshConsent();
  });
  applyConsent();
  const trackLinkOrButton = (event) => {
    const target = event.target.closest?.("a[data-analytics],button[data-analytics],summary[data-analytics]");
    if (target) count(target.dataset.analytics);
  };
  document.addEventListener("click", trackLinkOrButton, { capture: true });
  document.addEventListener(
    "auxclick",
    (event) => {
      if (event.button === 1 && event.target.closest?.("a[data-analytics]")) trackLinkOrButton(event);
    },
    { capture: true },
  );

  document.addEventListener("change", (event) => {
    const control = event.target.closest?.("input[data-analytics]");
    if (control) count(control.dataset.analytics);
  });
  document.addEventListener(
    "submit",
    (event) => {
      if (event.target.id !== "quote-form") return;
      const submitter = event.submitter || event.target.querySelector("button[type=submit]");
      if (submitter?.dataset.analytics) count(submitter.dataset.analytics + ":submit");
    },
    { capture: true },
  );

  for (const video of document.querySelectorAll("video[data-analytics]")) {
    for (const [event, action] of Object.entries({
      play: "play",
      pause: "pause",
      ended: "end",
      seeked: "seek",
    })) {
      video.addEventListener(event, () => {
        if (event !== "pause" || !video.ended) count(video.dataset.analytics + ":" + action);
      });
    }
  }
})();
