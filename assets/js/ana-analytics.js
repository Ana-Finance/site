/* Ana Finance — mesure d'audience (Plausible, sans cookie) et envoi des formulaires.
   La configuration est injectée au build dans des balises <meta> publiques :
     ana:analytics-domain / ana:analytics-script   → Plausible (aucune clé secrète)
     ana:supabase-url / ana:supabase-key           → enregistrement des demandes (fonction submit_lead uniquement)
   Sans configuration, rien n'est chargé ni envoyé. Aucune mesure dans l'aperçu de l'administration. */
(function () {
  if (window.__anaAnalytics) return;
  function meta(name) {
    var m = document.querySelector('meta[name="' + name + '"]');
    return m ? m.getAttribute('content') || '' : '';
  }
  var preview = /[?&]cms-preview=/.test(location.search) || window.top !== window.self;
  var domain = meta('ana:analytics-domain');
  var src = meta('ana:analytics-script') || 'https://plausible.io/js/script.js';

  window.plausible = window.plausible || function () { (window.plausible.q = window.plausible.q || []).push(arguments); };
  if (domain && !preview && /^https:\/\//.test(src)) {
    var s = document.createElement('script');
    s.defer = true;
    s.src = src;
    s.setAttribute('data-domain', domain);
    document.head.appendChild(s);
  }

  function pageName() {
    var t = decodeURIComponent(location.pathname.split('/').pop() || 'index');
    return t.replace(/\.html$/i, '') || 'index';
  }

  var api = {
    enabled: !!domain && !preview,
    /** Événement personnalisé (doit être déclaré comme objectif dans Plausible pour être compté). */
    track: function (name, props) {
      if (!this.enabled || !/^[a-z][a-z0-9_]{1,60}$/.test(name)) return;
      window.plausible(name, { props: Object.assign({ page: pageName() }, props || {}) });
    },
    // Compatibilité avec l'ancienne API (bandeau de consentement) : Plausible ne dépose aucun cookie.
    setConsent: function () {},
    pageview: function () {}
  };
  window.__anaAnalytics = api;
  window.anaAnalytics = api;

  // Clics commerciaux : téléphone, e-mail, demande de démo, accès plateforme, ou attribut data-ana-event.
  document.addEventListener('click', function (e) {
    var a = e.target && e.target.closest && e.target.closest('a[href], [data-ana-event]');
    if (!a) return;
    var custom = a.getAttribute('data-ana-event');
    if (custom) return api.track(custom);
    var href = a.getAttribute('href') || '';
    if (/^tel:/i.test(href)) api.track('click_phone');
    else if (/^mailto:/i.test(href)) api.track('click_email');
    else if (/(^|\/)demo\.html/i.test(href)) api.track('cta_demo');
    else if (/anafinance\.lovable\.app/i.test(href)) api.track('click_platform');
  }, true);

  var ERRORS = {
    CONSENT_REQUIRED: 'Merci de cocher la case de consentement.',
    INVALID_EMAIL: 'Adresse e-mail invalide.',
    INVALID_NAME: 'Merci d\'indiquer votre nom.',
    FIELD_TOO_LONG: 'Un des champs est trop long.',
    RATE_LIMITED: 'Trop de demandes envoyées : réessayez dans quelques minutes.'
  };

  /** Enregistre une demande. Résout {sent:true} uniquement si le serveur a confirmé l'enregistrement.
      Sans configuration : {sent:false, configured:false}. Rejette avec un message lisible en cas d'échec. */
  window.anaSubmitLead = function (form, kind) {
    var url = meta('ana:supabase-url');
    var key = meta('ana:supabase-key');
    if (!url || !key || preview) return Promise.resolve({ sent: false, configured: false });
    var v = function (n) { var el = form.elements[n]; return el ? (el.type === 'checkbox' ? el.checked : String(el.value || '').trim()) : null; };
    var body = {
      p_form: kind, p_name: v('nom') || '', p_email: v('email') || '', p_company: v('societe') || null, p_phone: v('tel') || null,
      p_profile: v('profil') || null, p_message: v('message') || null, p_consent: v('consent') === true, p_page: pageName()
    };
    return fetch(url.replace(/\/$/, '') + '/rest/v1/rpc/submit_lead', {
      method: 'POST',
      headers: { 'content-type': 'application/json', apikey: key, authorization: 'Bearer ' + key },
      body: JSON.stringify(body)
    }).then(function (res) {
      if (res.ok) return { sent: true, configured: true };
      return res.json().catch(function () { return {}; }).then(function (j) {
        var code = Object.keys(ERRORS).filter(function (k) { return (j.message || '').indexOf(k) > -1; })[0];
        throw new Error(ERRORS[code] || 'L\'envoi a échoué. Réessayez ou écrivez-nous directement.');
      });
    }, function () { throw new Error('Connexion impossible. Vérifiez votre réseau et réessayez.'); });
  };
})();
