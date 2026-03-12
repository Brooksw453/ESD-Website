/* ============================================
   App Bootstrap & Orchestration
   ============================================ */

(function() {
    'use strict';

    // Initialize particle system (exposed on window for audio reactivity)
    window.particleSystem = new ParticleSystem('particle-canvas');

    // Initialize scroll animations
    const scrollAnimations = new ScrollAnimations();

    // Initialize music player
    window.musicPlayer = new MusicPlayer();

    // Initialize router
    const router = new Router(scrollAnimations);
    router.register('/', 'pages/home.html');
    router.register('/vr', 'pages/vr.html');
    router.register('/games', 'pages/games.html');
    router.register('/ai', 'pages/ai.html');
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

    // Close mobile nav when a link is clicked
    navLinks.querySelectorAll('.nav-link').forEach(link => {
        link.addEventListener('click', () => {
            hamburger.classList.remove('open');
            navLinks.classList.remove('open');
        });
    });

    // Register service worker for offline PWA support
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('/sw.js').catch(() => {});
    }
})();
