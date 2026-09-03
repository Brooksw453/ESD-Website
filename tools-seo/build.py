#!/usr/bin/env python3
"""Prerender every SPA route to a real, crawlable URL.

Reads the route table from js/app.js and the per-route title/description/
section from js/router.js, so this file never needs editing when you add a
page. Add the route the usual way (CLAUDE.md checklist), re-run, commit.

    python3 tools-seo/build.py

Output: <route>/index.html for each route, plus a prerendered root index.html.
Fragments in pages/ stay the single source of truth for page content.
"""
import re, html, pathlib, sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
ORIGIN = "https://esdesigns.org"

read = lambda rel: (ROOT / rel).read_text(encoding="utf-8")


# --------------------------------------------------------------- parsing --
def parse_routes():
    """router.register('/ai', 'pages/ai.html');  ->  {'/ai': 'pages/ai.html'}"""
    src = read("js/app.js")
    routes = dict(re.findall(r"""router\.register\(\s*'([^']+)'\s*,\s*'([^']+)'\s*\)""", src))
    assert routes, "no router.register() calls found in js/app.js"
    return routes


def parse_sections():
    src = read("js/router.js")
    block = re.search(r"this\.sectionMap\s*=\s*\{(.*?)\n        \};", src, re.S)
    assert block, "sectionMap not found in js/router.js"
    return dict(re.findall(r"""'([^']+)'\s*:\s*'([^']+)'""", block.group(1)))


def parse_redirects():
    """Legacy paths that used to work only as '#/' routes. As bare URLs they
    404, which is what Search Console reports. Give each a real page."""
    src = read("js/router.js")
    block = re.search(r"this\.redirects\s*=\s*\{(.*?)\n        \};", src, re.S)
    assert block, "redirects map not found in js/router.js"
    return dict(re.findall(r"""'([^']+)'\s*:\s*'([^']+)'""", block.group(1)))


REDIRECT_TPL = """<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Redirecting to {title}</title>
<link rel="canonical" href="{url}">
<meta name="robots" content="noindex, follow">
<meta http-equiv="refresh" content="0; url={href}">
<script>window.location.replace("{href}");</script>
</head>
<body>
<p>This page moved. <a href="{href}">Continue to {title}</a>.</p>
</body>
</html>
"""


def write_redirects(meta):
    made = []
    for old, new in sorted(parse_redirects().items()):
        href = href_for(new)
        page = REDIRECT_TPL.format(
            href=href, url=ORIGIN + href,
            title=html.escape(meta.get(new, meta["/"])["title"].split("|")[0].strip()))
        out = ROOT / (old.strip("/") + "/index.html")
        out.parent.mkdir(parents=True, exist_ok=True)
        out.write_text(page, encoding="utf-8", newline="")
        made.append((old, new))
    for old, new in made:
        print(f"  {old + '/':<34} -> redirects to {href_for(new)}")
    print(f"{len(made)} legacy redirect pages written.")


def parse_meta():
    src = read("js/router.js")
    block = re.search(r"this\.meta\s*=\s*\{(.*?)\n        \};", src, re.S)
    assert block, "meta map not found in js/router.js"
    unq = lambda t: t.replace("\\'", "'").replace('\\"', '"')
    out = {}
    for path, title, desc in re.findall(
        r"""'(/[^']*)'\s*:\s*\{\s*title:\s*'((?:[^'\\]|\\.)*)'\s*,\s*"""
        r"""description:\s*'((?:[^'\\]|\\.)*)'\s*\}""",
        block.group(1), re.S):
        out[path] = {"title": unq(title), "description": unq(desc)}
    assert out, "no meta entries parsed"
    return out


# ------------------------------------------------------------- rewriting --
ASSET_DIRS = ("assets/", "css/", "js/", "manifest.json", "sw.js")


def absolutize(markup):
    """Root-relative asset paths, so /education/ loads the same CSS as /."""
    def fix(m):
        attr, val = m.group(1), m.group(2)
        return f'{attr}="/{val}"' if val.startswith(ASSET_DIRS) else m.group(0)
    return re.sub(r'\b(href|src|content)="([^"]+)"', fix, markup)


def dehash(markup):
    """href="#/education/courses"  ->  href="/education/courses/" """
    def fix(m):
        rest = m.group(1).strip("/")
        return f'href="/{rest}/"' if rest else 'href="/"'
    return re.sub(r'href="#/([^"]*)"', fix, markup)


def clean(markup):
    return dehash(absolutize(markup))


def href_for(path):
    return "/" if path == "/" else path.rstrip("/") + "/"


