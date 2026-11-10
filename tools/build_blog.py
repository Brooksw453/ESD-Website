#!/usr/bin/env python3
"""
build_blog.py: render the ES Designs Build Log as SPA pages.

Reads  : content/blog/*.md  (front matter + Markdown)
         templates/index.html, templates/post.html  (fragment templates)
Writes : pages/blog/index.html     (the /blog/ fragment)
         pages/blog/<slug>.html    (one fragment per post)
         js/blog-routes.js         (route list + title/description per page)

Since November 2026 the Build Log lives inside the site shell like every
other page, so the music player, the contact box and the fade-ins carry
over and a playing song keeps playing. js/app.js registers the routes from
js/blog-routes.js; tools-seo/build.py reads the same file, prerenders
blog/index.html and blog/<slug>/index.html with the full shell, and owns
sitemap.xml. After adding or editing a post, run both:

    python tools/build_blog.py
    python tools-seo/build.py

Stdlib only (Python 3.9+). No pip install.
"""

import json
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import markdown_lite  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
CONTENT = ROOT / "content" / "blog"
TEMPLATES = ROOT / "templates"
FRAG_OUT = ROOT / "pages" / "blog"
ROUTES_JS = ROOT / "js" / "blog-routes.js"

SITE = "https://esdesigns.org"
DEFAULT_AUTHOR = "Brooks Winchell"
DEFAULT_OG_IMAGE = "assets/images/brand/esd-logo.png"
SLUG_RE = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")
DATE_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")

INDEX_TITLE = "Build Log | ES Designs"
INDEX_DESCRIPTION = (
    "Notes from the ES Designs studio on building Thrustline for Meta Quest, "
    "plus earlier writing on accessibility and AI in higher education."
)

# Default in-article CTA. Appended to every post unless front matter sets
# `cta: false`, used for newsletter-style posts ("The Learning Curve")
# that must honor the v7 1-in-5 / no-pitch rule.
CTA_HTML = (
    '        <aside class="blog-cta" aria-labelledby="blog-cta-title" data-animate="fade-up">\n'
    '            <h2 id="blog-cta-title">Build your Title II plan for free</h2>\n'
    "            <p>The Compliance Roadmap Tool walks you through a complete "
    "Title II plan in about 30 minutes: institution profile, current state, "
    "priority framework, budget worksheet, timeline, and governance. Free to "
    "use, no credit card.</p>\n"
    '            <a class="blog-btn" href="/education/roadmap-tool/">Open the '
    "Compliance Roadmap Tool &rarr;</a>\n"
    "        </aside>"
)

# ---------------------------------------------------------------------------
# Newsletter box: "studio" (a link to the Thrustline launch list) or "none"
# (templates/_newsletter.html). The old form/embed providers (unified,
# convertkit, beehiiv) were retired with the standalone blog: a <script> in
# an SPA fragment does not run when the router swaps pages, so a form would
# need its handler in js/router.js bindPageEvents() first.
# ---------------------------------------------------------------------------
NEWSLETTER_PROVIDER = "studio"

_TOKEN = re.compile(r"\{\{(\w+)\}\}")


def fill(template, mapping):
    """Replace {{KEY}} from mapping. Unknown tokens are left intact so a
    template can be filled in stages."""
    return _TOKEN.sub(
        lambda m: mapping[m.group(1)] if m.group(1) in mapping else m.group(0),
        template,
    )


def attr(text):
    """Escape for an HTML attribute / text value."""
    return (
        text.replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
        .replace('"', "&quot;")
    )


def read(path):
    return path.read_text(encoding="utf-8")


def write(path, content):
    """Write only when the content changed, so untouched pages keep their
    mtime (tools-seo/build.py stamps sitemap <lastmod> from mtimes)."""
    path.parent.mkdir(parents=True, exist_ok=True)
    if path.exists() and read(path) == content:
        return False
    path.write_text(content, encoding="utf-8", newline="\n")
    return True


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
    if NEWSLETTER_PROVIDER == "studio":
        # Build Log (Oct 2026): The Learning Curve is paused. The box points to
        # the Thrustline launch list (Supabase messages, source thrustline-launch),
        # which becomes the XR newsletter on Beehiiv later.
        return (
            '        <section class="blog-newsletter" aria-labelledby="nl-t" data-animate="fade-up">\n'
            '            <h2 id="nl-t">Get the build log by email</h2>\n'
            '            <p>One email when Thrustline launches on Meta Quest, plus occasional build notes from the studio. Unsubscribe anytime.</p>\n'
            '            <a class="blog-btn" href="/thrustline/">Join the launch list &rarr;</a>\n'
            "        </section>"
        )
    if NEWSLETTER_PROVIDER == "none":
        return read(TEMPLATES / "_newsletter.html").rstrip("\n")
    fail("NEWSLETTER_PROVIDER %r is not supported in the SPA Build Log" % NEWSLETTER_PROVIDER)


