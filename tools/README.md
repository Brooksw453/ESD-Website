# ES Designs Build Log: build & publish runbook

Since November 2026 the Build Log is part of the site like every other page.
Posts live at clean, crawlable URLs (`https://esdesigns.org/blog/<slug>/`),
render inside the site shell (header, footer, music player, contact box,
fade-ins), and a song that is playing keeps playing when someone clicks into
the Build Log. Nothing runs on GitHub Pages; only the committed HTML is served.

## TL;DR: publish a post

1. Write `content/blog/<slug>.md` (front matter + Markdown, see below).
2. From the repo root: `python tools/build_blog.py`
3. Then: `python tools-seo/build.py --no-sitemap` and add the new post's
   `<url>` row to `sitemap.xml` by hand (a full `build.py` run re-stamps
   every `<lastmod>` from file times). Run `git checkout robots.txt` if a
   build touched it.
4. Preview locally: `python -m http.server 8000`, open `http://localhost:8000/blog/`
5. Commit **all** of: the `.md`, `pages/blog/**`, `js/blog-routes.js`, the
   prerendered `blog/**`, `sitemap.xml`, and any template/tooling change, in
   one commit. Push.

No service worker `CACHE_NAME` bump is needed for a new post:
`js/blog-routes.js` and the `pages/blog/` fragments are fetched network-first.

## Front matter

```
---
title: How to Build a WCAG 2.2 Compliance Plan for Higher Ed   # required
slug: wcag-2-2-compliance-plan-higher-ed                       # required, [a-z0-9-]
description: 150-160 char meta + OG description, keyword early  # required
date: 2026-05-19                                                # required, YYYY-MM-DD
updated: 2026-05-20        # optional, defaults to date
author: Brooks Winchell    # optional, defaults to Brooks Winchell
ogImage: assets/images/... # optional, used in the JSON-LD (the share card uses the site's og image)
excerpt: One-line teaser shown on the Build Log index         # optional -> 1st paragraph
cta: false                 # optional; false drops the Roadmap Tool box
draft: false               # optional; true => left out of the site
---
```

A post's soft CTA to the Compliance Roadmap Tool is added by the generator
(`CTA_HTML` in `tools/build_blog.py`), so **do not** add another Roadmap Tool
CTA in the Markdown. Cross-linking other posts (`/blog/<slug>/`) is encouraged.

## Supported Markdown (`tools/markdown_lite.py`)

This is a small in-house converter (stdlib only, zero `pip install`), not a
full CommonMark engine. Keep posts within this subset:

- Headings `##` to `######` (the page `<h1>` is the template's; start body at `##`)
- Paragraphs, `**bold**`, `*italic*` / `_italic_`, `` `code` ``
- Links `[text](url)`: external `http(s)` links get `target="_blank" rel="noopener"`
- Images `![alt](url)`
- Lists (`-`/`*`/`1.`), one nested level via 2-space indent
- Blockquotes (`>`), fenced code (```` ``` ````), horizontal rule (`---`)
- GitHub pipe tables

If you need richer Markdown, extend `markdown_lite.py` and add a test case
rather than hand-writing HTML in the `.md`.

## How it fits together

| Path | Written by | Notes |
| --- | --- | --- |
| `pages/blog/index.html` | `build_blog.py` | Index fragment, newest first (`templates/index.html`) |
| `pages/blog/<slug>.html` | `build_blog.py` | One fragment per post (`templates/post.html`), with its JSON-LD |
| `js/blog-routes.js` | `build_blog.py` | Path, fragment, title, description per page. `js/app.js` registers these with the router |
| `blog/index.html`, `blog/<slug>/index.html` | `tools-seo/build.py` | The fragment inside the full site shell, for direct visits and crawlers (posts get `og:type` article) |
| `css/build-log.css` | by hand | Article styling, every rule scoped to `.blog-page` |

Generated files are never hand-edited; edit the `.md` or templates and rebuild.
`build_blog.py` deletes the fragment of a post that was removed or set back
to draft; delete its `blog/<slug>/` folder by hand too.

## Newsletter box

`NEWSLETTER_PROVIDER = "studio"` in `tools/build_blog.py` shows the "Get the
build log by email" box linking to the Thrustline launch list. `"none"` uses
`templates/_newsletter.html`. A real signup form would need its submit
handler wired in `js/router.js` `bindPageEvents()` first, because a
`<script>` inside a fragment does not run when the router swaps pages.

## Slugs are permanent

GitHub Pages has no real 301s. Renaming a slug 404s the old URL. If a rename
is unavoidable, add the old path to `this.redirects` in `js/router.js`
(build.py then writes a redirect page for it).
