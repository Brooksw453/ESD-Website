/* ============================================================
   /connect/ — digital business card behavior
   - Blob-based vCard download so server MIME type doesn't matter
     (GitHub Pages serves .vcf as application/octet-stream, which
      is unreliable across mobile browsers).
   - GA4 event tracking using the site's existing property (the
     gtag function is initialized by ../js/analytics.js).
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

    document.addEventListener('DOMContentLoaded', function () {
        const btn = document.getElementById('save-contact');
        if (btn) btn.addEventListener('click', saveContact);
        trackQuickActions();
        track('view'); // page load = NFC scan / QR scan / direct hit
    });
})();
