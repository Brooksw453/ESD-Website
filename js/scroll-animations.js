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
            threshold: 0.1,
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
