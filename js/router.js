/* ============================================
   History API Client-Side Router
   Two-brand navigation with section-aware theming
   ============================================ */

class Router {
    constructor(scrollAnimations) {
        this.routes = {};
        this.currentRoute = null;
        this.currentSection = null;
        this.contentCache = {};
        this.container = document.getElementById('page-content');
        this.scrollAnimations = scrollAnimations;
        this.transitioning = false;

        // Map routes to brand sections
        this.sectionMap = {
            '/':                  'studio',
            '/thrustline':        'studio',
            '/vr':                'studio',
            '/vr/anatomy-physiology-lab': 'shared',
            '/education':         'ed',
            '/education/ally-pro':     'ed',
            '/education/audit':        'ed',
            '/education/wcag-course':  'ed',
            '/education/roadmap-tool': 'ed',
            '/ai':                'ed',
            '/vantura':           'ed',
            '/about':             'studio',
            '/privacy':           'studio',
        };

        // Legacy route redirects
        this.redirects = {
            '/elliptical-explorer':      '/thrustline',
            '/elliptical':               '/thrustline',
            '/education/courses':        '/education',
            '/education/demos':          '/education',
            '/games':                    '/',
            '/education/document-ally':  '/education/ally-pro',
            '/education/ally':           '/education/ally-pro',
        };

        // Page metadata for SEO
        this.meta = {
            '/': {
                title: 'ES Designs | Independent VR Studio for Meta Quest',
                description: 'ES Designs is an independent studio in Massachusetts building VR for Meta Quest, end to end: Thrustline, a racing game powered by your workout; Vantura, 360 video for colleges; and the Anatomy & Physiology Lab.'
            },
            '/thrustline': {
                title: 'Thrustline | Race a Jet Bike Powered by Your Workout, on Meta Quest',
                description: 'Thrustline turns your elliptical, rower, or stair climber into a jet bike race on Meta Quest. Your effort is the throttle. Race your ghosts and six rivals across six courses. Coming December 2026.'
            },
            '/education': {
                title: 'Title II Document Remediation & Planning for Higher Ed | ES Designs',
                description: 'Document remediation with the before/after record, the free Title II roadmap tool, WCAG 2.2 courses, and website audits for colleges facing the April 26, 2027 ADA Title II deadline. Send ten documents and see the record on your own files.'
            },
            '/education/ally-pro': {
                title: 'Document Ally Pro | Free AI WCAG 2.2 Document Remediation for Higher Ed',
                description: 'AI-powered WCAG 2.2 document remediation for higher ed — free to start. Batch upload, branded conformance analytics, and a FERPA-friendly pipeline. Built for the Title II window.'
            },
            '/education/audit': {
                title: 'AI Website Audit Tool | WCAG 2.2 AA for Higher Ed',
                description: 'Crawl-based WCAG 2.2 audits with AI-generated remediation suggestions. Branded audit reports for higher education institutions. Run a free single-page audit today.'
            },
            '/education/wcag-course': {
                title: 'WCAG 2.2 for Higher Ed | Self-Paced Course for Faculty',
                description: 'A plain-English WCAG 2.2 course built for higher education faculty. 8 modules, completion certificate, included with every institutional Document Ally Pro license.'
            },
            '/education/roadmap-tool': {
                title: 'Compliance Roadmap Tool | ADA Title II Planning for Higher Ed',
                description: 'Free interactive Title II compliance planning tool for higher ed accessibility directors. 9 chapters, AI-drafted summaries, accessible PDF export. Build your plan in 30 minutes.'
            },
            '/ai': {
                title: 'AI in Higher Ed | Teaching Past the Detection Trap — ES Designs',
                description: 'Most colleges are policing AI. ES Designs helps you teach it. Self-paced AI courses for faculty and administrators, campus workshops, and a free AI tools guide — built by a 21-year higher ed practitioner.'
            },
            '/vantura': {
                title: 'Vantura: 360 Video for Higher Ed and CTE | ES Designs',
                description: 'Host your program\'s own 360 videos and deliver them to the Quest headsets you already own. Free Quest app on the Meta Horizon Store, free plan with sample lessons, no per-student fees, offline playback.'
            },
            '/about': {
                title: 'About ES Designs | Brooks Winchell',
                description: 'ES Designs is the independent VR and full-stack studio of Brooks Winchell in Massachusetts: Quest apps in Unity, and the web portals and databases behind them. Open to select XR and full-stack projects.'
            },
            '/privacy': {
                title: 'Privacy Policy | ES Designs',
                description: 'Privacy policy for ES Designs: Thrustline, Vantura, and the Anatomy & Physiology Lab for Meta Quest, and the esdesigns.org website. Thrustline keeps your data on your headset and sends nothing to us.'
            },
            '/vr': {
                title: 'VR Development | ES Designs',
                description: 'VR for Meta Quest from ES Designs: Thrustline, a racing game powered by your workout; Vantura, 360 video for colleges and CTE; and the Anatomy & Physiology Lab.'
            },
            '/vr/anatomy-physiology-lab': {
                title: 'Anatomy & Physiology Lab | VR Learning for Meta Quest',
                description: 'An immersive, self-directed VR learning adventure exploring human anatomy and physiology — interactive skeletal, heart, and exploration labs with learning modules and knowledge checks, on Meta Quest.'
            }
        };

        // Navigation configurations per section
        this.navConfigs = {
            // Studio (dark): home, Thrustline, VR, About, Privacy.
            studio: {
                brand: 'ES Designs',
                brandHref: '/',
                links: [
                    { href: '/thrustline/', label: 'Thrustline' },
                    { href: '/vr/', label: 'VR' },
                    { href: '/blog/', label: 'Build Log' },
                    { href: '/education/', label: 'For Educators' },
                    { href: '/about/', label: 'About' },
                ]
            },
            // The education library (light): accessibility, AI, Vantura.
            // The step rail on each product page handles product wayfinding.
            ed: {
                brand: 'ES Designs',
                brandHref: '/',
                section: 'For Educators',
                links: [
                    { href: '/vantura/', label: 'Vantura' },
                    { href: '/education/', label: 'Accessibility' },
                    { href: '/ai/', label: 'AI in Higher Ed' },
                    { href: '/about/', label: 'About' },
                ]
            },
            // shared (light): the A&P Lab page. Same links as the studio.
            shared: {
                brand: 'ES Designs',
                brandHref: '/',
                links: [
                    { href: '/thrustline/', label: 'Thrustline' },
                    { href: '/vr/', label: 'VR' },
                    { href: '/blog/', label: 'Build Log' },
                    { href: '/education/', label: 'For Educators' },
                    { href: '/about/', label: 'About' },
                ]
            }
        };

        // Footer configurations per section: the studio index on the dark
        // pages, the full product index on the education pages. Privacy
        // Policy stays as the trailing legal link everywhere.
        this.footerConfigs = {
            studio: [
                { href: '/thrustline/', label: 'Thrustline' },
                { href: '/vr/', label: 'VR' },
                { href: '/vantura/', label: 'Vantura' },
                { href: '/blog/', label: 'Build Log' },
                { href: '/education/', label: 'For Educators' },
                { href: '/about/', label: 'About' },
                { href: '/connect/', label: 'Connect' },
                { href: '/privacy/', label: 'Privacy Policy' },
            ],
            ed: [
                { href: '/', label: 'Home' },
                { href: '/vantura/', label: 'Vantura' },
                { href: '/education/', label: 'Accessibility' },
                { href: '/education/roadmap-tool/', label: 'Compliance Roadmap Tool' },
                { href: '/education/ally-pro/', label: 'Document Ally Pro' },
                { href: '/education/wcag-course/', label: 'WCAG 2.2 Courses' },
                { href: '/education/audit/', label: 'AI Website Audit' },
                { href: '/ai/', label: 'AI in Higher Ed' },
                { href: '/vr/', label: 'VR' },
                { href: '/about/', label: 'About' },
                { href: '/blog/', label: 'Build Log' },
                { href: '/connect/', label: 'Connect' },
                { href: '/privacy/', label: 'Privacy Policy' },
            ],
            shared: [
                { href: '/', label: 'Home' },
                { href: '/thrustline/', label: 'Thrustline' },
                { href: '/vr/', label: 'VR' },
                { href: '/vantura/', label: 'Vantura' },
                { href: '/education/', label: 'For Educators' },
                { href: '/about/', label: 'About' },
                { href: '/connect/', label: 'Connect' },
                { href: '/privacy/', label: 'Privacy Policy' },
            ]
        };

        window.addEventListener('popstate', () => this.handleRoute());
        window.addEventListener('hashchange', () => this.migrateHash());
        document.addEventListener('click', (e) => this.interceptLink(e));
    }

