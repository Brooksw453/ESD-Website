#!/usr/bin/env python3
"""
build_blog.py — render the ES Designs static blog.

Reads  : content/blog/*.md  (front matter + Markdown)
         templates/*.html
Writes : blog/index.html
         blog/<slug>/index.html
         sitemap.xml           (FULL regeneration — see STATIC_ROUTES)
         robots.txt

Run from anywhere:  python tools/build_blog.py
Nothing runs on GitHub Pages; only the committed static HTML is served.
Stdlib only (Python 3.9+). No pip install.
"""

import json
import re
import sys
from datetime import date
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import markdown_lite  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
CONTENT = ROOT / "content" / "blog"
TEMPLATES = ROOT / "templates"
BLOG_OUT = ROOT / "blog"

SITE = "https://esdesigns.org"
DEFAULT_AUTHOR = "Brooks Winchell"
DEFAULT_OG_IMAGE = "assets/images/brand/esd-logo.png"
SLUG_RE = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")
DATE_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")

# ---------------------------------------------------------------------------
# Newsletter provider: "none" (placeholder), "convertkit", or "beehiiv".
# Switching providers is a one-line change here + a rebuild. When set to a
# provider, fill in the embed id/uid marked TODO in _newsletter_embed().
# ---------------------------------------------------------------------------
NEWSLETTER_PROVIDER = "none"

# ---- Content Security Policy (blog pages only; independent of the SPA) -----
CSP_BASE = (
    "default-src 'self'; "
    "script-src 'self' https://www.googletagmanager.com; "
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; "
    "font-src https://fonts.gstatic.com; "
    "img-src 'self' data: https://www.google-analytics.com "
    "https://*.google-analytics.com https://*.googletagmanager.com; "
    "connect-src 'self' https://awcmkderlpyxpkmrnvwi.supabase.co "
    "https://www.google-analytics.com https://*.google-analytics.com "
    "https://*.analytics.google.com https://*.googletagmanager.com; "
    "frame-src 'none'; base-uri 'self'"
)
CSP_CONVERTKIT = (
    "default-src 'self'; "
    "script-src 'self' https://www.googletagmanager.com https://f.convertkit.com https://*.kit.com; "
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://*.kit.com; "
    "font-src https://fonts.gstatic.com; "
    "img-src 'self' data: https://www.google-analytics.com "
    "https://*.google-analytics.com https://*.googletagmanager.com https://*.kit.com; "
    "connect-src 'self' https://app.kit.com https://api.convertkit.com "
    "https://awcmkderlpyxpkmrnvwi.supabase.co https://www.google-analytics.com "
    "https://*.google-analytics.com https://*.analytics.google.com "
    "https://*.googletagmanager.com; "
    "frame-src https://*.kit.com https://*.convertkit.com; base-uri 'self'"
)
CSP_BEEHIIV = (
    "default-src 'self'; "
    "script-src 'self' https://www.googletagmanager.com https://subscribe-forms.beehiiv.com; "
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; "
    "font-src https://fonts.gstatic.com; "
    "img-src 'self' data: https://www.google-analytics.com "
    "https://*.google-analytics.com https://*.googletagmanager.com; "
    "connect-src 'self' https://subscribe-forms.beehiiv.com "
    "https://awcmkderlpyxpkmrnvwi.supabase.co https://www.google-analytics.com "
    "https://*.google-analytics.com https://*.analytics.google.com "
    "https://*.googletagmanager.com; "
    "frame-src https://subscribe-forms.beehiiv.com https://embeds.beehiiv.com; "
    "base-uri 'self'"
)
CSP = {"none": CSP_BASE, "convertkit": CSP_CONVERTKIT, "beehiiv": CSP_BEEHIIV}[
    NEWSLETTER_PROVIDER
]

# ---- Sitemap: hand-maintained SPA routes (hash URLs) ----------------------
# FULL regeneration. Update this table if SPA routes change. <lastmod> is
# carried forward from the existing sitemap.xml when present (so a rebuild
# does not falsely bump freshness on unrelated routes).
STATIC_ROUTES = [
    ("https://esdesigns.org/", "monthly", "1.0", "2026-04-05"),
    ("https://esdesigns.org/#/elliptical", "monthly", "0.9", "2026-04-05"),
    ("https://esdesigns.org/#/education", "monthly", "0.9", "2026-04-05"),
    ("https://esdesigns.org/#/education/courses", "monthly", "0.8", "2026-04-05"),
    ("https://esdesigns.org/#/education/demos", "monthly", "0.7", "2026-04-05"),
    ("https://esdesigns.org/#/education/ally-pro", "monthly", "0.9", "2026-04-16"),
    ("https://esdesigns.org/#/education/audit", "monthly", "0.8", "2026-04-16"),
    ("https://esdesigns.org/#/education/wcag-course", "monthly", "0.8", "2026-04-16"),
    ("https://esdesigns.org/#/education/roadmap-tool", "monthly", "0.95", "2026-05-09"),
    ("https://esdesigns.org/#/about", "monthly", "0.6", "2026-04-05"),
    ("https://esdesigns.org/#/privacy", "yearly", "0.3", "2026-04-05"),
]

