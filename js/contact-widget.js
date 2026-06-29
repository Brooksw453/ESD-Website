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

    // Anti-bot signals: a real person opens the panel before submitting.
    let hasOpened = false;
    let openedAt = 0;

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
        hasOpened = true;
        openedAt = Date.now();
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

    // Form submission. Primary path is Supabase (always available, no
    // activation step, CSP-allowed); FormSubmit.co is kept only as a
    // last-ditch fallback for the rare case the Supabase client failed to load.
    if (form) {
        const supabaseTable = form.getAttribute('data-supabase-table');

        // Anti-bot: add an off-screen honeypot. The existing _honey field is
        // display:none, which the current spam bot skips; an off-screen field
        // catches more of them. The `_` prefix keeps it out of the data sent
        // to Supabase.
        if (!form.querySelector('input[name="_hp"]')) {
            const hp = document.createElement('input');
            hp.type = 'text';
            hp.name = '_hp';
            hp.tabIndex = -1;
            hp.autocomplete = 'off';
            hp.setAttribute('aria-hidden', 'true');
            hp.style.cssText = 'position:absolute;left:-9999px;width:1px;height:1px;opacity:0;';
            form.appendChild(hp);
        }

        // Show a Turnstile widget when configured (inert otherwise).
        if (window.esdTurnstile) window.esdTurnstile.mount(form);

        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const submitBtn = form.querySelector('button[type="submit"]');
            const originalText = submitBtn.textContent;
            submitBtn.textContent = 'Sending...';
            submitBtn.disabled = true;

            // Honeypot + behaviour trap. A real person opens the panel and takes
            // a moment to type. If a bot filled either honeypot, never opened the
            // panel, or submitted almost instantly, fake success and store nothing.
            const honey = form.querySelector('input[name="_honey"]');
            const honey2 = form.querySelector('input[name="_hp"]');
            if ((honey && honey.value) || (honey2 && honey2.value) ||
                !hasOpened || (Date.now() - openedAt < 1200)) {
                formStatus.textContent = 'Message sent! We\'ll get back to you soon.';
                formStatus.className = 'contact-form-status success';
                form.reset();
                submitBtn.textContent = originalText;
                submitBtn.disabled = false;
                return;
            }

            // Turnstile (only when a site key is configured). The token is
            // verified server-side — a token alone is not a security control.
            const turnstileOn = !!(window.esdTurnstile && window.esdTurnstile.enabled());
            const captchaToken = turnstileOn ? window.esdTurnstile.getToken(form) : '';
            if (turnstileOn && !captchaToken) {
                formStatus.textContent = 'Please complete the verification check, then send again.';
                formStatus.className = 'contact-form-status error';
                submitBtn.textContent = originalText;
                submitBtn.disabled = false;
                return;
            }

            // Collect form fields as a plain object, excluding `_`-prefixed
            // control/honeypot fields.
            const data = {};
            new FormData(form).forEach((val, key) => {
                if (!key.startsWith('_')) data[key] = val;
            });

            let ok = false;

            if (turnstileOn) {
                // Verified server path — the endpoint checks the Turnstile token
                // before inserting, so bots posting straight to Supabase can't pass.
                try {
                    const res = await fetch('https://courses.esdesigns.org/api/form-submit', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ table: supabaseTable || 'messages', data, captchaToken })
                    });
                    ok = res.ok;
                } catch { ok = false; }
            } else if (supabaseTable && window.supabaseClient) {
                // Direct Supabase insert (current behaviour until Turnstile is set).
                const result = await window.supabaseClient.insertRecord(supabaseTable, data);
                ok = result.success;
            } else {
                // Fallback: FormSubmit.co (only if Supabase client unavailable)
                try {
                    const res = await fetch(form.action, {
                        method: 'POST',
                        body: new FormData(form),
                        headers: { 'Accept': 'application/json' }
                    });
                    ok = res.ok;
                } catch {
                    ok = false;
                }
            }

            if (turnstileOn && window.esdTurnstile) window.esdTurnstile.reset(form);

            if (ok) {
                formStatus.textContent = 'Message sent! We\'ll get back to you soon.';
                formStatus.className = 'contact-form-status success';
                form.reset();
            } else {
                formStatus.textContent = 'Something went wrong. Email us directly at bwinchell@esdesigns.org.';
                formStatus.className = 'contact-form-status error';
            }

            submitBtn.textContent = originalText;
            submitBtn.disabled = false;
            setTimeout(() => {
                formStatus.textContent = '';
                formStatus.className = 'contact-form-status';
            }, 6000);
        });
    }
})();