    /* '/education/' -> '/education'; '/' stays '/'. Also tolerates a
       leading '#' so legacy hash URLs normalize through the same path. */
    static normalizePath(raw) {
        let p = (raw || '/').trim();
        if (p.startsWith('#')) p = p.slice(1);
        p = p.replace(/index\.html$/, '');
        if (p.length > 1) p = p.replace(/\/+$/, '');
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
        this.navigate(target, url.hash);
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

    /* `hash` is an in-page anchor ('#sampleForm') carried on a route link,
       e.g. /education/#sampleForm from an email or another page. Kept in
       the URL and scrolled to once the route has rendered. */
    async navigate(path, hash = '') {
        if (hash && hash.startsWith('#/')) hash = '';
        const href = Router.toHref(path) + hash;
        if (Router.normalizePath(window.location.pathname) !== Router.normalizePath(path)) {
            history.pushState({}, '', href);
        } else if (hash) {
            history.replaceState({}, '', href);
        }
        await this.handleRoute();
        if (hash) this.scrollToHash(hash);
    }

    /* Scroll an in-page anchor into view under the fixed header. */
    scrollToHash(hash) {
        const go = () => {
            const el = hash && document.getElementById(hash.slice(1));
            if (!el) return;
            const y = el.getBoundingClientRect().top + window.scrollY - 80;
            window.scrollTo({ top: y, behavior: 'smooth' });
        };
        go();
        // The fade-up reveal shifts sections a few px after first paint;
        // re-aim once it has settled so the target lands under the header.
        setTimeout(go, 450);
    }

    async start() {
        /* Legacy '#/education' links (old sitemap, bookmarks, backlinks)
           become real '/education/' URLs without a round trip. */
        const legacy = window.location.hash;
        if (legacy && legacy.startsWith('#/')) {
            const p = Router.normalizePath(legacy);
            history.replaceState({}, '', Router.toHref(this.redirects[p] || p));
        }
        await this.handleRoute();
        // Cold load of /education/#sampleForm: land under the header, not
        // behind it (the browser's own anchor jump ignores the fixed nav).
        const anchor = window.location.hash;
        if (anchor && !anchor.startsWith('#/')) this.scrollToHash(anchor);
    }

    async handleRoute() {
        if (this.transitioning) return;

        let path = Router.normalizePath(window.location.pathname);

        // Handle legacy redirects
        if (this.redirects[path]) {
            const to = this.redirects[path];
            history.replaceState({}, '', Router.toHref(to));
            path = to;
        }

        if (path === this.currentRoute) return;

        this.transitioning = true;

        // Determine section
        const section = this.sectionMap[path] || 'shared';

        /* build.py ships this route's markup inside the static file, so the
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
        }

        // Set section on body for CSS theming
        document.body.dataset.section = section;

        // Update navigation and footer for this section
        if (section !== this.currentSection) {
            this.renderNav(section, path);
            this.renderFooter(section);
            this.currentSection = section;
        }
        this.updateNavActive(path);

        // Re-observe scroll animations
        if (this.scrollAnimations) {
            this.scrollAnimations.refresh();
        }

        // Update page metadata
        this.updateMeta(path);
        this.currentRoute = path;

        // Send pageview to Google Analytics (SPA route change)
        if (typeof gtag === 'function') {
            gtag('event', 'page_view', {
                page_path: Router.toHref(path),
                page_title: (this.meta[path] || this.meta['/']).title
            });
        }

        // Close mobile nav if open
        const navLinks = document.getElementById('navLinks');
        const hamburger = document.getElementById('hamburger');
        if (navLinks) navLinks.classList.remove('open');
        if (hamburger) hamburger.classList.remove('open');

        // Remove enter class after animation
        setTimeout(() => {
            this.container.classList.remove('page-enter');
            this.transitioning = false;
        }, 400);

        // Conditional particle canvas visibility
        if (section === 'ee') {
            if (window.particleSystem) window.particleSystem.start();
        } else {
            if (window.particleSystem) window.particleSystem.stop();
        }

        // The music player shows when someone opens it (body.music-open,
        // set by music-player.js) and keeps playing across pages.

        // Bind any page-specific event handlers
        this.bindPageEvents(path);
    }

    async loadFragment(path) {
        if (this.contentCache[path]) return this.contentCache[path];

        const url = this.routes[path];
        if (!url) {
            return `
                <div class="section" style="text-align:center; padding-top: 200px;">
                    <div class="container">
                        <h1 class="neon-text">404</h1>
                        <p>Page not found</p>
                        <a href="/" class="neon-btn" style="margin-top: 24px;">Go Home</a>
                    </div>
                </div>`;
        }

        try {
            const response = await fetch(url.startsWith('/') ? url : '/' + url);
            if (!response.ok) throw new Error('Failed to load page');
            const html = await response.text();
            this.contentCache[path] = html;
            return html;
        } catch (err) {
            return `
                <div class="section" style="text-align:center; padding-top: 200px;">
                    <div class="container">
                        <h2 class="neon-text">Error Loading Page</h2>
                        <p>Please try again.</p>
                    </div>
                </div>`;
        }
    }

    renderNav(section, path) {
        const config = this.navConfigs[section] || this.navConfigs.studio;
        const navBrand = document.querySelector('.nav-brand');
        const navLinks = document.getElementById('navLinks');

        if (navBrand) {
            navBrand.innerHTML = config.brand;
            navBrand.href = config.brandHref;
        }

        // Section label beside the brand ("For Educators" on the education
        // pages). The brand itself always goes home.
        const navSection = document.getElementById('navSection');
        if (navSection) {
            navSection.textContent = config.section || '';
            navSection.hidden = !config.section;
        }

        if (navLinks) {
            navLinks.innerHTML = config.links.map(link =>
                link.external
                    ? `<a href="${link.href}" class="nav-link nav-link-cta" target="_blank" rel="noopener" data-ga="free-course" data-ga-source="nav">${link.label}</a>`
                    : `<a href="${link.href}" class="nav-link">${link.label}</a>`
            ).join('');
        }
    }

    renderFooter(section) {
        const config = this.footerConfigs[section] || this.footerConfigs.studio;
        const footerLinks = document.querySelector('.footer-links');

        if (footerLinks) {
            let html = config.map(link =>
                `<a href="${link.href}">${link.label}</a>`
            ).join('');

            // Side projects link on the education pages (the studio pages
            // carry GitHub on About instead)
            if (section === 'ed') {
                html += '<a href="https://github.com/brooksw453" target="_blank" rel="noopener">Side Projects</a>';
            }

            footerLinks.innerHTML = html;
        }
    }

    updateNavActive(path) {
        document.querySelectorAll('.nav-link').forEach(link => {
            const href = link.getAttribute('href');
            const linkPath = href ? Router.normalizePath(href) : '';
            link.classList.toggle('active', linkPath === path);
        });
    }

    updateMeta(path) {
        const pageMeta = this.meta[path] || this.meta['/'];
        document.title = pageMeta.title;

        const descEl = document.querySelector('meta[name="description"]');
        if (descEl) descEl.setAttribute('content', pageMeta.description);

        const ogTitle = document.querySelector('meta[property="og:title"]');
        if (ogTitle) ogTitle.setAttribute('content', pageMeta.title);

        const ogDesc = document.querySelector('meta[property="og:description"]');
        if (ogDesc) ogDesc.setAttribute('content', pageMeta.description);

        const url = 'https://esdesigns.org' + Router.toHref(path);

        const canonical = document.querySelector('link[rel="canonical"]');
        if (canonical) canonical.setAttribute('href', url);

        const ogUrl = document.querySelector('meta[property="og:url"]');
        if (ogUrl) ogUrl.setAttribute('content', url);
    }

    bindPageEvents(path) {
        // Soundtrack buttons (Thrustline page): open the player and play.
        document.querySelectorAll('[data-play-track]').forEach(btn => {
            btn.addEventListener('click', () => {
                if (window.musicPlayer) window.musicPlayer.playTrackByTitle(btn.getAttribute('data-play-track'));
            });
        });

        // Shared: scroll-to buttons, inline forms, compact tiles
        // (all education pages, the AI page, and the home/landing page —
        // all reuse the same inline-form + capture components)
        if (path.startsWith('/education') || path === '/ai' || path === '/vantura' || path === '/' || path === '/thrustline' || path === '/about') {
            // Free-course CTA tracking (home hero + nav). Fire a GA4
            // free_course_click before the new tab opens. No-op on pages
            // that have no [data-ga="free-course"] elements.
            document.querySelectorAll('[data-ga="free-course"]').forEach(el => {
                el.addEventListener('click', () => {
                    if (typeof gtag === 'function') {
                        gtag('event', 'free_course_click', {
                            source: el.getAttribute('data-ga-source') || 'home-hero'
                        });
                    }
                });
            });

            // Scroll-to buttons (offset by nav height so title isn't cut off)
            document.querySelectorAll('[data-scroll-to]').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    e.preventDefault();
                    const target = document.getElementById(btn.getAttribute('data-scroll-to'));
                    if (target) {
                        const y = target.getBoundingClientRect().top + window.scrollY - 80;
                        window.scrollTo({ top: y, behavior: 'smooth' });
                    }
                });
            });

            // Compact expandable feature cards (used on ally + courses).
            // Header is a real <button aria-expanded>. Toggle both the
            // card's .open class (for CSS transitions) and the button's
            // aria-expanded attribute so screen readers announce state.
            document.querySelectorAll('.ed-feature-card-compact .ed-compact-header').forEach(btn => {
                btn.addEventListener('click', () => {
                    const card = btn.closest('.ed-feature-card-compact');
                    const opened = card.classList.toggle('open');
                    btn.setAttribute('aria-expanded', opened ? 'true' : 'false');
                });
            });

            // Inline form submission (generic). Catches the styled inline-contact
            // forms plus any other in-page form opted into Supabase via
            // data-supabase-table (e.g. the audit card + newsletter capture).
            // #contactForm is the floating widget — owned by contact-widget.js,
            // excluded here so it isn't bound twice.
            document.querySelectorAll('.ed-inline-contact form, form[data-supabase-table]:not(#contactForm), form[data-capture-endpoint]').forEach(form => {
                const status = form.querySelector('.contact-status') || form.parentElement.querySelector('.contact-status');
                const supabaseTable = form.getAttribute('data-supabase-table');
                const captureEndpoint = form.getAttribute('data-capture-endpoint');

                // --- Anti-bot: off-screen honeypot + submit-timing trap ---
                // The `_` prefix means this field is auto-excluded from the data
                // sent to Supabase (see the `!key.startsWith('_')` filter below),
                // so it needs no DB column. Positioned off-screen rather than
                // display:none because the spam bot hitting these forms skips
                // display:none fields.
                if (!form.querySelector('input[name="_hp"]')) {
                    const hp = document.createElement('input');
                    hp.type = 'text';
                    hp.name = '_hp';
                    hp.tabIndex = -1;
                    hp.autocomplete = 'off';
                    hp.setAttribute('aria-hidden', 'true');
                    hp.style.cssText = 'position:absolute;left:-9999px;width:1px;height:1px;opacity:0;';
                    form.appendChild(hp);
                }
                const boundAt = Date.now();

                // Show a Turnstile widget when configured (inert otherwise).
                if (window.esdTurnstile) window.esdTurnstile.mount(form);

                form.addEventListener('submit', async (e) => {
                    e.preventDefault();
                    const btn = form.querySelector('button[type="submit"]');
                    const orig = btn.textContent;

                    // Bot check: honeypot filled, or submitted implausibly fast
                    // (a person needs more than ~2s to fill and submit). Fake a
                    // success so the bot moves on, and store nothing.
                    const hpField = form.querySelector('input[name="_hp"]');
                    if ((hpField && hpField.value) || (Date.now() - boundAt < 2000)) {
                        if (status) {
                            status.textContent = captureEndpoint
                                ? "You're on the list — check your inbox."
                                : "Sent! We'll be in touch soon.";
                            status.className = 'contact-status success';
                        }
                        form.reset();
                        return;
                    }

                    btn.textContent = captureEndpoint ? 'Subscribing…' : 'Sending...';
                    btn.disabled = true;
                    if (status) { status.textContent = ''; status.className = 'contact-status'; }

                    // Turnstile (only when a site key is configured). The token is
                    // verified server-side by the courses.esdesigns.org endpoints —
                    // a token alone is not a security control.
                    const turnstileOn = !!(window.esdTurnstile && window.esdTurnstile.enabled());
                    const captchaToken = turnstileOn ? window.esdTurnstile.getToken(form) : '';
                    if (turnstileOn && !captchaToken) {
                        if (status) {
                            status.textContent = 'Please complete the verification check, then submit again.';
                            status.className = 'contact-status error';
                        }
                        btn.textContent = orig;
                        btn.disabled = false;
                        return;
                    }

                    let ok = false;
                    let alreadyOnList = false;

                    if (captureEndpoint) {
                        // Unified email capture — server-side POST to the courses
                        // endpoint, which writes to Beehiiv (the sender) and mirrors
                        // to Supabase. The Beehiiv API key never touches the client.
                        const source = form.getAttribute('data-source') || 'esdesigns.org';
                        try {
                            const res = await fetch(captureEndpoint, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ email: form.email.value, source, captchaToken })
                            });
                            ok = res.ok;
                        } catch { ok = false; }
                        if (ok && typeof gtag === 'function') {
                            gtag('event', 'email_capture', { source });
                        }
                    } else if (supabaseTable) {
                        // Collect form data as a plain object (skip _ control fields).
                        const data = {};
                        new FormData(form).forEach((val, key) => {
                            if (!key.startsWith('_')) data[key] = val;
                        });
                        // Convert checkbox values
                        form.querySelectorAll('input[type="checkbox"]').forEach(cb => {
                            data[cb.name] = cb.checked;
                        });

                        if (turnstileOn) {
                            // Verified server path — the endpoint checks the Turnstile
                            // token before inserting, so bots posting straight to
                            // Supabase can't get through.
                            try {
                                const res = await fetch('https://courses.esdesigns.org/api/form-submit', {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({ table: supabaseTable, data, captchaToken })
                                });
                                ok = res.ok;
                            } catch { ok = false; }
                        } else if (window.supabaseClient) {
                            // Direct Supabase insert (current behaviour until Turnstile
                            // is configured). Honeypot + timing trap still apply above.
                            const result = await window.supabaseClient.insertRecord(supabaseTable, data);
                            ok = result.success;
                            // An email already on the waitlist is a unique-constraint
                            // violation (Postgres 23505), not a real failure — the
                            // visitor is already in, so treat it as success.
                            if (!ok && supabaseTable === 'waitlist' &&
                                (result.code === '23505' ||
                                 /duplicate key|already exists/i.test(result.error || ''))) {
                                ok = true;
                                alreadyOnList = true;
                            }
                        }
                    } else {
                        // FormSubmit fallback
                        try {
                            const res = await fetch(form.action, { method: 'POST', body: new FormData(form) });
                            ok = res.ok;
                        } catch { ok = false; }
                    }

                    // Turnstile tokens are single-use — drop ours so the next submit
                    // gets a fresh one (the managed widget auto-refreshes).
                    if (turnstileOn && window.esdTurnstile) window.esdTurnstile.reset(form);

                    if (ok) {
                        let successMsg;
                        if (form.dataset.success) {
                            successMsg = form.dataset.success;
                        } else if (captureEndpoint) {
                            successMsg = "You're on the list — check your inbox.";
                        } else if (supabaseTable === 'waitlist') {
                            successMsg = alreadyOnList
                                ? "You're already on the list — we'll be in touch soon."
                                : "You're on the list! We'll be in touch soon.";
                        } else {
                            successMsg = "Sent! We'll be in touch soon.";
                        }
                        if (status) {
                            status.textContent = successMsg;
                            if (captureEndpoint || form.dataset.success) status.className = 'contact-status success';
                        }
                        form.reset();
                    } else {
                        if (status) {
                            status.textContent = captureEndpoint
                                ? 'Something went wrong — try again or email bwinchell@esdesigns.org.'
                                : 'Something went wrong. Try again.';
                            status.className = 'contact-status error';
                        }
                    }

                    btn.textContent = orig;
                    btn.disabled = false;
                });
            });
        }

    }

    wait(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}
