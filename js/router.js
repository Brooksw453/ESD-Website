/* ============================================
   Hash-Based Client-Side Router
   Enables SPA navigation with music persistence
   ============================================ */

class Router {
    constructor(scrollAnimations) {
        this.routes = {};
        this.currentRoute = null;
        this.contentCache = {};
        this.container = document.getElementById('page-content');
        this.scrollAnimations = scrollAnimations;
        this.transitioning = false;

        // Page metadata for SEO
        this.meta = {
            '/': {
                title: 'Education Simulation Designs | VR, Games & AI',
                description: 'Education Simulation Designs builds immersive VR experiences, browser-based indie games, and custom AI agent solutions.'
            },
            '/vr': {
                title: 'VR Development - Elliptical Explorer | ES Designs',
                description: 'Elliptical Explorer is a VR fitness adventure for Meta Quest. Transform your workout with immersive environments, branching tracks, and an original soundtrack.'
            },
            '/games': {
                title: 'Indie Games - Neon Rail & Block Blast | ES Designs',
                description: 'Play browser-based indie games built with vanilla JavaScript and HTML5 Canvas. No downloads required.'
            },
            '/ai': {
                title: 'AI Agent Development | ES Designs',
                description: 'Custom AI agent development using Microsoft Copilot Studio and Azure AI for education and enterprise automation.'
            },
            '/privacy': {
                title: 'Privacy Policy | ES Designs',
                description: 'Privacy policy for Education Simulation Designs VR applications. No data collection, no tracking, no accounts.'
            }
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
        const path = hash.replace('#', '') || '/';

        if (path === this.currentRoute) return;

        this.transitioning = true;

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

        // Re-observe scroll animations
        if (this.scrollAnimations) {
            this.scrollAnimations.refresh();
        }

        // Update nav active state and page metadata
        this.updateNav(path);
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

    updateNav(path) {
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
        // Soundtrack play buttons on VR page
        if (path === '/vr') {
            document.querySelectorAll('[data-play-track]').forEach(btn => {
                btn.addEventListener('click', () => {
                    const title = btn.getAttribute('data-play-track');
                    if (window.musicPlayer) {
                        window.musicPlayer.playTrackByTitle(title);
                    }
                });
            });
        }

        // Game embed toggles on Games page
        if (path === '/games') {
            document.querySelectorAll('.game-play-toggle').forEach(btn => {
                btn.addEventListener('click', () => {
                    const card = btn.closest('.game-card');
                    const container = card.querySelector('.game-embed-container');
                    const iframe = container.querySelector('.game-embed-iframe');
                    const gameUrl = btn.getAttribute('data-game-url');

                    if (!iframe.src || iframe.src === 'about:blank') {
                        iframe.src = gameUrl;
                    }

                    // Move container to body so position:fixed isn't broken
                    // by parent transforms/filters (neon-card, animations, etc.)
                    container._originalParent = card;
                    document.body.appendChild(container);

                    // Open game fullscreen
                    container.style.display = 'flex';
                    container.classList.add('game-fullscreen');
                    document.body.classList.add('game-active');
                    btn.style.display = 'none';

                    // Ensure site music is playing (muted games rely on site soundtrack)
                    if (window.musicPlayer) {
                        window.musicPlayer.ensurePlaying();
                        if (window.musicPlayer.isMuted) {
                            window.musicPlayer.unmute();
                        }
                    }
                });
            });

            document.querySelectorAll('.game-embed-close').forEach(closeBtn => {
                closeBtn.addEventListener('click', () => {
                    const container = closeBtn.closest('.game-embed-container');
                    const originalCard = container._originalParent;
                    const playBtn = originalCard ? originalCard.querySelector('.game-play-toggle') : null;
                    const iframe = container.querySelector('.game-embed-iframe');

                    // Close fullscreen game
                    container.classList.remove('game-fullscreen');
                    document.body.classList.remove('game-active');
                    container.style.display = 'none';
                    iframe.src = 'about:blank';

                    // Move container back to its original card
                    if (originalCard) {
                        originalCard.appendChild(container);
                    }
                    if (playBtn) playBtn.style.display = '';
                });
            });
        }

    }

    wait(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}
