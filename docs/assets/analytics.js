(() => {
  const page = document.body.dataset.analyticsPage;
  if (!page || !/^https?:$/.test(location.protocol) || window.top !== window) return;

  const preferenceKey = "pureclean.analytics.optout";
  const protectedByGpc = navigator.globalPrivacyControl === true;
  let optedOut = false;
  try {
    optedOut = localStorage.getItem(preferenceKey) === "1";
  } catch {
    // Some browsers block storage.
  }

  const preference = document.querySelector("#analytics-optout");
  if (preference) {
    const feedback = document.querySelector("#analytics-preference");
    preference.checked = optedOut || protectedByGpc;
    preference.disabled = protectedByGpc;
    if (protectedByGpc) feedback.textContent = "Global Privacy Control is active.";
    preference.addEventListener("change", () => {
      optedOut = preference.checked;
      try {
        if (optedOut) localStorage.setItem(preferenceKey, "1");
        else localStorage.removeItem(preferenceKey);
        feedback.textContent = optedOut
          ? "Analytics is off for this browser."
          : "Analytics is on for this browser.";
      } catch {
        feedback.textContent = "This browser can only apply your preference on this page.";
      }
    });
  }

  const isGitHubPages = location.origin === "https://git4pureclean-tech.github.io";
  // Set this to the client-owned Worker's /api/analytics URL after deployment.
  const githubPagesCollector = "";
  const screenCategory = matchMedia("(max-width: 680px)").matches ? "mobile" : "wide";
  function count(control) {
    if (protectedByGpc || optedOut) return;
    const payload = JSON.stringify({ page, control, screen: screenCategory });
    if (isGitHubPages) {
      if (!githubPagesCollector) return;
      // A text body keeps the cross-origin request simple and avoids a preflight on exit clicks.
      fetch(githubPagesCollector, {
        method: "POST",
        mode: "no-cors",
        credentials: "omit",
        referrerPolicy: "no-referrer",
        keepalive: true,
        body: payload,
      }).catch(() => {});
      return;
    }
    if (navigator.sendBeacon?.("/api/analytics", new Blob([payload], { type: "application/json" }))) return;
    fetch("/api/analytics", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: payload,
      keepalive: true,
      credentials: "same-origin",
    }).catch(() => {});
  }

  count("view");
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
