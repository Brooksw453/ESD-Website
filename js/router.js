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
            '/education':         'ed',
            '/education/ally':    'ed',
            '/education/courses': 'ed',
            '/about':             'shared',
            '/privacy':           'shared',
        };

        // Legacy route redirects
        this.redirects = {
            '/vr':    '/elliptical',
            '/ai':    '/education',
            '/games': '/',
        };

        // Page metadata for SEO
        this.meta = {
            '/': {
                title: 'ES Designs | VR Fitness & Education Technology',
                description: 'ES Designs builds immersive VR fitness experiences and AI-powered education technology. Home of Elliptical Explorer and Document Ally.'
            },
            '/elliptical': {
                title: 'Elliptical Explorer | VR Fitness Adventure for Meta Quest',
                description: 'A VR fitness adventure where your real elliptical movement powers gameplay. Branching tracks, collectible gems, and timed challenges on Meta Quest.'
            },
            '/education': {
                title: 'ES Designs Education Technology | Document Accessibility & Adaptive Learning',
                description: 'AI-powered education technology for higher education. Document Ally for WCAG 2.2 compliance. Adaptive learning platform with AI tutoring.'
            },
            '/education/ally': {
                title: 'Document Ally | AI-Powered WCAG 2.2 Document Accessibility',
                description: 'Convert inaccessible documents to WCAG 2.2-compliant Word files with AI. Free to use, no account required. Built for higher education institutions.'
            },
            '/education/courses': {
                title: 'Adaptive Learning Platform | AI-Powered Courses by ES Designs',
                description: 'AI-powered adaptive learning courses that meet students where they are. Self-paced, with real-time AI tutoring and progress tracking.'
            },
            '/about': {
                title: 'About ES Designs | Brooks Winchell',
                description: 'About Education Simulation Designs and founder Brooks Winchell. Building immersive VR fitness and AI-powered education technology from Massachusetts.'
            },
            '/privacy': {
                title: 'Privacy Policy | ES Designs',
                description: 'Privacy policy for Education Simulation Designs VR applications. No data collection, no tracking, no accounts.'
            }
        };

        // Navigation configurations per section
        this.navConfigs = {
            landing: {
                brand: 'ES Designs',
                brandHref: '#/',
                links: [
                    { href: '#/elliptical', label: 'Elliptical Explorer' },
                    { href: '#/education', label: 'Education Tech' },
                    { href: '#/about', label: 'About' },
                ]
            },
            ee: {
                brand: '<span class="nav-brand-parent">ES Designs</span> <span class="nav-brand-sep">&rsaquo;</span> Elliptical Explorer',
                brandHref: '#/elliptical',
                links: [
                    { href: '#/', label: 'Home' },
                    { href: '#/about', label: 'About' },
                ]
            },
            ed: {
                brand: '<span class="nav-brand-parent">ES Designs</span> <span class="nav-brand-sep">&rsaquo;</span> Education',
                brandHref: '#/education',
                links: [
                    { href: '#/education/ally', label: 'Document Ally' },
                    { href: '#/education/courses', label: 'Adaptive Learning' },
                    { href: '#/about', label: 'About' },
                ]
            },
            shared: {
                brand: 'ES Designs',
                brandHref: '#/',
                links: [
                    { href: '#/elliptical', label: 'Elliptical Explorer' },
                    { href: '#/education', label: 'Education Tech' },
                    { href: '#/about', label: 'About' },
                ]
            }
        };

        // Footer configurations per section
        this.footerConfigs = {
            landing: [
                { href: '#/elliptical', label: 'Elliptical Explorer' },
                { href: '#/education', label: 'Education Technology' },
                { href: '#/about', label: 'About' },
                { href: '#/privacy', label: 'Privacy Policy' },
            ],
            ee: [
                { href: '#/', label: 'Home' },
                { href: '#/education', label: 'Education Technology' },
                { href: '#/about', label: 'About' },
                { href: '#/privacy', label: 'Privacy Policy' },
            ],
            ed: [
                { href: '#/', label: 'Home' },
                { href: '#/education/ally', label: 'Document Ally' },
                { href: '#/education/courses', label: 'Adaptive Learning' },
                { href: '#/elliptical', label: 'Elliptical Explorer' },
                { href: '#/about', label: 'About' },
                { href: '#/privacy', label: 'Privacy Policy' },
            ],
            shared: [
                { href: '#/', label: 'Home' },
                { href: '#/elliptical', label: 'Elliptical Explorer' },
                { href: '#/education', label: 'Education Technology' },
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
    }

    wait(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}
