# ES Designs Blog — build & publish runbook

The blog is **pre-rendered static HTML** served by GitHub Pages at clean,
crawlable URLs (`https://esdesigns.org/blog/<slug>/`). It is **not** part of
the hash-SPA — blog pages do not load the router, music player, or particles.
Nothing runs on GitHub Pages; only the committed HTML is served.

## TL;DR — publish a post

1. Write `content/blog/<slug>.md` (front matter + Markdown, see below).
2. From the repo root: `python tools/build_blog.py`
3. Preview locally: `python -m http.server 8000`, open `http://localhost:8000/blog/`
4. Commit **all** of: the `.md`, regenerated `blog/**`, `sitemap.xml`,
   `robots.txt`, and any template/tooling change — in one commit. Push.

The service worker does **not** need a `CACHE_NAME` bump for blog changes —
the build only writes `blog/**`, `sitemap.xml`, `robots.txt`, none of which are
in `sw.js` `CORE_ASSETS`. Do not bump it for blog-only work.

## Front matter

```
---
title: How to Build a WCAG 2.2 Compliance Plan for Higher Ed   # required
slug: wcag-2-2-compliance-plan-higher-ed                       # required, [a-z0-9-]
description: 150–160 char meta + OG description, keyword early  # required
date: 2026-05-19                                                # required, YYYY-MM-DD
updated: 2026-05-20        # optional, defaults to date
author: Brooks Winchell    # optional, defaults to Brooks Winchell
ogImage: assets/images/... # optional, defaults to brand logo
excerpt: One-line teaser shown on the blog index             # optional -> 1st paragraph
draft: false               # optional; true => excluded from output/index/sitemap
---
```

A post's soft CTA to the Compliance Roadmap Tool is added by the template
(`templates/post.html`) — **do not** add another Roadmap Tool CTA in the
Markdown. Cross-linking other posts (`/blog/<slug>/`) is encouraged.

## Supported Markdown (`tools/markdown_lite.py`)

This is a small in-house converter (stdlib only, zero `pip install`), not a
full CommonMark engine. **Design note:** the plan called for vendoring a
single-file third-party Markdown library; we instead authored a focused,
auditable converter because all blog content is produced in-house and a
constrained, tested subset is more reliable than a large copied dependency.
Keep posts within this subset:

- Headings `##`–`######` (the page `<h1>` is the template's; start body at `##`)
- Paragraphs, `**bold**`, `*italic*` / `_italic_`, `` `code` ``
- Links `[text](url)` — external `http(s)` links get `target="_blank" rel="noopener"`
- Images `![alt](url)`
- Lists (`-`/`*`/`1.`), one nested level via 2-space indent
- Blockquotes (`>`), fenced code (```` ``` ````), horizontal rule (`---`)
- GitHub pipe tables

If you need richer Markdown, extend `markdown_lite.py` and add a test case —
don't hand-write HTML in the `.md`.

## What the build writes

| Path | Notes |
| --- | --- |
| `blog/index.html` | Post listing, newest first |
| `blog/<slug>/index.html` | One folder per post (clean trailing-slash URL) |
| `sitemap.xml` | **Full regeneration.** SPA routes from `STATIC_ROUTES`; prior `<lastmod>` carried forward; `/blog/` + post entries appended |
| `robots.txt` | Static; points crawlers at the sitemap |

Generated files under `blog/` are produced by the script — never hand-edit
them; edit the `.md` or templates and rebuild.

If SPA routes change, update `STATIC_ROUTES` in `tools/build_blog.py` so the
regenerated sitemap stays correct.

## Newsletter ("The Planning Window")

`NEWSLETTER_PROVIDER` at the top of `tools/build_blog.py` is `"none"` by
default and renders a placeholder card. When the ConvertKit/Kit or Beehiiv
account exists:

1. Set `NEWSLETTER_PROVIDER = "convertkit"` (or `"beehiiv"`).
2. Paste the official embed snippet into `newsletter_html()` where marked
   `TODO`, filling the real form id/uid.
3. Rebuild. The matching CSP (already wired in `CSP_*`) is applied
   automatically — no SPA CSP change, blog pages carry their own.

Per the marketing strategy, the email is *sent* from the provider (paste the
post content there); the blog only captures subscribers.

## Slugs are permanent

GitHub Pages has no real 301s. Renaming a slug 404s the old URL (which
meta-refreshes to the home page). If a rename is unavoidable, leave the old
`blog/<old-slug>/index.html` in place with a canonical tag + meta-refresh to
the new URL.

## Follow-up recommended

The default OG image is the brand logo. A dedicated 1200×630 image
(`assets/images/brand/blog-default-og.png`) renders better in social/search
cards — add it and update `DEFAULT_OG_IMAGE` when available.
