/* Prompt Craft tracker: no cookies, no IPs, no personal data.
   Honors Do Not Track. Does nothing unless data-endpoint is set. */
(function () {
  var tag = document.currentScript;
  var endpoint = tag && tag.getAttribute('data-endpoint');
  if (!endpoint) return;
  if (navigator.doNotTrack === '1' || window.doNotTrack === '1') return;

  var sid;
  try {
    sid = sessionStorage.getItem('pc_sid');
    if (!sid) {
      sid = (crypto.randomUUID ? crypto.randomUUID() : String(Math.random()).slice(2) + Date.now());
      sessionStorage.setItem('pc_sid', sid);
    }
  } catch (e) { sid = String(Math.random()).slice(2); }

  function refHost() {
    try { return document.referrer ? new URL(document.referrer).hostname : ''; } catch (e) { return ''; }
  }

  function send(event, detail) {
    var body = JSON.stringify({
      sid: sid, event: event, detail: detail || '',
      path: location.pathname, ref: refHost(), w: window.innerWidth
    });
    try {
      if (!(navigator.sendBeacon && navigator.sendBeacon(endpoint + '/collect', new Blob([body], { type: 'text/plain' })))) {
        fetch(endpoint + '/collect', { method: 'POST', body: body, keepalive: true, headers: { 'Content-Type': 'text/plain' } });
      }
    } catch (e) { /* analytics must never break the page */ }
  }

  window.pcTrack = function (e, d) { send(e, d); };
  send('pageview');

  // Module and FAQ opens
  document.querySelectorAll('details.module').forEach(function (d) {
    d.addEventListener('toggle', function () {
      if (d.open) send('module_open', (d.querySelector('.module-num') || {}).textContent);
    });
  });
  document.querySelectorAll('details.faq-item').forEach(function (d) {
    d.addEventListener('toggle', function () {
      if (d.open) send('faq_open', (d.querySelector('summary').childNodes[0].textContent || '').slice(0, 80));
    });
  });

  // Prompt builder: fire once per visit, never record what was typed
  var builderSent = false;
  document.querySelectorAll('.builder input').forEach(function (el) {
    el.addEventListener('input', function () {
      if (!builderSent) { builderSent = true; send('builder_used'); }
    });
  });

  // Enroll button clicks
  document.querySelectorAll('.btn-primary, .nav-cta, .price-cta').forEach(function (a) {
    a.addEventListener('click', function () { send('cta_click', a.className.split(' ')[0]); });
  });

  // Which sections people actually reach
  if ('IntersectionObserver' in window) {
    var seen = {};
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting && !seen[e.target.id]) { seen[e.target.id] = 1; send('section_view', e.target.id); }
      });
    }, { threshold: 0.35 });
    ['why', 'modules', 'outcomes', 'pricing', 'faq'].forEach(function (id) {
      var el = document.getElementById(id); if (el) io.observe(el);
    });
  }
})();
