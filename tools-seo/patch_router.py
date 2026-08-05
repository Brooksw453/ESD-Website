#!/usr/bin/env python3
"""Convert js/router.js from hash routing to the History API.

Idempotent: running it twice is a no-op. Every replacement is asserted, so a
future edit that moves the anchor text fails loudly instead of silently
producing a half-patched router.
"""
import re, sys, pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent
p = ROOT / "js" / "router.js"
s = p.read_text(encoding="utf-8")
orig = s

if "History API Client-Side Router" in s:
    print("router.js already patched, nothing to do")
    sys.exit(0)

def sub1(old, new, label):
    global s
    assert s.count(old) == 1, f"{label}: expected 1 match, found {s.count(old)}"
    s = s.replace(old, new)
    print(f"  patched: {label}")

# ---- 1. header comment -------------------------------------------------
sub1("Hash-Based Client-Side Router", "History API Client-Side Router", "header")

# ---- 2. listeners ------------------------------------------------------
sub1(
    "        window.addEventListener('hashchange', () => this.handleRoute());",
    "        window.addEventListener('popstate', () => this.handleRoute());\n"
    "        window.addEventListener('hashchange', () => this.migrateHash());\n"
    "        document.addEventListener('click', (e) => this.interceptLink(e));",
    "listeners",
)

# ---- 3. path helpers + link interception + navigate ---------------------
sub1(
    "    register(path, fragmentUrl) {\n        this.routes[path] = fragmentUrl;\n    }",
    """    /* '/education/' -> '/education'; '/' stays '/'. Also tolerates a
       leading '#' so legacy hash URLs normalize through the same path. */
    static normalizePath(raw) {
        let p = (raw || '/').trim();
        if (p.startsWith('#')) p = p.slice(1);
        p = p.replace(/index\\.html$/, '');
        if (p.length > 1) p = p.replace(/\\/+$/, '');
        return p || '/';
    }

    /* '/education' -> '/education/'  (GitHub Pages serves directory URLs) */
    static toHref(path) {
        const p = Router.normalizePath(path);
        return p === '/' ? '/' : p + '/';
    }

    register(path, fragmentUrl) {
        this.routes[path] = fragmentUrl;
    }

    /* Intercept same-origin clicks that land on a registered SPA route.
       Anything else (blog, connect, assets, external, downloads, new-tab
       modifier clicks) is left alone for the browser to handle normally. */
    interceptLink(e) {
        if (e.defaultPrevented || e.button !== 0) return;
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;

        const a = e.target.closest('a');
        if (!a) return;
        if (a.target && a.target !== '_self') return;
        if (a.hasAttribute('download')) return;

        const href = a.getAttribute('href');
        if (!href || href.startsWith('#') || href.startsWith('mailto:') ||
            href.startsWith('tel:')) return;

        const url = new URL(a.href, window.location.origin);
        if (url.origin !== window.location.origin) return;

        const path = Router.normalizePath(url.pathname);
        const target = this.redirects[path] || path;
        if (!(target in this.routes)) return;   // real page, not an SPA route

        e.preventDefault();
        this.navigate(target);
    }

    /* A stray legacy '#/x' link (an old blog post, courses.esdesigns.org, a
       bookmark) only mutates the hash when the visitor is already on the
       site, which fires no navigation at all. Convert it to a real route. */
    migrateHash() {
        const h = window.location.hash;
        if (!h || !h.startsWith('#/')) return;
        const p = Router.normalizePath(h);
        history.replaceState({}, '', Router.toHref(this.redirects[p] || p));
        this.handleRoute();
    }

    navigate(path) {
        const href = Router.toHref(path);
        if (Router.normalizePath(window.location.pathname) !== Router.normalizePath(path)) {
            history.pushState({}, '', href);
        }
        this.handleRoute();
    }""",
    "helpers + interceptLink",
)

# ---- 4. start(): migrate legacy #/ bookmarks and backlinks --------------
sub1(
    "    async start() {\n        await this.handleRoute();\n    }",
    """    async start() {
        /* Legacy '#/education' links (old sitemap, bookmarks, backlinks)
           become real '/education/' URLs without a round trip. */
        const legacy = window.location.hash;
        if (legacy && legacy.startsWith('#/')) {
            const p = Router.normalizePath(legacy);
            history.replaceState({}, '', Router.toHref(this.redirects[p] || p));
        }
        await this.handleRoute();
    }""",
    "start()",
)

