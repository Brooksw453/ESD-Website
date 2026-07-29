/* ============================================
   Hash-Based Client-Side Router
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
            '/':                  'landing',
            '/elliptical':        'ee',
            '/vr':                'shared',
            '/vr/anatomy-physiology-lab': 'shared',
            '/education':         'ed',
            '/education/courses': 'ed',
            '/education/demos':        'ed',
            '/education/ally-pro':     'ed',
            '/education/audit':        'ed',
            '/education/wcag-course':  'ed',
            '/education/roadmap-tool': 'ed',
            '/ai':                'ed',
            '/vantura':           'ed',
            '/about':             'shared',
            '/privacy':           'shared',
        };

        // Legacy route redirects
        this.redirects = {
            '/elliptical-explorer':      '/elliptical',
            '/games':                    '/',
            '/education/document-ally':  '/education/ally-pro',
            '/education/ally':           '/education/ally-pro',
        };

        // Page metadata for SEO
        this.meta = {
            '/': {
                title: 'ES Designs | Teaching With AI in Higher Education + Title II Accessibility',
                description: 'Most colleges are policing AI. ES Designs helps you teach it — practical, evidence-based AI courses and workshops for higher ed, plus ADA Title II accessibility compliance. Built by a 21-year educator. Start the free AI course.'
            },
            '/elliptical': {
                title: 'Elliptical Explorer | VR Fitness Adventure for Meta Quest',
                description: 'A VR fitness adventure where your real elliptical movement powers gameplay. Branching tracks, collectible gems, and timed challenges on Meta Quest.'
            },
            '/education': {
                title: 'ES Designs Education Technology | Adaptive Learning Courses & Document Accessibility',
                description: 'Adaptive learning courses and AI-powered document accessibility for higher education. White-label course platform with integrated payments. Document Ally Pro for free AI-powered WCAG 2.2 document remediation.'
            },
            '/education/courses': {
                title: 'Adaptive Learning Platform | White-Label Course Platform by ES Designs',
                description: 'White-label course platform with integrated payments, admin dashboard, and AI-powered adaptive learning. Built for workforce development and continuing education.'
            },
            '/education/demos': {
                title: 'White-Label Platform Demos | ES Designs Education Technology',
                description: 'See the ES Designs adaptive learning platform in action. Explore live demo platforms for Westlake University and Cardinal Academy — each fully branded and customized.'
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
                description: 'Host your program\'s own 360 videos and deliver them to the Quest headsets you already own. No per-student fees. Offline playback. Start a free pilot.'
            },
            '/about': {
                title: 'About ES Designs | Brooks Winchell',
                description: 'About ES Designs and founder Brooks Winchell. Building the integrated Title II compliance planning system for higher education from Massachusetts.'
            },
            '/privacy': {
                title: 'Privacy Policy | ES Designs',
                description: 'Privacy policy for ES Designs compliance planning, audit, document remediation, and training tools. No data collection beyond what each tool requires; no tracking, transparent accounts.'
            },
            '/vr': {
                title: 'VR Development | ES Designs Immersive Learning',
                description: 'Immersive learning for Meta Quest from ES Designs. Vantura delivers your program\'s own 360 video to the headsets you already own, alongside the Anatomy & Physiology Lab and the Elliptical Explorer fitness adventure.'
            },
            '/vr/anatomy-physiology-lab': {
                title: 'Anatomy & Physiology Lab | VR Learning for Meta Quest',
                description: 'An immersive, self-directed VR learning adventure exploring human anatomy and physiology — interactive skeletal, heart, and exploration labs with learning modules and knowledge checks, on Meta Quest.'
            }
        };

        // Navigation configurations per section
        this.navConfigs = {
            landing: {
                brand: 'ES Designs',
                brandHref: '#/',
                // Top nav: the two product lines (Accessibility + AI), Courses,
                // VR Development, then About. "Free AI course" was dropped as
                // redundant with the AI course funnel in the hero.
                links: [
                    { href: '#/education', label: 'Accessibility' },
                    { href: '#/ai', label: 'AI in Higher Ed' },
                    { href: '#/education/courses', label: 'Courses' },
                    { href: '#/vr', label: 'VR Development' },
                    { href: '#/about', label: 'About' },
                ]
            },
            ee: {
                brand: '<span class="nav-brand-parent">ES Designs</span> <span class="nav-brand-sep">&rsaquo;</span> Elliptical Explorer',
                brandHref: '#/elliptical',
                links: [
                    { href: '#/', label: 'Home' },
                    { href: '#/vr', label: 'VR Development' },
                    { href: '#/about', label: 'About' },
                ]
            },
            ed: {
                brand: '<span class="nav-brand-parent">ES Designs</span> <span class="nav-brand-sep">&rsaquo;</span> Education',
                brandHref: '#/education',
                // Slim nav: the Plan->Monitor step rail (system-strip, on the hub
                // and every product page) already handles product wayfinding, so
                // the products group under "Accessibility" (the #/education hub).
                // The footer keeps the full product index.
                links: [
                    { href: '#/', label: 'Home' },
                    { href: '#/ai', label: 'AI in Higher Ed' },
                    { href: '#/education', label: 'Accessibility' },
                    { href: '#/education/courses', label: 'Adaptive Learning' },
                    { href: '#/about', label: 'About' },
                ]
            },
            shared: {
                brand: 'ES Designs',
                brandHref: '#/',
                // Top nav mirrors landing: Accessibility, AI, Courses, VR, About.
                // Vantura is deliberately NOT in the top nav — the VR Development hub
                // leads with it, and the footers carry the full product index.
                links: [
                    { href: '#/education', label: 'Accessibility' },
                    { href: '#/ai', label: 'AI in Higher Ed' },
                    { href: '#/education/courses', label: 'Courses' },
                    { href: '#/vr', label: 'VR Development' },
                    { href: '#/about', label: 'About' },
                ]
            }
        };

        // Footer configurations per section. Mirror the top-nav link order
        // (Accessibility / Courses / VR / About) on landing/shared so the
        // footer reads as a parallel index rather than a different list.
        // Privacy Policy stays as the trailing legal link everywhere.
        this.footerConfigs = {
            landing: [
                { href: '#/education', label: 'Accessibility' },
                { href: '#/ai', label: 'AI in Higher Ed' },
                { href: '#/education/courses', label: 'Courses' },
                { href: '#/vr', label: 'VR Development' },
                { href: '#/vantura', label: 'Vantura' },
                { href: '#/about', label: 'About' },
                { href: '/blog/', label: 'Blog' },
                { href: '/connect/', label: 'Connect' },
                { href: '#/privacy', label: 'Privacy Policy' },
            ],
            ee: [
                { href: '#/', label: 'Home' },
                { href: '#/vr', label: 'VR Development' },
                { href: '#/education', label: 'Accessibility' },
                { href: '#/education/courses', label: 'Courses' },
                { href: '#/about', label: 'About' },
                { href: '/connect/', label: 'Connect' },
                { href: '#/privacy', label: 'Privacy Policy' },
            ],
            ed: [
                { href: '#/', label: 'Home' },
                { href: '#/ai', label: 'AI in Higher Ed' },
                { href: '#/education/roadmap-tool', label: 'Compliance Roadmap Tool' },
                { href: '#/education/audit', label: 'AI Website Audit' },
                { href: '#/education/wcag-course', label: 'WCAG 2.2 Courses' },
                { href: '#/education/ally-pro', label: 'Document Ally Pro' },
                { href: '#/education/courses', label: 'Adaptive Learning' },
                { href: '#/vr', label: 'VR Development' },
                { href: '#/vantura', label: 'Vantura' },
                { href: '#/about', label: 'About' },
                { href: '/blog/', label: 'Blog' },
                { href: '/connect/', label: 'Connect' },
                { href: '#/privacy', label: 'Privacy Policy' },
            ],
            shared: [
                { href: '#/', label: 'Home' },
                { href: '#/education', label: 'Accessibility' },
                { href: '#/ai', label: 'AI in Higher Ed' },
                { href: '#/education/courses', label: 'Courses' },
                { href: '#/vr', label: 'VR Development' },
                { href: '#/vantura', label: 'Vantura' },
                { href: '#/about', label: 'About' },
                { href: '/blog/', label: 'Blog' },
                { href: '/connect/', label: 'Connect' },
                { href: '#/privacy', label: 'Privacy Policy' },
            ]
        };

        window.addEventListener('hashchange', () => this.handleRoute());
    }

    register(path, fragmentUrl) {
        this.routes[path] = fragmentUrl;
    }

    async start() {
        await this.handleRoute();
    }

    async handleRoute() {
        if (this.transitioning) return;

        const hash = window.location.hash || '#/';
        let path = hash.replace('#', '') || '/';

        // Handle legacy redirects
        if (this.redirects[path]) {
            window.location.hash = '#' + this.redirects[path];
            return;
        }

        if (path === this.currentRoute) return;

        this.transitioning = true;

        // Determine section
        const section = this.sectionMap[path] || 'shared';

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
                page_path: path,
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

        // Conditional music player visibility
        const musicPlayerEl = document.getElementById('musicPlayer');
        if (musicPlayerEl) {
            if (section === 'ee') {
                musicPlayerEl.style.display = '';
            } else {
                musicPlayerEl.style.display = 'none';
                if (window.musicPlayer && window.musicPlayer.isExpanded) {
                    window.musicPlayer.collapse();
                }
            }
        }

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
                        <a href="#/" class="neon-btn" style="margin-top: 24px;">Go Home</a>
                    </div>
                </div>`;
        }

        try {
            const response = await fetch(url);
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
        const config = this.navConfigs[section] || this.navConfigs.landing;
        const navBrand = document.querySelector('.nav-brand');
        const navLinks = document.getElementById('navLinks');

        if (navBrand) {
            navBrand.innerHTML = config.brand;
            navBrand.href = config.brandHref;
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
        const config = this.footerConfigs[section] || this.footerConfigs.landing;
        const footerLinks = document.querySelector('.footer-links');

        if (footerLinks) {
            let html = config.map(link =>
                `<a href="${link.href}">${link.label}</a>`
            ).join('');

            // Add side projects link in footer
            if (section !== 'landing') {
                html += '<a href="https://github.com/brooksw453" target="_blank" rel="noopener">Side Projects</a>';
            }

            footerLinks.innerHTML = html;
        }
    }

    updateNavActive(path) {
        document.querySelectorAll('.nav-link').forEach(link => {
            const href = link.getAttribute('href');
            const linkPath = href ? href.replace('#', '') : '';
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
    }

    bindPageEvents(path) {
        // Soundtrack play buttons on Elliptical Explorer page
        if (path === '/elliptical') {
            document.querySelectorAll('[data-play-track]').forEach(btn => {
                btn.addEventListener('click', () => {
                    const title = btn.getAttribute('data-play-track');
                    if (window.musicPlayer) {
                        window.musicPlayer.playTrackByTitle(title);
                    }
                });
            });
        }

        // Shared: scroll-to buttons, inline forms, compact tiles
        // (all education pages, the AI page, and the home/landing page —
        // all reuse the same inline-form + capture components)
        if (path.startsWith('/education') || path === '/ai' || path === '/vantura' || path === '/') {
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
                        if (captureEndpoint) {
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
                            if (captureEndpoint) status.className = 'contact-status success';
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
