/* ============================================
   Contact Widget - Floating action button
   with quick actions + contact form
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

    function toggle() {
        isOpen = !isOpen;
        widget.classList.toggle('open', isOpen);
        fab.setAttribute('aria-expanded', isOpen);
    }

    function close() {
        isOpen = false;
        widget.classList.remove('open');
        fab.setAttribute('aria-expanded', 'false');
    }

    fab.addEventListener('click', toggle);
    closeBtn.addEventListener('click', close);

    // Close on outside click
    document.addEventListener('click', (e) => {
        if (isOpen && !widget.contains(e.target)) {
            close();
        }
    });

    // Close on Escape
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && isOpen) close();
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
