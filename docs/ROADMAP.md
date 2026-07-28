# MDViewer — Market Analysis, Feature Review & Roadmap

_Last updated: 2026-07-19_

## 1. Executive summary

MDViewer occupies a genuinely underserved niche: a **zero-config, server-hosted,
live markdown _browser_** that points at **existing folders across multiple
locations — including SMB/NAS shares** — with no build step and no database, in a
single Docker container.

Almost every popular tool sits in a different box:

- **Static site generators** (MkDocs, Docsify, Docusaurus, Quartz, Flowershow)
  require a build + deploy step; they don't "point at a live folder and browse".
- **PKM apps** (Obsidian, Logseq) are local desktop apps, not multi-user server viewers.
- **DB-backed wikis** (Wiki.js, Outline, HedgeDoc/HackMD, Trilium) are heavy and
  own their storage.
- **Lightweight web viewers** (Perlite, MarkdownManager, mdview) are typically
  single-folder, local-disk only, and PHP/desktop.

**Our wedge = "browse all your markdown, everywhere, from any browser, instantly."**
The multi-location + SMB capability is the differentiator to protect and lead with.

The cost of that simplicity today: the app is **read-only**, **manually refreshed**,
**unauthenticated**, **CDN-dependent**, and its markdown/search feature set trails
what users now expect from Obsidian/Quartz-class tools (wikilinks, backlinks,
callouts, math, live updates, match highlighting).

---

## 2. Competitive landscape

| Tool | Hosting model | Live (no build) | Multi-folder / network | Search | Rich MD (wikilinks/backlinks/math/callouts) | Auth/multi-user | Storage |
|---|---|---|---|---|---|---|---|
| **MDViewer (this app)** | Server, 1 container | ✅ | ✅ **local + SMB** | ✅ lunr | ⚠️ code+mermaid+TOC only | ❌ | Flat files |
| MkDocs / Docusaurus | Static build | ❌ | ⚠️ per-project | ✅ | ⚠️ via plugins | via host | Flat files |
| Docsify | Client SSG | ✅ (runtime) | ⚠️ single site | ✅ | ⚠️ plugins | ❌ | Flat files |
| Quartz | Static build | ❌ | ⚠️ vault | ✅ | ✅ | via host | Flat files |
| Obsidian (+Publish) | Desktop / paid host | ✅ | ⚠️ vault | ✅ | ✅ | n/a | Flat files |
| Perlite | PHP web viewer | ✅ | ⚠️ single vault, local | ✅ | ✅ (Obsidian-flavoured) | ❌ | Flat files |
| MarkdownManager | PHP web viewer+editor | ✅ | ⚠️ single folder, local | ✅ | ⚠️ | basic | Flat files |
| Wiki.js / Outline | Server + DB | ✅ | ❌ (owns storage) | ✅ | ✅ | ✅ | Database |
| HedgeDoc / HackMD | Server + DB | ✅ | ❌ | ✅ | ✅ | ✅ | Database |

**Takeaways**
- Nobody in the "lightweight live web viewer" tier does **multiple locations +
  network shares** as a first-class feature. Own that.
- The rich-markdown + backlinks experience is now table stakes for anyone coming
  from Obsidian/Quartz. This is our biggest _perceived_ gap.
- We are one of the few in our tier with **built-in server-side full-text search** —
  a strength to sharpen, not just maintain.

---

## 3. Feature review (verified against the code)

### Strengths today
- Multi-location model (`local` + `smb`) with add/remove/test UI (`routes/locations.js`,
  `services/smbManager.js`).
- Recursive `.md` scan, lazy per-directory tree listing, dirs-first sort
  (`services/fileScanner.js`).
- Client rendering: **marked + highlight.js + mermaid**, copy-code buttons, TOC,
  breadcrumbs (`client/index.html`).
- Server-side **full-text search** via lunr with title/name boosting, persisted
  index (`services/searchIndex.js`).
- Path-traversal guard on local reads; SMB reads sandboxed to the share.
- Material 3 responsive UI, light/dark themes.
- Ships as one Docker image with a CI release pipeline to GHCR.

