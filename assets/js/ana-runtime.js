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
    return comp;
  }

  window.DC = { mount: mount };
})();