_TOKEN = re.compile(r"\{\{(\w+)\}\}")


def fill(template, mapping):
    """Replace {{KEY}} from mapping. Unknown tokens are left intact so a
    template can be filled in stages."""
    return _TOKEN.sub(
        lambda m: mapping[m.group(1)] if m.group(1) in mapping else m.group(0),
        template,
    )


def attr(text):
    """Escape for an HTML attribute / meta content value."""
    return (
        text.replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
        .replace('"', "&quot;")
    )


def read(path):
    return path.read_text(encoding="utf-8")


def write(path, content):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content, encoding="utf-8", newline="\n")


def fail(msg):
    print("ERROR: " + msg, file=sys.stderr)
    sys.exit(1)


def parse_front_matter(raw, source):
    if not raw.startswith("---"):
        fail("%s: missing '---' front matter block" % source)
    end = raw.find("\n---", 3)
    if end == -1:
        fail("%s: unterminated front matter" % source)
    fm_block = raw[3:end].strip("\n")
    body = raw[end + 4 :].lstrip("\n")
    meta = {}
    for line in fm_block.split("\n"):
        if not line.strip() or line.strip().startswith("#"):
            continue
        if ":" not in line:
            fail("%s: bad front matter line: %r" % (source, line))
        key, _, val = line.partition(":")
        val = val.strip()
        if len(val) >= 2 and val[0] in "\"'" and val[-1] == val[0]:
            val = val[1:-1]
        meta[key.strip()] = val
    return meta, body


def human_date(iso):
    y, m, d = (int(x) for x in iso.split("-"))
    months = [
        "January", "February", "March", "April", "May", "June",
        "July", "August", "September", "October", "November", "December",
    ]
    return "%s %d, %d" % (months[m - 1], d, y)


def first_paragraph(body):
    for block in re.split(r"\n\s*\n", body.strip()):
        b = block.strip()
        if not b or b.startswith(("#", ">", "```", "-", "*", "|")):
            continue
        text = re.sub(r"[*`_]", "", b.replace("\n", " "))
        text = re.sub(r"\[([^\]]+)\]\([^)]+\)", r"\1", text)
        return text.strip()
    return ""


def newsletter_html():
    if NEWSLETTER_PROVIDER == "none":
        return read(TEMPLATES / "_newsletter.html").rstrip("\n")
    # TODO when switching providers: paste the official embed snippet and set
    # the form id/uid below. CSP for the chosen provider is already wired.
    if NEWSLETTER_PROVIDER == "convertkit":
        return (
            '        <section class="blog-newsletter" aria-labelledby="nl-t">\n'
            '            <h2 id="nl-t">The Planning Window</h2>\n'
            '            <p>One inside observation, one practical tip, one useful link. Bi-weekly. No pitch.</p>\n'
            '            <div class="blog-newsletter-embed">\n'
            '                <!-- TODO: paste ConvertKit/Kit embed; set data-uid -->\n'
            '                <script async data-uid="REPLACE_ME" src="https://f.convertkit.com/REPLACE_ME/REPLACE_ME.js"></script>\n'
            "            </div>\n"
            "        </section>"
        )
    return (
        '        <section class="blog-newsletter" aria-labelledby="nl-t">\n'
        '            <h2 id="nl-t">The Planning Window</h2>\n'
        '            <p>One inside observation, one practical tip, one useful link. Bi-weekly. No pitch.</p>\n'
        '            <div class="blog-newsletter-embed">\n'
        '                <!-- TODO: paste Beehiiv embed iframe; set the form src -->\n'
        '                <iframe src="https://subscribe-forms.beehiiv.com/REPLACE_ME" title="Subscribe to The Planning Window" style="width:100%;height:320px;border:0;"></iframe>\n'
        "            </div>\n"
        "        </section>"
    )


def build_head(*, page_title, og_title, description, canonical, og_type,
                og_image, extra_meta, jsonld):
    tpl = read(TEMPLATES / "_head.html")
    return fill(
        tpl,
        {
            "PAGE_TITLE": attr(page_title),
            "DESCRIPTION": attr(description),
            "CANONICAL": canonical,
            "CSP": CSP,
            "OG_TYPE": og_type,
            "OG_TITLE": attr(og_title),
            "OG_DESCRIPTION": attr(description),
            "OG_URL": canonical,
            "OG_IMAGE": SITE + "/" + og_image.lstrip("/"),
            "EXTRA_META": extra_meta,
            "JSONLD": json.dumps(jsonld, indent=2, ensure_ascii=False),
        },
    )