# ---- 5. handleRoute(): read pathname, redirect via replaceState ---------
sub1(
    """        const hash = window.location.hash || '#/';
        let path = hash.replace('#', '') || '/';

        // Handle legacy redirects
        if (this.redirects[path]) {
            window.location.hash = '#' + this.redirects[path];
            return;
        }""",
    """        let path = Router.normalizePath(window.location.pathname);

        // Handle legacy redirects
        if (this.redirects[path]) {
            const to = this.redirects[path];
            history.replaceState({}, '', Router.toHref(to));
            path = to;
        }""",
    "handleRoute path",
)

# ---- 6. honour prerendered markup on first paint ------------------------
sub1(
    """        // Fade out
        this.container.classList.add('page-exit');
        await this.wait(250);

        // Load new content
        const html = await this.loadFragment(path);

        // Inject
        this.container.innerHTML = html;
        this.container.classList.remove('page-exit');
        this.container.classList.add('page-enter');

        // Scroll to top
        window.scrollTo(0, 0);""",
    """        /* build.py ships this route's markup inside the static file, so the
           first paint needs no fetch and no fade. Later navigations do. */
        const pre = this.container.dataset.prerendered;
        if (pre !== undefined && Router.normalizePath(pre) === path) {
            delete this.container.dataset.prerendered;
        } else {
            // Fade out
            this.container.classList.add('page-exit');
            await this.wait(250);

            // Load new content
            const html = await this.loadFragment(path);

            // Inject
            this.container.innerHTML = html;
            this.container.classList.remove('page-exit');
            this.container.classList.add('page-enter');

            // Scroll to top
            window.scrollTo(0, 0);
        }""",
    "prerender skip",
)

# ---- 7. active-link matching against real paths ------------------------
sub1(
    "            const linkPath = href ? href.replace('#', '') : '';",
    "            const linkPath = href ? Router.normalizePath(href) : '';",
    "updateNavActive",
)

# ---- 8. keep canonical + og:url in sync on SPA navigation --------------
sub1(
    """        const ogDesc = document.querySelector('meta[property="og:description"]');
        if (ogDesc) ogDesc.setAttribute('content', pageMeta.description);""",
    """        const ogDesc = document.querySelector('meta[property="og:description"]');
        if (ogDesc) ogDesc.setAttribute('content', pageMeta.description);

        const url = 'https://esdesigns.org' + Router.toHref(path);

        const canonical = document.querySelector('link[rel="canonical"]');
        if (canonical) canonical.setAttribute('href', url);

        const ogUrl = document.querySelector('meta[property="og:url"]');
        if (ogUrl) ogUrl.setAttribute('content', url);""",
    "canonical sync",
)

# ---- 9. GA page_path should be the real URL ----------------------------
sub1("                page_path: path,", "                page_path: Router.toHref(path),", "ga page_path")

# ---- 10. fragment fetches must be root-relative ------------------------
# routes are registered as 'pages/ai.html'. From '/education/courses/' a
# relative fetch resolves to '/education/courses/pages/ai.html' and 404s.
sub1(
    "        try {\n            const response = await fetch(url);",
    "        try {\n            const response = await fetch(url.startsWith('/') ? url : '/' + url);",
    "absolute fragment fetch",
)

# ---- 11. rewrite link literals only -----------------------------------
# Deliberately narrow. A blanket s/#\//\//g also rewrites the '#/' inside the
# hash-migration code inserted above, silently disabling it.
def to_dir(rest):
    rest = rest.strip("/")
    return f"/{rest}/" if rest else "/"

n = 0
# nav/footer config objects:  { href: '#/about', label: 'About' }
s, k = re.subn(r"""\b(href|brandHref)(:\s*)'#/([^']*)'""",
               lambda m: f"{m.group(1)}{m.group(2)}'{to_dir(m.group(3))}'", s)
n += k
# markup inside template strings:  <a href="#/" class="neon-btn">
s, k = re.subn(r'''href="#/([^"]*)"''',
               lambda m: f'href="{to_dir(m.group(1))}"', s)
n += k
print(f"  patched: {n} '#/' link literals -> directory URLs")

assert s != orig, "no changes made"
# Routing must never WRITE to location.hash again. The only remaining reads
# are the two legacy-migration paths (start() and migrateHash()).
assert not re.search(r"(window\.)?location\.hash\s*=[^=]", s), \
    "something still assigns to location.hash"
reads = len(re.findall(r"window\.location\.hash", s))
assert reads == 2, f"expected 2 location.hash reads (migration only), found {reads}"
p.write_text(s, encoding="utf-8", newline="")
print(f"router.js patched ({len(orig)} -> {len(s)} bytes)")
