/* Blog newsletter capture (standalone).
 *
 * The blog is statically generated and does not load the SPA's router.js, so it
 * needs its own handler. Binds any form[data-capture-endpoint] and POSTs
 * { email, source } to the shared courses.esdesigns.org/api/subscribe endpoint,
 * which writes to Beehiiv (the sender) and mirrors to Supabase. The Beehiiv API
 * key never touches the client. Mirrors the unified-capture logic in router.js.
 *
 * CSP-safe: served from 'self' (no inline script); the endpoint host is allowed
 * in connect-src by the blog's "unified" CSP in tools/build_blog.py.
 */
(function () {
  function bindForm(form) {
    var endpoint = form.getAttribute('data-capture-endpoint');
    if (!endpoint) return;
    var source = form.getAttribute('data-source') || 'blog';
    var status = form.querySelector('.contact-status');
    var btn = form.querySelector('button[type="submit"]');

    form.addEventListener('submit', async function (e) {
      e.preventDefault();
      var original = btn ? btn.textContent : '';
      if (btn) {
        btn.textContent = 'Subscribing…';
        btn.disabled = true;
      }
      if (status) {
        status.textContent = '';
        status.className = 'contact-status';
      }

      var ok = false;
      try {
        var res = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: form.email.value, source: source })
        });
        ok = res.ok;
      } catch (err) {
        ok = false;
      }

      if (ok && typeof gtag === 'function') {
        gtag('event', 'email_capture', { source: source });
      }

      if (status) {
        status.textContent = ok
          ? "You're on the list — check your inbox."
          : 'Something went wrong — try again or email bwinchell@esdesigns.org.';
        status.className = ok ? 'contact-status success' : 'contact-status error';
      }
      if (ok) form.reset();

      if (btn) {
        btn.textContent = original;
        btn.disabled = false;
      }
    });
  }

  function init() {
    var forms = document.querySelectorAll('form[data-capture-endpoint]');
    for (var i = 0; i < forms.length; i++) bindForm(forms[i]);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