def org_node():
    return {
        "@type": "Organization",
        "@id": SITE + "/#organization",
        "name": "ES Designs",
        "logo": {
            "@type": "ImageObject",
            "url": SITE + "/assets/images/brand/esd-logo.png",
        },
    }


def render_post(meta, body, source):
    title = meta.get("title", "").strip()
    slug = meta.get("slug", "").strip()
    desc = meta.get("description", "").strip()
    pub = meta.get("date", "").strip()
    if not (title and slug and desc and pub):
        fail("%s: title, slug, description and date are all required" % source)
    if not SLUG_RE.match(slug):
        fail("%s: slug %r must be lowercase a-z 0-9 and hyphens" % (source, slug))
    if not DATE_RE.match(pub):
        fail("%s: date %r must be YYYY-MM-DD" % (source, pub))
    updated = meta.get("updated", "").strip() or pub
    if not DATE_RE.match(updated):
        fail("%s: updated %r must be YYYY-MM-DD" % (source, updated))
    author = meta.get("author", "").strip() or DEFAULT_AUTHOR
    og_image = meta.get("ogImage", "").strip() or DEFAULT_OG_IMAGE
    if len(desc) > 160:
        print("WARN: %s: description is %d chars (>160)" % (source, len(desc)))

    canonical = "%s/blog/%s/" % (SITE, slug)
    body_html = markdown_lite.convert(body)

    extra_meta = "\n".join(
        [
            '    <meta property="article:published_time" content="%s">' % pub,
            '    <meta property="article:modified_time" content="%s">' % updated,
            '    <meta property="article:author" content="%s">' % attr(author),
        ]
    )

    jsonld = {
        "@context": "https://schema.org",
        "@graph": [
            {
                "@type": "BlogPosting",
                "@id": canonical + "#article",
                "headline": title,
                "description": desc,
                "datePublished": pub,
                "dateModified": updated,
                "url": canonical,
                "mainEntityOfPage": {"@type": "WebPage", "@id": canonical},
                "image": SITE + "/" + og_image.lstrip("/"),
                "author": {
                    "@type": "Person",
                    "name": author,
                    "description": "21 years inside higher education, "
                    "including a long run at Quinsigamond Community College.",
                    "sameAs": "https://www.linkedin.com/in/brooks-winchell-42900185/",
                },
                "publisher": org_node(),
            },
            {
                "@type": "BreadcrumbList",
                "itemListElement": [
                    {"@type": "ListItem", "position": 1, "name": "Home",
                     "item": SITE + "/"},
                    {"@type": "ListItem", "position": 2, "name": "Blog",
                     "item": SITE + "/blog/"},
                    {"@type": "ListItem", "position": 3, "name": title,
                     "item": canonical},
                ],
            },
        ],
    }

    head = build_head(
        page_title="%s | ES Designs Blog" % title,
        og_title=title,
        description=desc,
        canonical=canonical,
        og_type="article",
        og_image=og_image,
        extra_meta=extra_meta,
        jsonld=jsonld,
    )

    byline = (
        'By <strong>%s</strong> &middot; <time datetime="%s">%s</time>'
        % (attr(author), pub, human_date(pub))
    )
    if updated != pub:
        byline += ' &middot; Updated <time datetime="%s">%s</time>' % (
            updated,
            human_date(updated),
        )
    byline += (
        "<br><span>21 years inside higher education, including a long run "
        "at Quinsigamond Community College.</span>"
    )

    page = fill(
        read(TEMPLATES / "post.html"),
        {
            "HEAD": head,
            "HEADER": read(TEMPLATES / "_header.html").rstrip("\n"),
            "TITLE": attr(title),
            "BYLINE": byline,
            "BODY": body_html,
            "NEWSLETTER": newsletter_html(),
            "FOOTER": read(TEMPLATES / "_footer.html").rstrip("\n"),
        },
    )
    return {
        "slug": slug,
        "title": title,
        "description": desc,
        "date": pub,
        "updated": updated,
        "excerpt": (meta.get("excerpt", "").strip() or first_paragraph(body)),
        "html": page,
    }


