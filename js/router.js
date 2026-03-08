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

        // Update nav active state
        this.updateNav(path);
        this.currentRoute = path;

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
    }

    wait(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}
