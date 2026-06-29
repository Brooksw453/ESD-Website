/* ============================================
   Cloudflare Turnstile helper (marketing site)

   Renders a Turnstile widget into a form and tracks its token, so the
   form handlers (router.js, contact-widget.js) can send the token to the
   server endpoints that verify it (courses.esdesigns.org/api/*).

   INERT UNTIL CONFIGURED: set SITE_KEY below to your Turnstile *site key*
   (the public one). While it's empty, enabled() returns false and the
   forms behave exactly as before (honeypot + timing trap only). Turn it on
   only after the matching SECRET key is set in Vercel (TURNSTILE_SECRET_KEY)
   so the server actually verifies tokens — a token with no server check is
   just decoration.

   Use the SAME Turnstile widget as the course dashboard; just add the
   hostnames esdesigns.org and www.esdesigns.org to it in Cloudflare.
   ============================================ */

(function () {
    'use strict';

    // 🔑 Paste your Cloudflare Turnstile SITE key here to activate (public key).
    const SITE_KEY = '';

    const SCRIPT_SRC =
        'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';

    const tokens = new WeakMap(); // form element -> latest token string
    let scriptPromise = null;

    function enabled() {
        return !!SITE_KEY;
    }

    function loadScript() {
        if (window.turnstile) return Promise.resolve();
        if (scriptPromise) return scriptPromise;
        scriptPromise = new Promise((resolve, reject) => {
            const s = document.createElement('script');
            s.src = SCRIPT_SRC;
            s.async = true;
            s.defer = true;
            s.onload = () => resolve();
            s.onerror = () => reject(new Error('Turnstile failed to load'));
            document.head.appendChild(s);
        });
        return scriptPromise;
    }

    // Inject a widget container into the form (before the submit button) and
    // render Turnstile into it. Safe to call more than once per form.
    function mount(form) {
        if (!enabled() || !form) return;
        if (form.querySelector('.cf-turnstile-slot')) return;

        const slot = document.createElement('div');
        slot.className = 'cf-turnstile-slot';
        slot.style.margin = '0.5rem 0';

        const btn = form.querySelector('button[type="submit"]');
        if (btn && btn.parentNode) {
            btn.parentNode.insertBefore(slot, btn);
        } else {
            form.appendChild(slot);
        }

        loadScript()
            .then(() => {
                if (!window.turnstile) return;
                window.turnstile.render(slot, {
                    sitekey: SITE_KEY,
                    callback: (token) => tokens.set(form, token),
                    'expired-callback': () => tokens.delete(form),
                    'error-callback': () => tokens.delete(form),
                });
            })
            .catch(() => { /* network/script failure — getToken stays '' */ });
    }

    function getToken(form) {
        return tokens.get(form) || '';
    }

    // Clear the token after a submit consumes it (tokens are single-use). The
    // managed widget auto-refreshes, but clear our cache so a stale token isn't
    // reused on the next submit.
    function reset(form) {
        tokens.delete(form);
    }

    window.esdTurnstile = { enabled, mount, getToken, reset };
})();
