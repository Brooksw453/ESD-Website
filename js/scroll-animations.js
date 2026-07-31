/* ============================================
   Scroll Animations
   IntersectionObserver-based reveal system
   ============================================ */

class ScrollAnimations {
    constructor() {
        this.observer = null;
        this.init();
    }

    init() {
        // Check for reduced motion preference
        if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
            // Show everything immediately
            document.querySelectorAll('[data-animate]').forEach(el => {
                el.classList.add('visible');
            });
            return;
        }

        this.observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('visible');
                    this.observer.unobserve(entry.target);
                }
            });
        }, {
            // threshold MUST stay 0. intersectionRatio is measured against the
            // element's OWN size, so an element taller than ~10x the viewport can
            // never reach a 0.1 ratio and would stay at opacity:0 forever. That is
            // exactly what happened to the privacy policy in the Quest browser
            // (6,939px of content; a 0.1 threshold needed a 744px-tall viewport
            // just to become reachable). rootMargin still delays the reveal until
            // the element is 50px in, so the animation reads the same.
            threshold: 0,
            rootMargin: '0px 0px -50px 0px'
        });

        this.observeAll();
    }

    observeAll() {
        document.querySelectorAll('[data-animate]:not(.visible)').forEach(el => {
            if (this.observer) {
                this.observer.observe(el);
            }
        });
    }

    // Call this after new content is injected (route change)
    refresh() {
        if (!this.observer) {
            // Reduced motion - just show everything
            document.querySelectorAll('[data-animate]').forEach(el => {
                el.classList.add('visible');
            });
            return;
        }
        this.observeAll();
    }
}
