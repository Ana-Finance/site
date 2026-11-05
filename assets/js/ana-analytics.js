/* Ana finance — mesure d'audience, chargée uniquement après consentement Axeptio.
   Remplacez ANA_GA4_ID par votre identifiant de flux GA4 (ou branchez Plausible/Matomo
   dans loadVendor()). Le journal local alimente le tableau de bord KPI du site. */
(function () {
  if (window.__anaAnalytics) return;
  var KEY = 'ana_analytics_v1';
  var SESSION_KEY = 'ana_session_v1';
  var GA4_ID = 'G-XXXXXXXXXX';
  var SESSION_MINUTES = 30;

  function read() {
    try { return JSON.parse(localStorage.getItem(KEY)) || null; } catch (e) { return null; }
  }
  function blank() {
    return { visitorId: null, firstSeen: null, consent: null, sessions: 0, views: [], events: [] };
  }
  function write(d) {
    try { localStorage.setItem(KEY, JSON.stringify(d)); } catch (e) {}
  }
  function uid() {
    return 'v' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
  }
  function pageName() {
    var t = decodeURIComponent(location.pathname.split('/').pop() || 'Accueil');
    return t.replace(/\.html$/i, '').replace(/^index$/, '') || 'Accueil';
  }
  function source() {
    var q = new URLSearchParams(location.search);
    var utm = q.get('utm_source');
    if (utm) return utm;
    if (!document.referrer) return 'Direct';
    try {
      var h = new URL(document.referrer).hostname.replace(/^www\./, '');
      if (h === location.hostname) return null;
      if (/google|bing|duckduckgo|ecosia|qwant/.test(h)) return 'Recherche';
      if (/linkedin|twitter|x\.com|facebook/.test(h)) return 'Social';
      return h;
    } catch (e) { return 'Direct'; }
  }

  var loaded = false;
  function loadVendor() {
    if (loaded || !GA4_ID || GA4_ID.indexOf('XXXX') > -1) return;
    loaded = true;
    var s = document.createElement('script');
    s.async = true;
    s.src = 'https://www.googletagmanager.com/gtag/js?id=' + GA4_ID;
    document.head.appendChild(s);
    window.dataLayer = window.dataLayer || [];
    window.gtag = function () { window.dataLayer.push(arguments); };
    window.gtag('js', new Date());
    window.gtag('config', GA4_ID, { anonymize_ip: true });
  }

  var api = {
    granted: false,
    setConsent: function (granted) {
      var d = read() || blank();
      d.consent = !!granted;
      write(d);
      this.granted = !!granted;
      if (granted) { loadVendor(); this.pageview(); }
    },
    pageview: function () {
      if (!this.granted) return;
      var now = Date.now();
      var d = read() || blank();
      if (!d.visitorId) { d.visitorId = uid(); d.firstSeen = now; }
      var last = 0;
      try { last = parseInt(sessionStorage.getItem(SESSION_KEY) || '0', 10) || 0; } catch (e) {}
      var isNew = !last || (now - last) > SESSION_MINUTES * 60000;
      if (isNew) d.sessions = (d.sessions || 0) + 1;
      try { sessionStorage.setItem(SESSION_KEY, String(now)); } catch (e) {}
      d.views.push({ t: now, page: pageName(), src: source(), newSession: isNew });
      if (d.views.length > 800) d.views = d.views.slice(-800);
      write(d);
      if (window.gtag) window.gtag('event', 'page_view', { page_title: pageName() });
    },
    track: function (name, props) {
      if (!this.granted) return;
      var d = read() || blank();
      d.events.push({ t: Date.now(), name: name, props: props || {} });
      if (d.events.length > 400) d.events = d.events.slice(-400);
      write(d);
      if (window.gtag) window.gtag('event', name, props || {});
    },
    data: function () { return read() || blank(); },
    reset: function () { write(blank()); }
  };
  window.__anaAnalytics = api;
  window.anaAnalytics = api;

  var prev = read();
  if (prev && prev.consent === true) { api.granted = true; loadVendor(); }

  function bind(sdk) {
    if (!sdk || !sdk.on) return false;
    sdk.on('cookies:complete', function (choices) {
      api.setConsent(!!(choices && (choices.google_analytics || choices.analytics || choices.ana_analytics)));
    });
    return true;
  }
  window._axcb = window._axcb || [];
  window._axcb.push(bind);

  document.addEventListener('click', function (e) {
    var a = e.target && e.target.closest && e.target.closest('a[href]');
    if (a && /(^|\/)demo\.html/i.test(a.getAttribute('href') || '')) api.track('cta_demo', { from: pageName() });
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { api.pageview(); });
  } else {
    api.pageview();
  }
})();
