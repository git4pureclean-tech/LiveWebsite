# PureClean Carpet Care website

`docs/` contains the static website for GitHub Pages. The production canonical host is `https://purecleancarpet.ca`. Preview locally with `python3 -m http.server --directory docs 8080` and open `http://localhost:8080/`.

## Publish the website

1. In **Settings → Pages**, select **Deploy from a branch**, then **main** and **/docs**. Follow [GitHub’s custom-domain instructions](https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site/managing-a-custom-domain-for-your-github-pages-site) to verify your domain, set the custom domain and configure DNS. Back up the current WordPress site and DNS configuration before switching production. Enable HTTPS and verify the apex and `www` behaviour.
2. Confirm that the production home, service, quote and guide URLs return HTTP 200. Check the menu on mobile, image and video playback, the phone links and the WhatsApp message preview. The quote form opens a WhatsApp draft for the visitor to send.
3. Preserve the two legacy routes below. GitHub Pages serves instant HTML redirects for both. Use HTTP 301s at the production edge if it supports them, and keep the same destinations. Check for inbound links or Search Console traffic before deciding whether other retired WordPress URLs need a redirect.

| Legacy URL | Destination |
| --- | --- |
| `/about/` | `/about-us/` |
| `/blog/diy-vs-professional-carpet-cleaning/` | `/guides/diy-or-professional-carpet-cleaning/` |

## Run analytics

GitHub Pages serves the website. The event API and password-protected activity report require the Cloudflare Worker in `analytics/` and a D1 database.

1. Run `node analytics/build.mjs` to create `dist/server/index.js`. Use that module as the Worker entry point. Apply `drizzle/0000_interaction_counts.sql` to a D1 database and bind it as `DB`.
2. Set `ANALYTICS_REPORT_PASSWORD` as a Worker secret. Configure the Worker to receive `/api/analytics` and `/analytics*` on the same production HTTPS origin as the site. The API checks the request origin. A separate Worker hostname requires an explicit cross-origin integration.
3. Visit `/analytics/` and sign in as `pureclean` using the Worker secret. Confirm that a page view and a test interaction appear, then verify the privacy-page opt-out. Add the analytics routes through whichever edge setup you use for the custom domain.

## Search launch checklist

- Load `/robots.txt` and `/sitemap.xml` on the custom domain. Verify that the 12 sitemap URLs are canonical, indexable and return HTTP 200. The privacy page and analytics stay out of search results.
- Verify the domain property in Google Search Console and submit `https://purecleancarpet.ca/sitemap.xml`. Inspect the homepage, residential and commercial service pages, and the guide after the cutover. Confirm the live structured data and social preview images.
- Confirm the existing Google Business Profile name, published service areas, categories, hours and website link. Use those same details for Bing Places, Apple Maps and other listings you own. Keep the profile as a service-area business unless the owner confirms a staffed customer-facing address.
- Compare branded and non-branded Search Console queries by landing page after launch. Review calls and WhatsApp taps alongside those impressions and clicks. Taps indicate intent to contact.