### Gaps & limitations (each tied to a concrete finding)
| Area | Current state | Why it matters |
|---|---|---|
| **Live updates** | `chokidar` is a dependency but **never used**; index only rebuilds on startup or a manual Scan button (`routes/locations.js`). | Edits on disk/NAS don't appear until a manual rescan. Competitors are live. |
| **Rich markdown** | No wikilinks/backlinks, no KaTeX/LaTeX math, no callouts/admonitions, no footnotes, no frontmatter display, task lists not interactive. | The #1 expectation gap vs Obsidian/Quartz users. |
| **Navigation** | SPA with a catch-all route but **no client routing**; relative `.md` links and images from the file's folder aren't resolved; refresh loses the open file. | No shareable deep links; broken intra-doc navigation. |
| **Search UX** | Results list only — no match highlighting, no snippet-in-context, no per-location filter, no fuzzy. lunr rebuilds the **whole** index every scan. | Feels thin next to the built-in search of rivals; slow/costly at scale. |
| **Auth** | None. Anyone who reaches the port sees everything. | Blocks safe exposure beyond LAN; common self-host requirement. |
| **Offline / privacy** | marked, hljs, mermaid **and fonts load from CDNs**. | Breaks in airgapped/homelab setups; leaks referer; CSP-hostile. |
| **SMB performance** | Every listing shells out to `smbclient`; indexing **downloads every file to /tmp** each rebuild (`smbManager.readFile`). | N+1 latency; heavy on large shares; no caching/mtime skipping. |
| **Formats** | `.md` only. | No `.markdown/.mdx/.txt`, no local images/PDF/CSV preview. |
| **Delivery** | No gzip/brotli compression, no cache headers, index served fresh each time. | Larger payloads, slower first paint. |
| **Reading extras** | No word count / reading time, no print/PDF export, no copy-permalink, no recents/favorites. | Low-effort polish rivals include. |

---

## 4. Enhancement roadmap

Priorities: **P0** = high value / low effort (do first), **P1** = strategic,
**P2** = larger bets. Effort: **S** (<½ day), **M** (1–3 days), **L** (>3 days).

### Phase 0 — Quick wins that close obvious gaps ✅ _shipped 2026-07-22_
- ✅ **Live file watching.** `chokidar` now watches local locations
  (`services/watcher.js`), debounces, rebuilds the index, and pushes SSE events
  (`GET /api/events`) so the open document refreshes live. Adding a location also
  indexes it immediately. (SMB still uses manual/periodic scan.)
- ✅ **Response compression + cache headers.** `compression` middleware added;
  app shell served `no-cache` so updates are picked up (`server/index.js`).
- ✅ **Deep links + client routing.** `locationId`+`path` encoded in the URL hash
  (History API) — files are shareable and survive refresh; added a "copy link" button.
- ✅ **Auto theme.** Honours `prefers-color-scheme` on first load; explicit toggles
  still persist.
- ✅ **Search highlighting + context snippets + per-location filter.** Server returns
  match-centered snippets and accepts a `locationId` filter; results highlight query
  terms, matches are highlighted + scrolled-to in the opened document.
- ✅ **Boot-load persisted index.** `loadIndex()` is now called on startup so search
  works immediately, before the background rebuild (was optimisation item §5.6).

### Phase 1 — Rich markdown (the headline gap)
- 🔶 **Frontmatter + math + GFM callouts + footnotes.**
  - ✅ **Frontmatter** — YAML parsed into a meta card (title/description/tags/date/author);
    server also prefers the frontmatter `title` and strips it from excerpts.
  - ✅ **Math** — **KaTeX** via a self-contained marked extension for `$…$`/`$$…$$`
    (code-span/fence safe, currency-tolerant).
  - ✅ **Callouts** — `> [!NOTE|TIP|WARNING|…]` blockquotes styled as callouts.
  - ⬜ **Footnotes** — still TODO (next slice, with wikilinks).
