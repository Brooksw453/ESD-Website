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
            '/education/ally':    'ed',
            '/education/courses': 'ed',
            '/education/demos':        'ed',
            '/education/ally-pro':     'ed',
            '/education/audit':        'ed',
            '/education/wcag-course':  'ed',
            '/education/roadmap-tool': 'ed',
            '/about':             'shared',
            '/privacy':           'shared',
        };

        // Legacy route redirects
        this.redirects = {
            '/elliptical-explorer':      '/elliptical',
            '/ai':                       '/education',
            '/games':                    '/',
            '/education/document-ally':  '/education/ally',
        };

        // Page metadata for SEO
        this.meta = {
            '/': {
                title: 'ES Designs | Title II Compliance Planning for Higher Ed',
                description: 'ES Designs builds the integrated Title II compliance planning system for higher education. Home of the Compliance Roadmap Tool, AI Website Audit, and Document Ally Pro.'
            },
            '/elliptical': {
                title: 'Elliptical Explorer | VR Fitness Adventure for Meta Quest',
                description: 'A VR fitness adventure where your real elliptical movement powers gameplay. Branching tracks, collectible gems, and timed challenges on Meta Quest.'
            },
            '/education': {
                title: 'ES Designs Education Technology | Adaptive Learning Courses & Document Accessibility',
                description: 'Adaptive learning courses and AI-powered document accessibility for higher education. White-label course platform with integrated payments. Document Ally for WCAG 2.2 compliance.'
            },
            '/education/ally': {
                title: 'Document Ally | AI-Powered WCAG 2.2 Document Accessibility',
                description: 'Convert inaccessible documents to WCAG 2.2-compliant Word files with AI. Free to use, no account required. Built for higher education institutions.'
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
                title: 'Document Ally Pro | Coming Soon — Join the Waitlist',
                description: 'The institutional version of Document Ally. AI-powered WCAG 2.2 document remediation for higher ed. Join the waitlist for early access and pilot pricing.'
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
                description: 'Immersive, self-directed learning experiences from ES Designs. The Anatomy & Physiology Lab brings interactive human anatomy to Meta Quest, alongside the Elliptical Explorer fitness adventure.'
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
                // Top nav stays focused on the compliance system. VR is reached
                // from the landing "VR Development" panel and the footer.
                links: [
                    { href: '#/education', label: 'Accessibility' },
                    { href: '#/education/courses', label: 'Courses' },
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
                links: [
                    { href: '#/', label: 'Home' },
                    { href: '#/education/roadmap-tool', label: 'Roadmap Tool' },
                    { href: '#/education/audit', label: 'Audit Tool' },
                    { href: '#/education/wcag-course', label: 'WCAG Courses' },
                    { href: '#/education/ally-pro', label: 'Document Ally Pro' },
                    { href: '#/education/courses', label: 'Adaptive Learning' },
                    { href: '#/about', label: 'About' },
                ]
            },
            shared: {
                brand: 'ES Designs',
                brandHref: '#/',
                // Compliance-focused top nav (matches landing). VR via footer.
                links: [
                    { href: '#/education', label: 'Accessibility' },
                    { href: '#/education/courses', label: 'Courses' },
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
                { href: '#/education/courses', label: 'Courses' },
                { href: '#/vr', label: 'VR Development' },
                { href: '#/about', label: 'About' },
                { href: '#/privacy', label: 'Privacy Policy' },
            ],
            ee: [
                { href: '#/', label: 'Home' },
                { href: '#/vr', label: 'VR Development' },
                { href: '#/education', label: 'Accessibility' },
                { href: '#/education/courses', label: 'Courses' },
                { href: '#/about', label: 'About' },
                { href: '#/privacy', label: 'Privacy Policy' },
            ],
            ed: [
                { href: '#/', label: 'Home' },
                { href: '#/education/roadmap-tool', label: 'Compliance Roadmap Tool' },
                { href: '#/education/audit', label: 'AI Website Audit' },
                { href: '#/education/wcag-course', label: 'WCAG 2.2 Courses' },
                { href: '#/education/ally-pro', label: 'Document Ally Pro' },
                { href: '#/education/courses', label: 'Adaptive Learning' },
                { href: '#/education/ally', label: 'Document Ally (Free)' },
                { href: '#/vr', label: 'VR Development' },
                { href: '#/about', label: 'About' },
                { href: '#/privacy', label: 'Privacy Policy' },
            ],
            shared: [
                { href: '#/', label: 'Home' },
                { href: '#/education', label: 'Accessibility' },
                { href: '#/education/courses', label: 'Courses' },
                { href: '#/vr', label: 'VR Development' },
                { href: '#/about', label: 'About' },
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
                `<a href="${link.href}" class="nav-link">${link.label}</a>`
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

        // Shared: scroll-to buttons, inline forms, compact tiles (all education pages)
        if (path.startsWith('/education')) {
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
            document.querySelectorAll('.ed-inline-contact form, form[data-supabase-table]:not(#contactForm)').forEach(form => {
                const status = form.querySelector('.contact-status') || form.parentElement.querySelector('.contact-status');
                const supabaseTable = form.getAttribute('data-supabase-table');

                form.addEventListener('submit', async (e) => {
                    e.preventDefault();
                    const btn = form.querySelector('button[type="submit"]');
                    const orig = btn.textContent;
                    btn.textContent = 'Sending...';
                    btn.disabled = true;
                    if (status) { status.textContent = ''; status.className = 'contact-status'; }

                    let ok = false;

                    if (supabaseTable && window.supabaseClient) {
                        // Supabase submission — collect form data as plain object
                        const data = {};
                        new FormData(form).forEach((val, key) => {
                            if (!key.startsWith('_')) data[key] = val;
                        });
                        // Convert checkbox values
                        form.querySelectorAll('input[type="checkbox"]').forEach(cb => {
                            data[cb.name] = cb.checked;
                        });
                        const result = await window.supabaseClient.insertRecord(supabaseTable, data);
                        ok = result.success;
                    } else {
                        // FormSubmit fallback
                        try {
                            const res = await fetch(form.action, { method: 'POST', body: new FormData(form) });
                            ok = res.ok;
                        } catch { ok = false; }
                    }

                    if (ok) {
                        const successMsg = supabaseTable === 'waitlist'
                            ? "You're on the list! We'll be in touch soon."
                            : "Sent! We'll be in touch soon.";
                        if (status) status.textContent = successMsg;
                        form.reset();
                    } else {
                        if (status) { status.textContent = 'Something went wrong. Try again.'; status.className = 'contact-status error'; }
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
