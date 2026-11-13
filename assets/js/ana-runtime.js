/* Ana Finance — mini-moteur d'interactivité des pages.
   Chaque page déclare une classe `Component extends DCLogic` (état + renderVals()).
   Le HTML porte des liaisons déclaratives :
     data-if="clé"            affiche/masque l'élément selon la valeur
     data-text="clé"          remplace le texte
     data-b-<attr>="… {{ clé }} …"  calcule un attribut (style, aria-*, value…)
     data-on-<événement>="clé"      branche un gestionnaire (click, mouseenter, input, blur, submit…) */
(function () {
  'use strict';

  function DCLogic() { this.state = {}; }
  DCLogic.prototype.setState = function (patch) {
    var next = typeof patch === 'function' ? patch(this.state) : patch;
    this.state = Object.assign({}, this.state, next);
    this.__render();
  };
  DCLogic.prototype.forceUpdate = function () { this.__render(); };
  DCLogic.prototype.renderVals = function () { return {}; };

  /* Contrôles communs des formulaires : champs obligatoires, format de l'e-mail, bouton inactif tant que
     le formulaire est incomplet, envoi par anaSubmitLead. À fusionner dans renderVals() :
       return Object.assign({ … }, this.formVals({ kind: 'contact', required: ['nom', 'email', 'message', 'consent'] }));
     Le HTML utilise : data-on-submit="submitForm", data-on-change / data-on-blur="onField" sur chaque champ,
     et pour un champ « x » les valeurs ast_x (couleur de l'astérisque), border_x, err_x. */
  DCLogic.prototype.formVals = function (cfg) {
    var self = this;
    var s = this.state;
    var form = this._formEl || null;
    var touched = s.touched || {};
    var EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    function filledIn(f, n) {
      var el = f ? f.elements[n] : null;
      if (!el) return false;
      return el.type === 'checkbox' ? el.checked : String(el.value || '').trim() !== '';
    }
    function emailBadIn(f) {
      var el = f ? f.elements.email : null;
      return !!el && filledIn(f, 'email') && !EMAIL.test(String(el.value).trim());
    }
    function validIn(f) { return !!f && cfg.required.every(function (n) { return filledIn(f, n); }) && !emailBadIn(f); }
    var valid = validIn(form);
    var vals = {
      formSent: !!s.sent,
      formOpen: !s.sent,
      resetForm: function () { self._formEl = null; self.setState({ sent: false, touched: {}, sendError: null }); },
      onField: function (e) {
        var f = e.target && e.target.form;
        if (f) self._formEl = f;
        var name = e.target && e.target.name;
        if (name && e.type === 'blur') {
          var t = Object.assign({}, self.state.touched || {});
          t[name] = true;
          self.setState({ touched: t });
        } else self.forceUpdate();
      },
      submitForm: function (e) {
        e.preventDefault();
        self._formEl = e.target;
        if (self.state.sending) return;
        if (!validIn(e.target)) {
          var all = {};
          cfg.required.forEach(function (n) { all[n] = true; });
          self.setState({ touched: all });
          return;
        }
        self.setState({ sending: true, sendError: null });
        // La conversion n'est comptée que si le serveur a confirmé l'enregistrement.
        (window.anaSubmitLead ? window.anaSubmitLead(e.target, cfg.kind) : Promise.resolve({ sent: false }))
          .then(function (r) {
            self.setState({ sent: true, sending: false });
            if (r.sent && cfg.event && window.anaAnalytics) window.anaAnalytics.track(cfg.event);
          })
          .catch(function (err) { self.setState({ sending: false, sendError: err.message }); });
      },
      sendError: !!s.sendError,
      sendErrorMsg: s.sendError || '',
      submitDisabled: !valid || !!s.sending,
      submitOpacity: valid ? 1 : 0.45,
      submitCursor: valid ? 'pointer' : 'not-allowed',
      submitBg: valid ? 'linear-gradient(135deg,#000000,#8b1fe0 55%,#f23fd6 100%)' : '#c9c7d4',
      errEmailMsg: emailBadIn(form) ? 'Adresse e-mail invalide.' : 'Ce champ est obligatoire.'
    };
    cfg.required.forEach(function (n) {
      var bad = !!touched[n] && (!filledIn(form, n) || (n === 'email' && emailBadIn(form)));
      vals['ast_' + n] = filledIn(form, n) && !(n === 'email' && emailBadIn(form)) ? '#6b6880' : '#c62b1e';
      vals['border_' + n] = bad ? '#c62b1e' : '#e3e1ec';
      vals['err_' + n] = bad;
    });
    return vals;
  };
  window.DCLogic = DCLogic;

  var TPL = /\{\{\s*([^}\s]+)\s*\}\}/g;
  var PROPS = { value: 1, checked: 1 };

  function lookup(vals, key) {
    if (Object.prototype.hasOwnProperty.call(vals, key)) return vals[key];
    if (key === 'true') return true;
    if (key === 'false') return false;
    if (key === 'null') return null;
    if (/^-?\d+(\.\d+)?$/.test(key)) return Number(key);
    return undefined;
  }

  function mount(Component) {
    var comp = new Component();
    var vals = {};
    var root = document;

    var ifs = root.querySelectorAll('[data-if]');
    var texts = root.querySelectorAll('[data-text]');
    var bound = [];
    root.querySelectorAll('*').forEach(function (el) {
      var attrs = [];
      for (var i = 0; i < el.attributes.length; i++) {
        var a = el.attributes[i];
        if (a.name.indexOf('data-b-') === 0) attrs.push([a.name.slice(7), a.value]);
      }
      if (attrs.length) {
        // min/max/step avant value, pour que la valeur ne soit pas bornée à tort
        attrs.sort(function (x, y) { return (x[0] === 'value') - (y[0] === 'value'); });
        bound.push([el, attrs]);
      }
    });

    function render() {
      vals = comp.renderVals() || {};
      // Menu mobile ouvert : la page ne défile plus derrière (règle « ana-menu-ouvert » de site.css).
      document.documentElement.classList.toggle('ana-menu-ouvert', !!(comp.state && comp.state.mobileOpen));
      ifs.forEach(function (el) { el.hidden = !lookup(vals, el.getAttribute('data-if')); });
      texts.forEach(function (el) {
        var v = lookup(vals, el.getAttribute('data-text'));
        var s = v == null || v === false ? '' : String(v);
        if (el.textContent !== s) el.textContent = s;
      });
      bound.forEach(function (pair) {
        var el = pair[0];
        pair[1].forEach(function (b) {
          var name = b[0], tpl = b[1];
          var single = tpl.match(/^\s*\{\{\s*([^}\s]+)\s*\}\}\s*$/);
          var raw = single ? lookup(vals, single[1]) : null;
          if (PROPS[name]) {
            if (name === 'checked') el.checked = !!raw;
            else {
              var sv = single ? (raw == null ? '' : String(raw)) : tpl.replace(TPL, function (_, k) { var v = lookup(vals, k); return v == null ? '' : v; });
              if (el.value !== sv) el.value = sv;
            }
            return;
          }
          if (single && typeof raw === 'boolean' && name.indexOf('aria-') !== 0) {
            if (raw) el.setAttribute(name, ''); else el.removeAttribute(name);
            return;
          }
          var out = tpl.replace(TPL, function (_, k) { var v = lookup(vals, k); return v == null ? '' : String(v); });
          if (el.getAttribute(name) !== out) el.setAttribute(name, out);
        });
      });
    }
    comp.__render = render;

    var EVENTS = { change: 'input', input: 'input', click: 'click', mouseenter: 'mouseenter', mouseleave: 'mouseleave', blur: 'blur', focus: 'focus', submit: 'submit' };
    root.querySelectorAll('*').forEach(function (el) {
      for (var i = 0; i < el.attributes.length; i++) {
        var a = el.attributes[i];
        if (a.name.indexOf('data-on-') !== 0) continue;
        (function (evt, key) {
          var type = EVENTS[evt] || evt;
          if (evt === 'change' && (el.tagName === 'SELECT' || el.type === 'checkbox' || el.type === 'radio')) type = 'change';
          el.addEventListener(type, function (e) {
            var fn = vals[key];
            if (typeof fn === 'function') fn(e);
          });
        })(a.name.slice(8), a.value);
      }
    });

    // Échap ferme le mega-menu et le menu mobile
    document.addEventListener('keydown', function (e) {
      if (e.key !== 'Escape') return;
      var s = comp.state;
      if (s.menu || s.mobileOpen) comp.setState({ menu: null, mobileOpen: false });
    });

    render();
    initBarre();
    return comp;
  }

  /* Barre fixe « Demander une démo » (téléphone) : elle s'efface tant qu'un bouton de démo ou un formulaire
     est déjà à l'écran, pour ne pas afficher deux fois la même action. */
  function initBarre() {
    var bar = document.querySelector('.ana-mobile-sticky-cta');
    if (!bar || !('IntersectionObserver' in window)) return;
    var watched = Array.prototype.slice.call(document.querySelectorAll('main a[href="demo.html"], main form'));
    if (!watched.length) return;
    var HAUT = 69, BAS = 70; // hauteur de l'en-tête fixe et de la barre : ce qui est dessous ne compte pas comme visible
    var visibles = [];
    function set(el, on) {
      var i = visibles.indexOf(el);
      if (on && i < 0) visibles.push(el);
      if (!on && i > -1) visibles.splice(i, 1);
    }
    function apply() { bar.classList.toggle('est-masquee', visibles.length > 0); }
    // État initial calculé tout de suite, pour que la barre n'apparaisse pas un instant au chargement.
    var vh = window.innerHeight || document.documentElement.clientHeight;
    watched.forEach(function (el) {
      var r = el.getBoundingClientRect();
      set(el, r.height > 0 && r.bottom > HAUT && r.top < vh - BAS);
    });
    // Sans transition pour ce premier état : la barre ne doit pas glisser hors de l'écran à l'ouverture de la page.
    bar.style.transition = 'none';
    apply();
    var raf = window.requestAnimationFrame || function (fn) { return setTimeout(fn, 16); };
    raf(function () { raf(function () { bar.style.transition = ''; }); });
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) { set(e.target, e.isIntersecting); });
      apply();
    }, { rootMargin: '-' + HAUT + 'px 0px -' + BAS + 'px 0px' });
    watched.forEach(function (el) { io.observe(el); });
  }

  window.DC = { mount: mount };
})();
