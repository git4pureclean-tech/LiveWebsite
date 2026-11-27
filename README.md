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

## Deploy the client analytics dashboard

The dashboard and event collector run as a standalone Cloudflare Worker with a D1 database in the client’s account. The marketing site stays on GitHub Pages. The dashboard uses a separate password and the username `pureclean`.

1. In the client’s Cloudflare account, select Workers Free and create a D1 database named `pureclean-analytics`. Copy `analytics/wrangler.example.toml` to `analytics/wrangler.toml` and set `database_id` to the ID assigned by Cloudflare.
2. From the repository root, run the build, apply the database schema, set the dashboard password when prompted, and deploy.

   ```sh
   node analytics/build.mjs
   npx wrangler d1 migrations apply DB --remote --config analytics/wrangler.toml
   npx wrangler secret put ANALYTICS_REPORT_PASSWORD --config analytics/wrangler.toml
   npx wrangler deploy --config analytics/wrangler.toml
   ```

3. Open the Worker’s `/analytics/` URL and verify the password works. In `docs/assets/analytics.js`, set `githubPagesCollector` to the Worker’s HTTPS `/api/analytics` URL and publish the updated website. Verify that a test visit appears on the report as a row starting with `/LiveWebsite/`.
4. Share the dashboard URL and password with the client separately. Keep the password in the client’s password manager and out of the repository.

## Search launch checklist

- Load `/robots.txt` and `/sitemap.xml` on the custom domain. Verify that the 12 sitemap URLs are canonical, indexable and return HTTP 200. The privacy page and analytics stay out of search results.
- Verify the domain property in Google Search Console and submit `https://purecleancarpet.ca/sitemap.xml`. Inspect the homepage, residential and commercial service pages, and the guide after the cutover. Confirm the live structured data and social preview images.
- Confirm the existing Google Business Profile name, published service areas, categories, hours and website link. Use those same details for Bing Places, Apple Maps and other listings you own. Keep the profile as a service-area business unless the owner confirms a staffed customer-facing address.
- Compare branded and non-branded Search Console queries by landing page after launch. Review calls and WhatsApp taps alongside those impressions and clicks. Taps indicate intent to contact.
