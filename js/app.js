/* ============================================
   App Bootstrap & Orchestration
   ============================================ */

(function() {
    'use strict';

    // Initialize particle system (exposed on window for audio reactivity)
    // Start stopped — router will start it only on Elliptical Explorer pages
    window.particleSystem = new ParticleSystem('particle-canvas');
    window.particleSystem.stop();

    // Initialize scroll animations
    const scrollAnimations = new ScrollAnimations();

    // Initialize music player
    window.musicPlayer = new MusicPlayer();

    // Initialize router with new two-brand route structure
    const router = new Router(scrollAnimations);
    router.register('/', 'pages/landing.html');
    router.register('/elliptical', 'pages/elliptical.html');
    router.register('/education', 'pages/education.html');
    router.register('/education/ally', 'pages/education-ally.html');
    router.register('/education/courses', 'pages/education-courses.html');
    router.register('/education/demos', 'pages/education-demos.html');
    router.register('/education/ally-pro', 'pages/education-ally-pro.html');
    router.register('/education/audit', 'pages/education-audit.html');
    router.register('/education/wcag-course', 'pages/education-wcag-course.html');
    router.register('/education/roadmap-tool', 'pages/education-roadmap.html');
    router.register('/about', 'pages/about.html');
    router.register('/privacy', 'pages/privacy.html');
    router.start();

    // --- Header scroll effect + Back to Top ---
    const header = document.getElementById('siteHeader');
    const backToTop = document.getElementById('backToTop');

    window.addEventListener('scroll', () => {
        const scrollY = window.scrollY;
        if (scrollY > 50) {
            header.classList.add('scrolled');
        } else {
            header.classList.remove('scrolled');
        }
        if (backToTop) {
            if (scrollY > 300) {
                backToTop.classList.add('visible');
            } else {
                backToTop.classList.remove('visible');
            }
        }
    }, { passive: true });

    if (backToTop) {
        backToTop.addEventListener('click', () => {
            window.scrollTo({ top: 0, behavior: 'smooth' });
        });
    }

    // --- Hamburger menu toggle ---
    const hamburger = document.getElementById('hamburger');
    const navLinks = document.getElementById('navLinks');

    hamburger.addEventListener('click', () => {
        hamburger.classList.toggle('open');
        navLinks.classList.toggle('open');
    });

    // Close mobile nav when a link is clicked (event delegation for dynamic nav)
    navLinks.addEventListener('click', (e) => {
        if (e.target.closest('.nav-link')) {
            hamburger.classList.remove('open');
            navLinks.classList.remove('open');
        }
    });

    // --- Accordion toggles (event delegation for SPA-injected content) ---
    document.addEventListener('click', (e) => {
        const btn = e.target.closest('.accordion-toggle');
        if (!btn) return;
        btn.classList.toggle('active');
        const accordion = btn.closest('.featured-tool-card').querySelector('.featured-tool-accordion');
        if (accordion) accordion.classList.toggle('open');
    });

    // Register service worker for offline PWA support
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('/sw.js').catch(() => {});
    }
})();
