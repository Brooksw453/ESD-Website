#!/usr/bin/env python3
"""Browser tests for the History API routing + prerender migration."""
import re, subprocess, time, pathlib, sys
from playwright.sync_api import sync_playwright

ROOT = pathlib.Path(__file__).resolve().parent.parent
PORT = 8777
BASE = f"http://localhost:{PORT}"

srv = subprocess.Popen([sys.executable, "-m", "http.server", str(PORT)],
                       cwd=ROOT, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
time.sleep(1.5)

results = []
def check(name, ok, detail=""):
    results.append((ok, name, detail))
    print(f"  {'PASS' if ok else 'FAIL'}  {name}" + (f"   {detail}" if detail else ""))

try:
    with sync_playwright() as pw:
        b = pw.chromium.launch(executable_path="/opt/pw-browsers/chromium")
        ctx = b.new_context()
        page = ctx.new_page()
        errors = []
        page.on("pageerror", lambda e: errors.append(str(e)))

        # ---- 1. content is in the HTML source, no JS required -------------
        page.context.new_page()
        nojs = b.new_context(java_script_enabled=False)
        p2 = nojs.new_page()
        for path, needle in [("/ai/", "Detection Trap"),
                             ("/education/ally-pro/", "Document Ally"),
                             ("/", "ES Designs")]:
            p2.goto(BASE + path)
            body = p2.content()
            check(f"JS disabled: {path} renders content",
                  needle.lower() in body.lower(), f"{len(body):,} B")
        nojs.close()

        # ---- 2. per-page head tags ---------------------------------------
        for path, want_canon in [("/ai/", "https://esdesigns.org/ai/"),
                                 ("/education/audit/", "https://esdesigns.org/education/audit/"),
                                 ("/", "https://esdesigns.org/")]:
            page.goto(BASE + path)
            canon = page.eval_on_selector('link[rel="canonical"]', "e => e.href") if \
                page.query_selector('link[rel="canonical"]') else None
            title = page.title()
            check(f"canonical on {path}", canon == want_canon, canon or "MISSING")
            check(f"unique title on {path}", bool(title) and len(title) > 20, title[:55])

        # ---- 3. client-side navigation, no full reload --------------------
        page.goto(BASE + "/")
        page.evaluate("window.__spa = true")
        link = page.query_selector('a[href="/education/"]') or page.query_selector('a[href="/ai/"]')
        check("internal nav link uses a real path", link is not None,
              link.get_attribute("href") if link else "none found")
        if link:
            link.click()
            page.wait_for_timeout(900)
            check("SPA nav kept the page alive (no reload)",
                  page.evaluate("window.__spa === true"), page.url.replace(BASE, ""))
            check("SPA nav pushed a real URL", "#" not in page.url, page.url.replace(BASE, ""))
            check("SPA nav swapped content",
                  len(page.eval_on_selector("#page-content", "e => e.innerHTML")) > 500)
            check("SPA nav updated canonical",
                  page.eval_on_selector('link[rel="canonical"]', "e => e.href")
                  .startswith("https://esdesigns.org/"))

        # ---- 4. back button ----------------------------------------------
        page.go_back()
        page.wait_for_timeout(900)
        check("back button returns to /", page.url.rstrip("/") == BASE, page.url.replace(BASE, ""))

        # ---- 5. legacy #/ URLs migrate to real paths ----------------------
        # Each needs a FRESH page: navigating an already-loaded page to the
        # same URL + a new hash does not reload, so scripts would not re-run.
        for legacy, want in [("/#/education", "/education/"),
                             ("/#/ai", "/ai/"),
                             ("/#/education/ally", "/education/ally-pro/")]:
            fresh = ctx.new_page()
            fresh.goto(BASE + legacy)
            fresh.wait_for_timeout(1500)
            check(f"cold load {legacy} -> {want}", fresh.url == BASE + want,
                  fresh.url.replace(BASE, ""))
            fresh.close()

        # ---- 5b. stray legacy hash clicked while already on the site ------
        warm = ctx.new_page()
        warm.goto(BASE + "/")
        warm.wait_for_timeout(800)
        warm.evaluate("window.location.hash = '#/ai'")
        warm.wait_for_timeout(1500)
        check("warm hash change -> /ai/", warm.url == BASE + "/ai/",
              warm.url.replace(BASE, ""))
        check("warm hash change swapped content",
              "detection trap" in warm.eval_on_selector("#page-content", "e => e.innerText").lower())
        warm.close()

        # ---- 6. non-SPA links are NOT intercepted -------------------------
        page.goto(BASE + "/")
        page.wait_for_timeout(600)
        blog = page.query_selector('a[href="/blog/"]')
        check("blog link left for the browser", blog is not None)

        # ---- 7. no JS errors ----------------------------------------------
        check("no uncaught JS errors", not errors, "; ".join(errors[:2]))
        b.close()
finally:
    srv.terminate()

bad = [r for r in results if not r[0]]
print(f"\n{len(results) - len(bad)}/{len(results)} passed")
sys.exit(1 if bad else 0)