# ----------------------------------------------------------------- build --
def main():
    routes, sections, meta = parse_routes(), parse_sections(), parse_meta()

    shell = clean(read("index.html"))

    main_re = re.compile(r'(<main id="page-content"[^>]*>)(.*?)(</main>)', re.S)
    m = main_re.search(shell)
    assert m, 'could not locate <main id="page-content"> in index.html'

    written, missing = [], []
    for path, frag_rel in sorted(routes.items()):
        frag_path = ROOT / frag_rel
        if not frag_path.exists():
            missing.append(frag_rel)
            continue

        info = meta.get(path)
        if not info:
            print(f"  !! no meta for {path} - falling back to homepage meta")
            info = meta["/"]

        title = html.escape(info["title"])
        desc = html.escape(info["description"])
        url = ORIGIN + href_for(path)
        section = sections.get(path, "shared")
        fragment = clean(frag_path.read_text(encoding="utf-8"))

        page = shell
        page = re.sub(r"<title>.*?</title>", f"<title>{title}</title>", page, count=1, flags=re.S)
        page = re.sub(r'(<meta name="description" content=)"[^"]*"', rf'\1"{desc}"', page, count=1)
        page = re.sub(r'(<meta property="og:title" content=)"[^"]*"', rf'\1"{title}"', page, count=1)
        page = re.sub(r'(<meta property="og:description" content=)"[^"]*"', rf'\1"{desc}"', page, count=1)
        page = re.sub(r'(<meta property="og:url" content=)"[^"]*"', rf'\1"{url}"', page, count=1)

        if 'rel="canonical"' in page:
            page = re.sub(r'(<link rel="canonical" href=)"[^"]*"', rf'\1"{url}"', page, count=1)
        else:
            page = page.replace('<meta property="og:title"',
                                f'<link rel="canonical" href="{url}">\n    <meta property="og:title"', 1)

        page = re.sub(r'<body data-section="[^"]*"', f'<body data-section="{section}"', page, count=1)
        # The shell is the previous build's index.html, so its <main> already
        # carries data-prerendered="/". Drop any existing attribute before
        # stamping this route's own, or they accumulate on every rebuild and
        # the browser keeps the first one ("/"), which defeats the no-fetch
        # first paint on every route except the home page.
        page = main_re.sub(
            lambda mm: (re.sub(r'\s+data-prerendered="[^"]*"', "", mm.group(1))
                          .replace(">", f' data-prerendered="{path}">', 1)
                        + "\n" + fragment + "\n    " + mm.group(3)),
            page, count=1)

        out = ROOT / ("index.html" if path == "/" else path.strip("/") + "/index.html")
        out.parent.mkdir(parents=True, exist_ok=True)
        # Write only when the output actually changed, so an untouched route
        # keeps its mtime and the sitemap's <lastmod> stays honest.
        if not (out.exists() and out.read_text(encoding="utf-8") == page):
            out.write_text(page, encoding="utf-8", newline="")
        written.append((href_for(path), out.relative_to(ROOT).as_posix(), len(page)))

    for href, rel, size in written:
        print(f"  {href:<34} -> {rel:<44} {size:>7,} B")
    if missing:
        print("\n  MISSING FRAGMENTS (skipped): " + ", ".join(missing))
    print(f"\n{len(written)} routes prerendered.")
    return written


def write_sitemap(written):
    """Rebuild sitemap.xml: prerendered routes + the hand-authored pages."""
    import datetime

    def stamp(rel):
        """File mtime, not `git log`. Per-URL git calls on a OneDrive-backed
        checkout are slow enough to blow a 45s budget."""
        try:
            return datetime.date.fromtimestamp((ROOT / rel).stat().st_mtime).isoformat()
        except OSError:
            return datetime.date.today().isoformat()

    rows = []
    for href, rel, _ in written:
        pri = "1.0" if href == "/" else ("0.9" if href.count("/") == 2 else "0.8")
        rows.append((ORIGIN + href, stamp(rel), "weekly" if href == "/" else "monthly", pri))

    rows.append((f"{ORIGIN}/blog/", stamp("blog/index.html"), "weekly", "0.9"))
    for d in sorted((ROOT / "blog").iterdir()):
        if d.is_dir() and (d / "index.html").exists():
            rows.append((f"{ORIGIN}/blog/{d.name}/",
                         stamp(f"blog/{d.name}/index.html"), "monthly", "0.8"))
    rows.append((f"{ORIGIN}/connect/", stamp("connect/index.html"), "yearly", "0.5"))

    out = ['<?xml version="1.0" encoding="UTF-8"?>',
           '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">']
    for loc, mod, freq, pri in rows:
        out += ["  <url>", f"    <loc>{loc}</loc>", f"    <lastmod>{mod}</lastmod>",
                f"    <changefreq>{freq}</changefreq>", f"    <priority>{pri}</priority>", "  </url>"]
    out.append("</urlset>")
    (ROOT / "sitemap.xml").write_text("\n".join(out) + "\n", encoding="utf-8", newline="\n")
    print(f"sitemap.xml rewritten with {len(rows)} URLs.")


if __name__ == "__main__":
    written = main()
    write_redirects(parse_meta())
    if "--no-sitemap" not in sys.argv:
        write_sitemap(written)