- **P1 · M — Wikilinks + relative links + local images.** Resolve `[[Note]]` and
  relative `./doc.md` links to in-app navigation; serve images referenced relative
  to the current file through a guarded `/api/files/raw` endpoint.
- **P1 · L — Backlinks + optional graph.** Build a link graph during indexing;
  show a "Linked mentions" panel and (stretch) a lightweight graph view. This is
  the feature that makes Obsidian/Quartz refugees feel at home.
- **P1 · M — More formats.** `.markdown/.mdx/.txt` + inline preview of images/PDF/CSV
  living alongside docs.

### Phase 2 — Platform & scale
- **P2 · M — Authentication.** Optional single-password or reverse-proxy header
  auth to start; pluggable OIDC later. Gate the API and static app.
- **P2 · M — Vendored assets / offline mode.** Bundle marked/hljs/mermaid/KaTeX and
  self-host fonts so the app works airgapped and ships a strict CSP.
- **P2 · L — Incremental indexing at scale.** Replace full-rebuild lunr with
  per-file mtime tracking and a persistent store; consider SQLite FTS5 for large
  corpora (still single-file, no server) to fix both search quality and scan cost.
- **P2 · S — Reading extras & export.** Word count / reading time, print stylesheet,
  "Export to PDF/HTML", recents & favorites.
- **P2 · M — Light editing (optional, niche-defining decision).** A guarded
  save-back path would move us from "viewer" to "viewer+editor" like MarkdownManager
  — decide deliberately, since read-only is also a positioning choice.

---

## 5. Optimisation plan (performance, reliability, security)

Concrete, code-anchored changes independent of new features:

1. **Indexing cost (biggest win).** Today `buildIndex()` re-scans and re-reads
   **every file** on each Scan and serialises the entire lunr index to JSON.
   → Track `mtime`/size per file; skip unchanged; update the index incrementally;
   debounce watcher events. For large SMB shares, cache file bytes keyed by
   `path+mtime` to avoid repeated `/tmp` downloads.
2. **SMB efficiency.** `listDirectory` and `readFile` fork `smbclient` per call.
   → Add a short-TTL directory-listing cache and reuse connections where possible;
   consider a native SMB client to drop process-spawn overhead.
3. **Transport.** Enable `compression`; set long cache headers on the (soon
   vendored) static assets; add `ETag`/`Last-Modified` on `/api/files/content`.
4. **Security hardening.** Add optional auth; ship a CSP (needs vendored assets);
   set security headers (helmet); rate-limit search; treat SMB creds as secrets
   (they currently sit in `data/locations.json` in plaintext — document/encrypt).
5. **Resilience.** Bound recursive scans (depth/count limits), stream large files
   instead of buffering, and surface scan/index progress + errors in the UI
   (currently swallowed with `catch {}`).
6. **Startup.** `loadIndex()` exists but `index.js` never calls it — load the
   persisted index on boot before the first full rebuild to serve search immediately.

---

## 6. Recommended sequence

1. **Ship Phase 0** (a weekend's work) — it removes the most jarring gaps
   (staleness, no deep links, thin search) at low risk.
2. **Then Phase 1 rich-markdown**, leading with wikilinks/backlinks + math/callouts —
   this is the marketing story that differentiates us from other lightweight viewers.
3. **Fold in the optimisation items** (esp. incremental indexing + `loadIndex()` on
   boot) alongside Phase 1, since they touch the same indexing code.
4. **Phase 2 platform work** (auth, offline/CSP, SQLite FTS) once the feature story
   lands — these unlock safe exposure and scale.

**Keep the wedge sharp:** whatever we add, "multi-location + SMB, zero-config, one
container, instantly live" stays the one-line pitch.

---

### Sources
Market grounding: MkDocs; awesome-selfhosted note-taking/editors; XDA "self-hosted
markdown editors"; InfoWorld "Popular Markdown documentation tools compared";
Quartz / Obsidian Publish alternatives (ssp.sh, unmarkdown.com); Perlite;
MarkdownManager (github.com/Henkster72/MarkdownManager); Markdown Reader (md-reader).
