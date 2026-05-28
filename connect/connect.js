/* ============================================================
   /connect/ — digital business card behavior
   - Blob-based vCard download so server MIME type doesn't matter
     (GitHub Pages serves .vcf as application/octet-stream, which
      is unreliable across mobile browsers).
   - GA4 event tracking using the site's existing property (the
     gtag function is initialized by ../js/analytics.js).
   - Local hamburger toggle: /connect/ is a standalone page so it
     doesn't get app.js. We mirror app.js's nav behavior here.
   ============================================================ */

(function () {
    'use strict';

    function track(event, params) {
        if (typeof gtag === 'function') {
            gtag('event', event, Object.assign({ event_category: 'business_card' }, params || {}));
        }
    }

    async function saveContact() {
        track('save_contact_attempt');
        try {
            const res = await fetch('brooks.vcf', { cache: 'no-store' });
            if (!res.ok) throw new Error('fetch failed: ' + res.status);
            const text = await res.text();
            const blob = new Blob([text], { type: 'text/vcard;charset=utf-8' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'brooks-winchell.vcf';
            document.body.appendChild(a);
            a.click();
            a.remove();
            setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
            track('save_contact');
        } catch (err) {
            // Fallback: direct navigation to the static .vcf
            track('save_contact_fallback');
            window.location.href = 'brooks.vcf';
        }
    }

    function trackQuickActions() {
        const actions = document.querySelectorAll('[data-track]');
        actions.forEach(function (el) {
            el.addEventListener('click', function () {
                track('quick_action', { action: el.getAttribute('data-track') });
            });
        });
    }

    function wireHamburger() {
        // /connect/ doesn't load app.js, so add the toggle here.
        const hamburger = document.getElementById('hamburger');
        const navLinks = document.getElementById('navLinks');
        if (!hamburger || !navLinks) return;
        hamburger.addEventListener('click', function () {
            const open = hamburger.classList.toggle('open');
            navLinks.classList.toggle('open');
            hamburger.setAttribute('aria-expanded', open ? 'true' : 'false');
        });
        // Close menu when a nav link is tapped
        navLinks.addEventListener('click', function (e) {
            if (e.target.tagName === 'A') {
                hamburger.classList.remove('open');
                navLinks.classList.remove('open');
                hamburger.setAttribute('aria-expanded', 'false');
            }
        });
    }

    document.addEventListener('DOMContentLoaded', function () {
        const btn = document.getElementById('save-contact');
        if (btn) btn.addEventListener('click', saveContact);
        wireHamburger();
        trackQuickActions();
        track('view'); // page load = NFC scan / QR scan / direct hit
    });
})();
