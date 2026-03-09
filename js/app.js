/* ============================================
   App Bootstrap & Orchestration
   ============================================ */

(function() {
    'use strict';

    // Initialize particle system
    const particles = new ParticleSystem('particle-canvas');

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

    // --- Header scroll effect ---
    const header = document.getElementById('siteHeader');
    let lastScroll = 0;
    window.addEventListener('scroll', () => {
        const scrollY = window.scrollY;
        if (scrollY > 50) {
            header.classList.add('scrolled');
        } else {
            header.classList.remove('scrolled');
        }
        lastScroll = scrollY;
    }, { passive: true });

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
})();
