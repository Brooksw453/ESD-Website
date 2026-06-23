# Blog Posting Guide — hand this to Claude with your content

**How to use this:** when you want to publish something, start a Claude Code
session in this repo and paste **this whole file plus your content or idea**.
Claude does the rest — writes/formats the Markdown, builds, checks it, and
deploys it live. You never run a script or touch git.

The blog lives at **https://esdesigns.org/blog/**. It is static, self-hosted,
and on the same domain as the Compliance Roadmap Tool (the funnel).

---

## 1. How often to post

Consistency beats volume. A realistic, sustainable rhythm:

| Type | Cadence | Length | Pitch? |
| --- | --- | --- | --- |
| **The Learning Curve** (newsletter) | Every other Thursday | 400–600 words | No pitch (issue 4, 8, 12… may add one soft line) |
| **SEO post** (evergreen, search-targeted) | 1–2 per month | 700–1,200 words | One soft Roadmap Tool CTA (automatic) |

You do not need to hit both every week. If a month is busy, ship the two
Learning Curve issues and skip the SEO post. Missing a beat is fine; going
quiet for two months is the thing to avoid.

---

## 2. The two kinds of post

**A. SEO post** — answers a question an ADA coordinator would Google.
Evergreen, keyword-led, ends with the automatic Roadmap Tool CTA. This is the
top-of-funnel content. Examples already live: the WCAG 2.2 plan guide, the
Title II deadline explainer, the "documents are 80%" piece.

**B. The Learning Curve issue** — your bi-weekly note. Timely, personal, and
**no pitch**. Format (from the v7 strategy):

- One inside observation (200–300 words) — something from a recent call or
  that week's work
- One practical tip (100–150 words) — a 5-minute lesson
- One useful third-party resource (50–100 words) — Inside Higher Ed, WebAIM,
  Lainey Feingold, etc. **Never an ES Designs product.**
- A short P.S. — no ask (every 4th issue may add one soft Roadmap line)
- Sign off: "— Brooks Winchell. 21 years inside higher education, including a
  long run at Quinsigamond Community College."

Learning Curve posts are set to `cta: false` so the system never pitches on
them. After it's published, Claude gives you the clean text to paste into
Beehiiv and send.

---

## 3. Brand voice (non-negotiable)

- Write from inside the role, not at it. Colleague-in-a-hallway, not vendor.
- Specific numbers and dates, not vague claims ("April 24, 2026", "80% of
  remediation", "21 years", "30 minutes").
- **Banned words:** empower, unlock, transform, leverage, synergy. If a
  sentence sounds like marketing, cut it.
- Lead with the practical problem. No throat-clearing.
- One soft CTA at most on SEO posts (handled automatically). The 1-in-5 / no
  pitch discipline is enforced by `cta: false` on newsletter posts — don't
  add product pitches into Learning Curve body copy.

---

## 4. How to brief Claude (copy-paste template)

> I want to publish a **[SEO post / Learning Curve issue]**.
>
> **Topic / angle:** …
> **Key points I want to make:** …
> **Anything specific to include** (a number, a story, a link): …
> **Target keyword** (SEO posts only): …
>
> Draft it in our brand voice per BLOG-POSTING-GUIDE.md, build, verify, and
> deploy. For a Learning Curve issue, also give me the paste-ready Beehiiv
> text and a subject line.

You can also just paste a finished draft and say "polish, format, and
publish this." Either works.

---

## 5. What Claude will do (so you can confirm it happened)

1. Create/format `content/blog/<slug>.md` with correct front matter.
2. Run `python tools/build_blog.py` (renders the page, rebuilds the index,
   updates `sitemap.xml` and `robots.txt`).
3. Verify: one canonical/title/description, valid JSON-LD, no banned words,
   accessible structure, the form embed present.
4. Commit and push to `main` → live on esdesigns.org in ~1–2 minutes.
5. For Learning Curve issues: hand you the Beehiiv-ready text + subject.

Then you: open the live URL to eyeball it, and (for newsletters) paste into
Beehiiv and send on schedule.

---

## 6. Front matter reference

```
---
title: The headline (in quotes if it contains a colon)
slug: url-safe-lowercase-hyphens          # permanent — pick carefully
description: 150–160 chars, keyword near the front
date: YYYY-MM-DD
updated: YYYY-MM-DD            # optional
author: Brooks Winchell        # optional (default)
cta: false                     # optional; set false for Learning Curve
draft: true                    # optional; true = written but not published
excerpt: One-line teaser for the blog index   # optional
---
```

- **Slugs are permanent.** Renaming one breaks the old URL. Decide once.
- `draft: true` keeps a post written-but-hidden until you say go.
- Deeper build details (Markdown syntax supported, Beehiiv provider switch,
  sitemap behavior) are in `tools/README.md`.

---

## 7. Newsletter send workflow (the "winning workflow")

1. Claude publishes the issue to the blog (permanent + SEO).
2. Claude gives you the paste-ready text + subject line.
3. You paste it into a Beehiiv post and send to your list.
4. New subscribers come in through the form embedded on every blog page.

That's the whole loop: brief → publish → send. Keep the rhythm and the list
compounds.
