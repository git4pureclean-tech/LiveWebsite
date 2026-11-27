const types = {
  view: "Page view",
  call: "Call tap",
  whatsapp: "WhatsApp tap",
  whatsapp_form: "WhatsApp form handoff",
  email: "Email tap",
  contact: "Contact page link",
  navigation: "Link",
  button: "Button",
  menu: "Menu toggle",
  faq: "FAQ toggle",
  comparison: "Before and after slider",
  preview_toggle: "Design preview toggle",
  video_play: "Video play",
  video_pause: "Video pause",
  video_end: "Video complete",
  video_seek: "Video seek",
};

function reply(body, status, extra = {}) {
  return new Response(body, {
    status,
    headers: { "Cache-Control": "no-store", "X-Robots-Tag": "noindex", ...extra },
  });
}

function escapeHtml(value) {
  return String(value).replace(
    /[&<>"']/g,
    (char) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      })[char],
  );
}

function document(title, content) {
  return `<!doctype html><html lang="en-CA"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex">
<title>${escapeHtml(title)} | PureClean Carpet Care</title>
<style>
*{box-sizing:border-box}body{margin:0;background:#f7fbfd;color:#123950;font:16px/1.5 system-ui,sans-serif}
header{background:#123950;color:white;padding:20px clamp(18px,5vw,80px);font-weight:700}
main{width:min(1320px,92vw);margin:32px auto}h1{font-size:clamp(32px,5vw,54px);line-height:1.05;margin:0 0 12px}
h2{font-size:23px;margin:0}p{max-width:68ch;margin:8px 0 18px}a{color:#1a4f72;text-underline-offset:4px}
nav{display:flex;gap:10px;flex-wrap:wrap;margin:22px 0}nav a{background:white;border:1px solid #a8c8db;padding:7px 12px}
nav a[aria-current]{background:#123950;color:white}.metrics{display:grid;grid-template-columns:repeat(auto-fit,minmax(135px,1fr));gap:12px;margin:22px 0}
.metric{background:#e4f3fa;border-top:3px solid #8ecae0;padding:13px 16px}.metric strong{display:block;font-size:30px;line-height:1.15}
.panel{margin-top:24px}.table-wrap{overflow:auto;margin-top:10px}table{border-collapse:collapse;width:100%;background:white}
th,td{padding:9px 12px;text-align:left;border-bottom:1px solid #d3e7f2;vertical-align:top}th{background:#e4f3fa}
td:last-child,th:last-child{text-align:right;white-space:nowrap}code{font-size:.91em;overflow-wrap:anywhere}
small{color:#3f6e8c}.sign-in{display:inline-block;padding:12px 18px;background:#123950;color:white}
</style></head><body><header>PureClean Carpet Care</header><main>${content}</main></body></html>`;
}

const html = {
  "Content-Type": "text/html; charset=utf-8",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
};

async function countInteraction(request, env, url) {
  if (request.method !== "POST") return reply("Method not allowed", 405, { Allow: "POST" });
  if (request.headers.get("Origin") !== url.origin) return reply("Forbidden", 403);
  if (request.headers.get("Sec-GPC") === "1") return reply(null, 204);
  if (request.headers.get("Content-Type")?.split(";")[0].trim() !== "application/json")
    return reply("Unsupported media type", 415);

  const stream = request.body?.getReader();
  if (!stream) return reply("Missing event", 400);
  const decoder = new TextDecoder();
  let body = "";
  let size = 0;
  for (;;) {
    const { value, done } = await stream.read();
    if (done) break;
    size += value.byteLength;
    if (size > 700) {
      await stream.cancel();
      return reply("Event exceeds size limit", 413);
    }
    body += decoder.decode(value, { stream: true });
  }
  body += decoder.decode();

  let event;
  try {
    event = JSON.parse(body);
  } catch {
    return reply("Invalid event", 400);
  }
  const { page, control, screen } = event ?? {};
  if (
    typeof page !== "string" ||
    typeof control !== "string" ||
    !["mobile", "wide"].includes(screen) ||
    !Object.hasOwn(controls, page) ||
    !Object.hasOwn(controls[page], control)
  ) {
    return reply("Unknown event", 400);
  }
  const record = controls[page][control];
  const now = new Date().toISOString();
  await env.DB.prepare(
    `INSERT INTO interaction_counts (day, page, control, screen, kind, label, placement, total, last_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?)
     ON CONFLICT(day, page, control, screen) DO UPDATE SET total = total + 1, last_at = excluded.last_at`,
  )
    .bind(now.slice(0, 10), page, control, screen, record.kind, record.label, record.placement, now)
    .run();
  return reply(null, 204);
}