def jsonld_block(data):
    """JSON-LD for crawlers. It sits inside the fragment, so the prerendered
    page carries it; the router's innerHTML swap never executes it."""
    text = json.dumps(data, indent=2, ensure_ascii=False).replace("</", "<\\/")
    return '    <script type="application/ld+json">\n%s\n    </script>' % text


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
                    {"@type": "ListItem", "position": 2, "name": "Build Log",
                     "item": SITE + "/blog/"},
                    {"@type": "ListItem", "position": 3, "name": title,
                     "item": canonical},
                ],
            },
        ],
    }

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

    show_cta = str(meta.get("cta", "true")).strip().lower() != "false"

    page = fill(
        read(TEMPLATES / "post.html"),
        {
            "TITLE": attr(title),
            "BYLINE": byline,
            "BODY": body_html,
            "CTA": CTA_HTML if show_cta else "",
            "NEWSLETTER": newsletter_html(),
            "JSONLD": jsonld_block(jsonld),
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
            "            <li class=\"blog-card\" data-animate=\"fade-up\">\n"
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
                "name": "ES Designs Build Log",
                "description": INDEX_DESCRIPTION,
                "url": SITE + "/blog/",
                "publisher": org_node(),
            },
            {
                "@type": "BreadcrumbList",
                "itemListElement": [
                    {"@type": "ListItem", "position": 1, "name": "Home",
                     "item": SITE + "/"},
                    {"@type": "ListItem", "position": 2, "name": "Build Log",
                     "item": SITE + "/blog/"},
                ],
            },
        ],
    }

    return fill(
        read(TEMPLATES / "index.html"),
        {
            "POST_CARDS": "\n".join(cards),
            "NEWSLETTER": newsletter_html(),
            "JSONLD": jsonld_block(jsonld),
        },
    )


def routes_js(posts):
    """js/blog-routes.js: one entry per Build Log page. app.js registers
    them with the router; tools-seo/build.py prerenders them."""
    routes = [{
        "path": "/blog",
        "fragment": "pages/blog/index.html",
        "title": INDEX_TITLE,
        "description": INDEX_DESCRIPTION,
    }]
    for p in posts:
        routes.append({
            "path": "/blog/" + p["slug"],
            "fragment": "pages/blog/%s.html" % p["slug"],
            "title": "%s | ES Designs Build Log" % p["title"],
            "description": p["description"],
            "type": "article",
            "published": p["date"],
            "modified": p["updated"],
        })
    return (
        "/* Build Log routes. GENERATED by tools/build_blog.py from content/blog/:\n"
        "   do not edit by hand. Loaded before js/app.js, which registers each\n"
        "   path with the router; tools-seo/build.py prerenders the same list. */\n"
        "window.ESD_BLOG_ROUTES = "
        + json.dumps(routes, indent=2, ensure_ascii=False)
        + ";\n"
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
        changed = write(FRAG_OUT / ("%s.html" % p["slug"]), p["html"])
        print("post : pages/blog/%s.html%s" % (p["slug"], "" if changed else " (unchanged)"))

    write(FRAG_OUT / "index.html", build_index(posts))
    print("index: pages/blog/index.html (%d post%s)" % (len(posts), "" if len(posts) == 1 else "s"))

    # A post that was deleted or set back to draft leaves a stale fragment.
    keep = {"index.html"} | {"%s.html" % p["slug"] for p in posts}
    for old in FRAG_OUT.glob("*.html"):
        if old.name not in keep:
            old.unlink()
            print("removed stale fragment: pages/blog/%s (also delete blog/%s/)"
                  % (old.name, old.stem))

    write(ROUTES_JS, routes_js(posts))
    print("routes: js/blog-routes.js (%d routes)" % (len(posts) + 1))

    leftover = set()
    for p in posts:
        leftover |= set(_TOKEN.findall(p["html"]))
    if leftover:
        print("WARN: unresolved template tokens: %s" % ", ".join(sorted(leftover)))

    print("\nDone. %d post(s) built. Now run: python tools-seo/build.py" % len(posts))


if __name__ == "__main__":
    main()
