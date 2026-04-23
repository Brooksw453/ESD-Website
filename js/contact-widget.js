/* ============================================
   Contact Widget - Floating action button
   with quick actions + contact form.

   Dialog behavior (WCAG 2.2 AA):
   - Panel is role="dialog" aria-modal="true"
   - aria-hidden toggles on open/close so screen readers can
     tell the state
   - Focus moves into the panel on open and returns to the FAB
     on close
   - Tab/Shift+Tab traps focus inside the panel while open
   - Escape closes the panel
   ============================================ */

(function() {
    'use strict';

    const widget = document.getElementById('contactWidget');
    const fab = document.getElementById('contactFab');
    const panel = document.getElementById('contactPanel');
    const closeBtn = document.getElementById('contactClose');
    const form = document.getElementById('contactForm');
    const formStatus = document.getElementById('contactFormStatus');

    if (!widget || !fab || !panel) return;

    let isOpen = false;
    // Remember which element opened the panel so we can return focus
    // on close (spec says return focus to the element that invoked the dialog).
    let lastTrigger = null;

    // Selectors for anything a keyboard user can land focus on inside the panel.
    const FOCUSABLE = [
        'a[href]',
        'button:not([disabled])',
        'input:not([disabled]):not([type="hidden"])',
        'select:not([disabled])',
        'textarea:not([disabled])',
        '[tabindex]:not([tabindex="-1"])'
    ].join(',');

    function getFocusable() {
        return Array.from(panel.querySelectorAll(FOCUSABLE))
            .filter(el => el.offsetParent !== null); // visible only
    }

    function open() {
        if (isOpen) return;
        lastTrigger = document.activeElement instanceof HTMLElement ? document.activeElement : fab;
        isOpen = true;
        widget.classList.add('open');
        fab.setAttribute('aria-expanded', 'true');
        panel.setAttribute('aria-hidden', 'false');

        // Move focus into the panel. Prefer the close button so the user
        // can dismiss immediately; fall back to first focusable.
        const first = closeBtn || getFocusable()[0];
        if (first) first.focus();
    }

    function close() {
        if (!isOpen) return;
        isOpen = false;
        widget.classList.remove('open');
        fab.setAttribute('aria-expanded', 'false');
        panel.setAttribute('aria-hidden', 'true');

        // Return focus to whatever opened the panel.
        if (lastTrigger && typeof lastTrigger.focus === 'function') {
            lastTrigger.focus();
        }
    }

    function toggle() {
        isOpen ? close() : open();
    }

    // Keep focus inside the panel while the dialog is open.
    function trapFocus(e) {
        if (!isOpen || e.key !== 'Tab') return;
        const focusable = getFocusable();
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) {
            e.preventDefault();
            last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
            e.preventDefault();
            first.focus();
        }
    }

    fab.addEventListener('click', toggle);
    closeBtn.addEventListener('click', close);

    // Close on outside click
    document.addEventListener('click', (e) => {
        if (isOpen && !widget.contains(e.target)) {
            close();
        }
    });

    // Close on Escape + trap Tab
    document.addEventListener('keydown', (e) => {
        if (!isOpen) return;
        if (e.key === 'Escape') close();
        else if (e.key === 'Tab') trapFocus(e);
    });

    // Form submission via Formsubmit.co
    if (form) {
        form.addEventListener('submit', (e) => {
            e.preventDefault();
            const submitBtn = form.querySelector('button[type="submit"]');
            const originalText = submitBtn.textContent;
            submitBtn.textContent = 'Sending...';
            submitBtn.disabled = true;

            const formData = new FormData(form);

            fetch(form.action, {
                method: 'POST',
                body: formData,
                headers: { 'Accept': 'application/json' }
            })
            .then(res => {
                if (res.ok) {
                    formStatus.textContent = 'Message sent! We\'ll get back to you soon.';
                    formStatus.className = 'contact-form-status success';
                    form.reset();
                } else {
                    formStatus.textContent = 'Something went wrong. Try emailing us directly.';
                    formStatus.className = 'contact-form-status error';
                }
            })
            .catch(() => {
                formStatus.textContent = 'Network error. Try emailing us directly.';
                formStatus.className = 'contact-form-status error';
            })
            .finally(() => {
                submitBtn.textContent = originalText;
                submitBtn.disabled = false;
                setTimeout(() => {
                    formStatus.textContent = '';
                    formStatus.className = 'contact-form-status';
                }, 5000);
            });
        });
    }
})();