def build_index(posts):
    cards = []
    for p in posts:
        cards.append(
            "            <li class=\"blog-card\">\n"
            "                <h2><a href=\"/blog/%s/\">%s</a></h2>\n"
            "                <p class=\"blog-card-date\"><time datetime=\"%s\">%s</time></p>\n"
            "                <p class=\"blog-card-excerpt\">%s</p>\n"
            "                <a class=\"blog-card-more\" href=\"/blog/%s/\">Read more &rarr;</a>\n"
            "            </li>"
            % (
                p["slug"],
                attr(p["title"]),
                p["date"],
                human_date(p["date"]),
                attr(p["excerpt"]),
                p["slug"],
            )
        )

    jsonld = {
        "@context": "https://schema.org",
        "@graph": [
            {
                "@type": "Blog",
                "@id": SITE + "/blog/#blog",
                "name": "ES Designs Blog",
                "description": "Practical notes on Title II compliance "
                "planning for higher education.",
                "url": SITE + "/blog/",
                "publisher": org_node(),
            },
            {
                "@type": "BreadcrumbList",
                "itemListElement": [
                    {"@type": "ListItem", "position": 1, "name": "Home",
                     "item": SITE + "/"},
                    {"@type": "ListItem", "position": 2, "name": "Blog",
                     "item": SITE + "/blog/"},
                ],
            },
        ],
    }

    head = build_head(
        page_title="ES Designs Blog | Title II Compliance Planning for Higher Ed",
        og_title="ES Designs Blog",
        description="Practical notes on ADA Title II compliance planning, "
        "WCAG 2.2, and document accessibility for higher education.",
        canonical=SITE + "/blog/",
        og_type="website",
        og_image=DEFAULT_OG_IMAGE,
        extra_meta="",
        jsonld=jsonld,
    )

    return fill(
        read(TEMPLATES / "index.html"),
        {
            "HEAD": head,
            "HEADER": read(TEMPLATES / "_header.html").rstrip("\n"),
            "POST_CARDS": "\n".join(cards),
            "NEWSLETTER": newsletter_html(),
            "FOOTER": read(TEMPLATES / "_footer.html").rstrip("\n"),
        },
    )


def existing_lastmods():
    sm = ROOT / "sitemap.xml"
    if not sm.exists():
        return {}
    text = sm.read_text(encoding="utf-8")
    out = {}
    for block in re.findall(r"<url>(.*?)</url>", text, re.S):
        loc = re.search(r"<loc>(.*?)</loc>", block)
        mod = re.search(r"<lastmod>(.*?)</lastmod>", block)
        if loc and mod:
            out[loc.group(1).strip()] = mod.group(1).strip()
    return out


def build_sitemap(posts):
    prior = existing_lastmods()
    rows = []

    def url(loc, lastmod, freq, prio):
        rows.append(
            "  <url>\n"
            "    <loc>%s</loc>\n"
            "    <lastmod>%s</lastmod>\n"
            "    <changefreq>%s</changefreq>\n"
            "    <priority>%s</priority>\n"
            "  </url>" % (loc, lastmod, freq, prio)
        )

    for loc, freq, prio, fallback in STATIC_ROUTES:
        url(loc, prior.get(loc, fallback), freq, prio)

    if posts:
        blog_mod = max(p["updated"] for p in posts)
    else:
        blog_mod = prior.get(SITE + "/blog/", date.today().isoformat())
    url(SITE + "/blog/", blog_mod, "weekly", "0.7")
    for p in posts:
        url("%s/blog/%s/" % (SITE, p["slug"]), p["updated"], "monthly", "0.6")

    return (
        '<?xml version="1.0" encoding="UTF-8"?>\n'
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
        + "\n".join(rows)
        + "\n</urlset>\n"
    )


def main():
    if not CONTENT.exists():
        fail("content/blog/ not found")

    posts = []
    seen = set()
    for md in sorted(CONTENT.glob("*.md")):
        meta, body = parse_front_matter(read(md), md.name)
        if str(meta.get("draft", "false")).lower() == "true":
            print("skip (draft): %s" % md.name)
            continue
        post = render_post(meta, body, md.name)
        if post["slug"] in seen:
            fail("duplicate slug: %s" % post["slug"])
        seen.add(post["slug"])
        posts.append(post)

    posts.sort(key=lambda p: (p["date"], p["slug"]), reverse=True)

    for p in posts:
        write(BLOG_OUT / p["slug"] / "index.html", p["html"])
        print("post : blog/%s/index.html" % p["slug"])

    write(BLOG_OUT / "index.html", build_index(posts))
    print("index: blog/index.html (%d post%s)" % (len(posts), "" if len(posts) == 1 else "s"))

    write(ROOT / "sitemap.xml", build_sitemap(posts))
    print("sitemap: sitemap.xml (%d SPA + %d blog)" % (len(STATIC_ROUTES), len(posts) + 1))

    write(
        ROOT / "robots.txt",
        "User-agent: *\nAllow: /\n\nSitemap: %s/sitemap.xml\n" % SITE,
    )
    print("robots: robots.txt")

    leftover = set()
    for p in posts:
        leftover |= set(_TOKEN.findall(p["html"]))
    if leftover:
        print("WARN: unresolved template tokens: %s" % ", ".join(sorted(leftover)))

    print("\nDone. Provider=%s. %d post(s) built." % (NEWSLETTER_PROVIDER, len(posts)))


if __name__ == "__main__":
    main()