async function sameSecret(provided, expected) {
  const toHash = (value) => crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  const [first, second] = (await Promise.all([toHash(provided), toHash(expected)])).map(
    (bytes) => new Uint8Array(bytes),
  );
  let difference = 0;
  for (let i = 0; i < first.length; i++) difference |= first[i] ^ second[i];
  return difference === 0;
}

async function canOpenReport(request, env, isSites) {
  if (isSites) {
    const email = request.headers.get("oai-authenticated-user-email")?.toLowerCase();
    return Boolean(
      email &&
        request.headers.get("oai-authenticated-user-id") &&
        email === env.ANALYTICS_OWNER_EMAIL?.toLowerCase(),
    );
  }
  const header = request.headers.get("Authorization");
  if (!env.ANALYTICS_REPORT_PASSWORD || !header?.startsWith("Basic ") || header.length > 1000) return false;
  try {
    const credentials = atob(header.slice(6));
    return (
      credentials.startsWith("pureclean:") &&
      (await sameSecret(credentials.slice("pureclean:".length), env.ANALYTICS_REPORT_PASSWORD))
    );
  } catch {
    return false;
  }
}

async function report(request, env, url) {
  const isSites = Boolean(env.ANALYTICS_SITES_HOST && url.host === env.ANALYTICS_SITES_HOST);
  if (!(await canOpenReport(request, env, isSites))) {
    const signedIn = Boolean(request.headers.get("oai-authenticated-user-id"));
    const signIn =
      '<a class="sign-in" href="/signin-with-chatgpt?return_to=%2Fanalytics%2F" target="_top">Sign in with ChatGPT</a>';
    const content =
      isSites && !signedIn
        ? `<p>Sign in with the site owner’s ChatGPT account to view the report.</p>${signIn}`
        : "<p>This report is available to the site owner.</p>";
    return reply(
      document("Website activity", `<h1>Website activity</h1>${content}`),
      isSites && signedIn ? 403 : 401,
      {
        ...html,
        ...(!isSites && env.ANALYTICS_REPORT_PASSWORD
          ? { "WWW-Authenticate": 'Basic realm="PureClean analytics", charset="UTF-8"' }
          : {}),
      },
    );
  }

  const requestedDays = Number(url.searchParams.get("days"));
  const days = [7, 30, 90].includes(requestedDays) ? requestedDays : 30;
  const screens = { all: "All screens", mobile: "Mobile width", wide: "Wide screens" };
  const requestedScreen = url.searchParams.get("screen") || "all";
  const screen = Object.hasOwn(screens, requestedScreen) ? requestedScreen : "all";
  const from = new Date();
  from.setUTCDate(from.getUTCDate() - days + 1);
  const day = from.toISOString().slice(0, 10);
  const where = "WHERE day >= ? AND (? = 'all' OR screen = ?)";
  const batch = await env.DB.batch([
    env.DB.prepare(`SELECT kind, SUM(total) AS total FROM interaction_counts ${where} GROUP BY kind`).bind(
      day,
      screen,
      screen,
    ),
    env.DB.prepare(
      `SELECT page, SUM(CASE WHEN kind = 'view' THEN total ELSE 0 END) AS views,
        SUM(CASE WHEN kind = 'call' THEN total ELSE 0 END) AS calls,
        SUM(CASE WHEN kind IN ('whatsapp','whatsapp_form') THEN total ELSE 0 END) AS messages
      FROM interaction_counts ${where} GROUP BY page ORDER BY views DESC, page`,
    ).bind(day, screen, screen),
    env.DB.prepare(
      `SELECT page, placement, label, kind, SUM(total) AS total, MAX(last_at) AS last_at
      FROM interaction_counts ${where} AND kind <> 'view'
      GROUP BY page, control, placement, label, kind
      ORDER BY total DESC, last_at DESC`,
    ).bind(day, screen, screen),
  ]);
  const [totals, pages, actions] = batch.map((result) => result.results);
  const number = new Intl.NumberFormat("en-CA");
  const total = (kind) => number.format(totals.find((row) => row.kind === kind)?.total ?? 0);
  const stats = [
    ["Page views", "view"],
    ["Call taps", "call"],
    ["WhatsApp taps", "whatsapp"],
    ["WhatsApp form handoffs", "whatsapp_form"],
    ["Email taps", "email"],
    ["Video plays", "video_play"],
  ]
    .map(([label, kind]) => `<div class="metric"><strong>${total(kind)}</strong>${label}</div>`)
    .join("");
  const link = (label, period, width, current) =>
    `<a href="/analytics/?days=${period}&amp;screen=${width}"${current ? ' aria-current="true"' : ""}>${label}</a>`;
  const periodLinks = [7, 30, 90]
    .map((value) => link(`Last ${value} days`, value, screen, days === value))
    .join("");
  const screenLinks = Object.entries(screens)
    .map(([key, name]) => link(name, days, key, screen === key))
    .join("");
  const pageRows = pages
    .map(
      (row) =>
        `<tr><td><code>${escapeHtml(row.page)}</code></td><td>${number.format(row.views)}</td><td>${number.format(row.calls)}</td><td>${number.format(row.messages)}</td></tr>`,
    )
    .join("");
  const actionRows = actions
    .map(
      (row) =>
        `<tr><td><code>${escapeHtml(row.page)}</code></td><td>${escapeHtml(row.placement)}</td><td>${escapeHtml(row.label)}</td><td>${escapeHtml(types[row.kind] || row.kind)}</td><td>${escapeHtml(row.last_at.slice(0, 16).replace("T", " "))}</td><td>${number.format(row.total)}</td></tr>`,
    )
    .join("");
  const pageTable = pageRows
    ? `<div class="table-wrap"><table><thead><tr><th>Page</th><th>Views</th><th>Call taps</th><th>WhatsApp opens</th></tr></thead><tbody>${pageRows}</tbody></table></div>`
    : "<p>Page activity will appear here as visitors use the site.</p>";
  const actionTable = actionRows
    ? `<div class="table-wrap"><table><thead><tr><th>Page</th><th>Placement</th><th>Control</th><th>Action</th><th>Last recorded (UTC)</th><th>Count</th></tr></thead><tbody>${actionRows}</tbody></table></div>`
    : "<p>There are no recorded interactions for these filters.</p>";
  return reply(
    document(
      "Website activity",
      `
    <h1>Website activity</h1>
    <p>See which pages and controls visitors use. Call taps and WhatsApp handoffs measure intent to contact. The site cannot see calls connected, messages sent or bookings completed.</p>
    <nav aria-label="Date range">${periodLinks}</nav><nav aria-label="Screen size">${screenLinks}</nav>
    <div class="metrics">${stats}</div>
    <section class="panel"><h2>Activity by page</h2>${pageTable}</section>
    <section class="panel"><h2>Individual controls</h2>${actionTable}</section>
  `,
    ),
    200,
    html,
  );
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    try {
      if (url.pathname === "/api/analytics") return await countInteraction(request, env, url);
      if (["/analytics", "/analytics/"].includes(url.pathname)) return await report(request, env, url);
      return env.ASSETS.fetch(request);
    } catch (error) {
      console.error("PureClean analytics failed", error?.message);
      return reply("Temporarily unavailable", 503);
    }
  },
};
