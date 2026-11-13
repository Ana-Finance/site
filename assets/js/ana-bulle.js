(function () {
  if (window.__anaBulleReady) return;
  window.__anaBulleReady = true;

  var overlay = null;
  var lastFocus = null;

  function close() {
    if (!overlay) return;
    var o = overlay;
    overlay = null;
    o.style.opacity = '0';
    setTimeout(function () { if (o.parentNode) o.parentNode.removeChild(o); }, 180);
    document.documentElement.style.overflow = '';
    if (lastFocus && lastFocus.focus) { try { lastFocus.focus(); } catch (e) {} }
  }

  function open(card) {
    var sum = card.querySelector('summary');
    if (!sum) return;
    var detail = card.querySelector('.ana-detail');
    close();
    lastFocus = sum;

    overlay = document.createElement('div');
    overlay.setAttribute('data-ana-bulle', '');
    overlay.style.cssText = 'position:fixed;inset:0;z-index:300;background:rgba(11,10,16,0.46);display:flex;align-items:center;justify-content:center;padding:24px;opacity:0;transition:opacity .18s ease;';

    var box = document.createElement('div');
    box.setAttribute('role', 'dialog');
    box.setAttribute('aria-modal', 'true');
    // La fenêtre est créée hors de la page : elle reprend la teinte de la carte et de ses parents
    // (classes ana-t-* et ana-r1…6 de site.css), sinon pictogrammes et surtitres retombent sur la couleur par défaut.
    box.className = 'ana-fenetre';
    for (var el = card; el && el.classList; el = el.parentElement) {
      Array.prototype.forEach.call(el.classList, function (c) {
        if (/^ana-(t-[a-z]+|r[1-6])$/.test(c)) box.classList.add(c);
      });
    }
    box.style.cssText = 'position:relative;background:#fff;border-radius:24px;border:1px solid #eceaf3;box-shadow:0 44px 90px -34px rgba(20,10,60,0.55);width:100%;max-width:620px;max-height:84vh;overflow:auto;padding:34px 36px 36px;font-family:Inter,system-ui,sans-serif;color:#16151c;animation:anaBullePop .26s cubic-bezier(.34,1.3,.64,1) both;';

    var head = document.createElement('div');
    head.className = 'ana-fenetre-tete';
    head.style.cssText = 'display:flex;flex-direction:column;gap:16px;padding-right:44px;';
    head.innerHTML = sum.innerHTML;
    Array.prototype.forEach.call(head.querySelectorAll('.ana-chev'), function (c) {
      var p = c.parentNode;
      if (p && p.parentNode) p.parentNode.removeChild(p);
    });
    Array.prototype.forEach.call(head.querySelectorAll('[style]'), function (el) {
      if (el.style.gridTemplateColumns) el.style.gridTemplateColumns = '1fr';
      if (el.style.maxWidth) el.style.maxWidth = 'none';
    });
    box.appendChild(head);

    if (detail) {
      var body = document.createElement('div');
      body.innerHTML = detail.innerHTML;
      body.style.cssText = 'margin-top:22px;padding-top:22px;border-top:1px solid #eceaf3;';
      box.appendChild(body);
    }

    var btn = document.createElement('button');
    btn.type = 'button';
    btn.setAttribute('aria-label', 'Fermer');
    btn.style.cssText = 'position:absolute;top:18px;right:18px;width:36px;height:36px;border-radius:999px;border:1px solid #eceaf3;background:#fff;color:#16151c;cursor:pointer;display:flex;align-items:center;justify-content:center;padding:0;font-family:inherit;';
    btn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"></path></svg>';
    btn.addEventListener('click', close);
    box.appendChild(btn);

    overlay.appendChild(box);
    overlay.addEventListener('click', function (e) { if (e.target === overlay) close(); });
    document.body.appendChild(overlay);
    document.documentElement.style.overflow = 'hidden';
    requestAnimationFrame(function () { if (overlay) overlay.style.opacity = '1'; });
    btn.focus();
  }

  document.addEventListener('click', function (e) {
    var t = e.target;
    if (!t || !t.closest) return;
    var sum = t.closest('summary');
    if (!sum) return;
    var card = sum.closest('.ana-acc');
    if (!card) return;
    e.preventDefault();
    e.stopPropagation();
    open(card);
  }, true);

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') { close(); return; }
    if (e.key === 'Enter' || e.key === ' ' || e.key === 'Spacebar') {
      var a = document.activeElement;
      if (a && a.tagName === 'SUMMARY' && a.closest && a.closest('.ana-acc')) {
        e.preventDefault();
        open(a.closest('.ana-acc'));
      }
    }
  });
})();
