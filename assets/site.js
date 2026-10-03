/* FreshPlate – freshplate.hu
   A minta-hét és a bevásárlólista VALÓDI app-adatból dolgozik (assets/demo/het.json,
   előállítója: vállalkozás/marketing/landing/demo-adat.mjs). */
(function () {
  'use strict';

  var $ = function (s, el) { return (el || document).querySelector(s); };
  var $$ = function (s, el) { return Array.prototype.slice.call((el || document).querySelectorAll(s)); };
  var NB = ' ';
  var fmt = function (n) { return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, NB); };
  var esc = function (s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };

  // --- App Store kampánylinkek (ASC App Analytics → Campaigns). ---
  // A PT a fejlesztői fiók „provider token"-je az App Store Connect kampánylink-generátorából.
  // Amíg üres, a linkek sima Store-linkek maradnak (működnek, csak nem mérhetők).
  var PT = '';
  var APP_ID = '6793034579';
  function storeLink(ct) {
    if (!PT) return 'https://apps.apple.com/hu/app/id' + APP_ID;
    return 'https://apps.apple.com/app/apple-store/id' + APP_ID + '?pt=' + encodeURIComponent(PT) + '&ct=' + encodeURIComponent(ct) + '&mt=8';
  }
  $$('.js-store').forEach(function (a) { a.href = storeLink(a.getAttribute('data-ct') || 'land'); });

  // A /go/ átirányító oldalakról nem-iPhone-nal érkezők ide jönnek: az Android-blokkhoz görgetünk.
  var qs = new URLSearchParams(location.search);
  if (qs.get('from')) { setTimeout(function () { $('#android').scrollIntoView({ behavior: 'smooth' }); }, 300); }

  /* ------------------------------------------------------------------
     Fejléc + mobil menü
     ------------------------------------------------------------------ */
  var hd = $('#hd'), burger = $('#burger'), menu = $('#menu');
  var onScroll = function () { hd.classList.toggle('scrolled', window.scrollY > 8); };
  window.addEventListener('scroll', onScroll, { passive: true }); onScroll();
  function setMenu(open) {
    burger.setAttribute('aria-expanded', String(open));
    burger.setAttribute('aria-label', open ? 'Menü bezárása' : 'Menü megnyitása');
    menu.hidden = !open;
    document.body.classList.toggle('menu-open', open);
  }
  burger.addEventListener('click', function () { setMenu(menu.hidden); });
  $$('a', menu).forEach(function (a) { a.addEventListener('click', function () { setMenu(false); }); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !menu.hidden) { setMenu(false); burger.focus(); } });
  window.addEventListener('resize', function () { if (window.innerWidth > 1080 && !menu.hidden) setMenu(false); });

  /* ------------------------------------------------------------------
     Megjelenés görgetésre
     ------------------------------------------------------------------ */
  var rvs = $$('.rv');
  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) { if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); } });
    }, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });
    rvs.forEach(function (el) { io.observe(el); });
  } else {
    rvs.forEach(function (el) { el.classList.add('in'); });
  }

  /* ------------------------------------------------------------------
     Futószalag
     ------------------------------------------------------------------ */
  (function () {
    var words = ['reggeli', 'tízórai', 'ebéd', 'uzsonna', 'vacsora', 'bevásárlólista', '21 nap', 'együtt'];
    var html = '';
    for (var k = 0; k < 2; k++) words.forEach(function (w, i) { html += '<span class="' + (i % 2 ? 'o' : '') + '">' + w + '<i class="lf"></i></span>'; });
    $('#marquee').innerHTML = html;
  })();

  /* ------------------------------------------------------------------
     Minta-hét + bevásárlólista
     ------------------------------------------------------------------ */
  var TARGET = 1900;
  var SLOTS = [
    { label: 'Reggeli', pool: 'reggeli' },
    { label: 'Tízórai', pool: 'snack' },
    { label: 'Ebéd', pool: 'fo' },
    { label: 'Uzsonna', pool: 'snack' },
    { label: 'Vacsora', pool: 'fo' },
  ];
  var DAY_SHORT = ['H', 'K', 'Sze', 'Cs', 'P', 'Szo', 'V'];
  var DAY_LONG = ['hétfő', 'kedd', 'szerda', 'csütörtök', 'péntek', 'szombat', 'vasárnap'];
  var LEAF = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 19c0-8 5-14 14-14 0 9-6 14-14 14Z"/><path d="M5 19 13 11"/></svg>';

  var data = null, week = null, filter = '', seed = (Date.now() % 100000) + 7, dayIdx = (new Date().getDay() + 6) % 7;

  function rng(a) {
    return function () {
      a |= 0; a = a + 0x6D2B79F5 | 0;
      var t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }

  // Egy hét összerakása: naponta a napi célhoz legközelebbi kombináció,
  // ismétlés-büntetéssel (a fő fogások lehetőleg ne ismétlődjenek a héten).
  function makeWeek() {
    var R = rng(seed), pools = {};
    ['reggeli', 'fo', 'snack'].forEach(function (k) {
      var list = data[k].filter(function (r) { return !filter || r.d.indexOf(filter) >= 0; });
      pools[k] = list.length >= 2 ? list : data[k];
    });
    var pick = function (pool) { return pool[Math.floor(R() * pool.length)]; };
    var used = {}, days = [];
    for (var d = 0; d < 7; d++) {
      var best = null, bestScore = Infinity;
      for (var t = 0; t < 220; t++) {
        var combo = SLOTS.map(function (s) { return pick(pools[s.pool]); });
        var sum = 0, score = 0;
        combo.forEach(function (r) { sum += r.k; if (used[r.id]) score += r.img ? 140 : 60; });
        // Kis szórás, hogy ne minden nap pontosan a célon álljon — a valódi terv sem ilyen.
        score += Math.abs(sum - TARGET) + R() * 90;
        if (combo[1].id === combo[3].id) score += 900;
        if (combo[2].id === combo[4].id) score += 900;
        if (score < bestScore) { bestScore = score; best = combo; }
      }
      best.forEach(function (r) { used[r.id] = 1; });
      days.push(best);
    }
    return days;
  }

  function weekStart() {
    var now = new Date();
    var mon = new Date(now.getFullYear(), now.getMonth(), now.getDate() - ((now.getDay() + 6) % 7));
    return mon;
  }

  function renderDays() {
    var mon = weekStart(), today = (new Date().getDay() + 6) % 7, html = '';
    for (var i = 0; i < 7; i++) {
      var dt = new Date(mon.getFullYear(), mon.getMonth(), mon.getDate() + i);
      html += '<button type="button" role="tab" class="bd-day' + (i === today ? ' today' : '') + '" aria-selected="' + (i === dayIdx) + '" aria-label="' + DAY_LONG[i] + ', ' + (dt.getMonth() + 1) + '. ' + dt.getDate() + '." data-i="' + i + '"><small>' + DAY_SHORT[i] + '</small><b>' + dt.getDate() + '</b></button>';
    }
    var box = $('#bd-days');
    box.innerHTML = html;
    $$('.bd-day', box).forEach(function (b) {
      b.addEventListener('click', function () { dayIdx = +b.getAttribute('data-i'); renderDays(); renderMeals(); });
    });
  }

  function renderMeals() {
    var day = week[dayIdx], html = '', sum = 0;
    day.forEach(function (r, i) {
      sum += r.k;
      var img = r.img
        ? '<span class="m-img"><img src="assets/demo/r/' + r.id + '.webp" alt="" width="56" height="56" decoding="async"></span>'
        : '<span class="m-img ph">' + LEAF + '</span>';
      var meta = [];
      if (r.m) meta.push(r.m + ' perc');
      if (r.p) meta.push(r.p + ' g fehérje');
      html += '<li class="meal" style="--r:' + i + '">' + img +
        '<span class="m-txt"><span class="m-slot">' + SLOTS[i].label + '</span><span class="m-name">' + esc(r.n) + '</span><span class="m-meta">' + meta.join(' · ') + '</span></span>' +
        '<span class="m-kcal">' + fmt(r.k) + '<small>kcal</small></span></li>';
    });
    $('#bd-meals').innerHTML = html;
    countTo($('#bd-sum'), sum);
    $('#bd-bar').style.width = Math.min(100, (sum / TARGET) * 100) + '%';
  }

  function countTo(el, to) {
    var from = parseInt(String(el.textContent).replace(/\D/g, ''), 10) || 0, t0 = null;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches || !from) { el.textContent = fmt(to); return; }
    var step = function (ts) {
      if (!t0) t0 = ts;
      var p = Math.min(1, (ts - t0) / 600), e = 1 - Math.pow(1 - p, 3);
      el.textContent = fmt(from + (to - from) * e);
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  // --- Bevásárlólista: az app logikája szerint összeadva, polcokra bontva. ---
  var DISCRETE = ['db', 'gerezd', 'szelet', 'fej', 'szál', 'lap', 'rúd', 'tábla', 'karika', 'konzerv', 'csomag', 'doboz', 'zacskó'];
  var SHORT_UNIT = { 'evőkanál': 'ek', 'teáskanál': 'tk' };
  var roundAmount = function (v) { if (v >= 100) return Math.round(v / 5) * 5; if (v >= 10) return Math.round(v); return Math.round(v * 4) / 4; };
  var num = function (v) { return String(Math.round(v * 100) / 100).replace('.', ','); };
  function fmtQty(q, u) {
    if (q == null) return '';
    var v = q, unit = u;
    if (unit === 'g' && v >= 1000) { v /= 1000; unit = 'kg'; }
    if (unit === 'ml' && v >= 1000) { v /= 1000; unit = 'l'; }
    v = DISCRETE.indexOf(unit) >= 0 ? Math.ceil(v) : roundAmount(v);
    if (!v) v = 0.25;
    if (unit === 'kg' || unit === 'l') v = Math.round(q / 100) / 10;
    return num(v) + NB + (SHORT_UNIT[unit] || unit);
  }

  function shopping() {
    var map = {}, order = [];
    week.forEach(function (day) {
      day.forEach(function (r) {
        r.i.forEach(function (x) {
          var q = x[0], u = x[1], n = x[2], a = x[3];
          var key = (q == null ? 'raw' : u) + '|' + n.toLowerCase();
          var it = map[key];
          if (!it) { it = map[key] = { q: q == null ? null : 0, u: u, n: n, a: a }; order.push(key); }
          if (q != null) it.q += q;
        });
      });
    });
    // Ha ugyanaz a tétel mennyiséggel is szerepel, a mennyiség nélküli sor felesleges.
    var named = {};
    order.forEach(function (k) { if (k.indexOf('raw|') !== 0) named[k.split('|')[1]] = 1; });
    var items = order.filter(function (k) { return k.indexOf('raw|') !== 0 || !named[k.slice(4)]; }).map(function (k) { return map[k]; });
    var aisles = data.aisles.map(function (label, idx) { return { idx: idx, label: label, items: [] }; });
    items.forEach(function (it) { aisles[it.a].items.push(it); });
    aisles.forEach(function (a) { a.items.sort(function (x, y) { return x.n.localeCompare(y.n, 'hu'); }); });
    return {
      main: aisles.filter(function (a) { return a.items.length && data.pantry.indexOf(a.idx) < 0; }),
      pantry: aisles.filter(function (a) { return a.items.length && data.pantry.indexOf(a.idx) >= 0; }),
    };
  }

  var listTotal = 0;
  function renderReceipt() {
    var s = shopping(), html = '';
    listTotal = 0;
    s.main.forEach(function (a) {
      listTotal += a.items.length;
      html += '<h4 class="rc-aisle">' + esc(a.label) + '<span>' + a.items.length + '</span></h4><ul>';
      a.items.forEach(function (it) {
        html += '<li><button type="button" class="rc-item" aria-pressed="false"><i class="bx" aria-hidden="true"></i><span class="nm">' + esc(it.n) + '</span><span class="dt" aria-hidden="true"></span><span class="q">' + fmtQty(it.q, it.u) + '</span></button></li>';
      });
      html += '</ul>';
    });
    var body = $('#rc-body');
    body.innerHTML = html;
    body.scrollTop = 0;
    var pantryNames = [];
    s.pantry.forEach(function (a) { a.items.forEach(function (it) { if (pantryNames.indexOf(it.n) < 0) pantryNames.push(it.n); }); });
    $('#rc-pantry').innerHTML = '<b>Alapkészlet · összecsukva</b>' + esc(pantryNames.slice(0, 14).join(', ')) + (pantryNames.length > 14 ? ' és még ' + (pantryNames.length - 14) : '') + ' — ezek otthon általában megvannak.';
    $('#rc-sub').textContent = '7 nap · 35 étkezés · ' + listTotal + ' tétel';
    $('#bd-items').textContent = listTotal;
    $('#ls-items').textContent = listTotal;
    $('#ls-aisles').textContent = s.main.length;
    updateReceipt();
    $$('.rc-item', body).forEach(function (b) {
      b.addEventListener('click', function () {
        b.setAttribute('aria-pressed', String(b.getAttribute('aria-pressed') !== 'true'));
        updateReceipt();
      });
    });
  }
  function updateReceipt() {
    var done = $$('.rc-item[aria-pressed="true"]').length;
    $('#rc-count').textContent = done && done === listTotal ? 'Minden a kosárban. Mehetsz a pénztárhoz!' : done + ' / ' + listTotal + ' a kosárban';
    $('#rc-bar').style.width = (listTotal ? (done / listTotal) * 100 : 0) + '%';
  }

  function regenerate() {
    week = makeWeek();
    renderMeals();
    renderReceipt();
  }

  $('#bd-shuffle').addEventListener('click', function () { seed = (seed * 48271 + 11) % 2147483647; regenerate(); });
  $$('.bd-filters button').forEach(function (b) {
    b.addEventListener('click', function () {
      filter = b.getAttribute('data-f');
      $$('.bd-filters button').forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); });
      regenerate();
    });
  });

  fetch('assets/demo/het.json')
    .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
    .then(function (d) { data = d; renderDays(); regenerate(); })
    .catch(function () {
      $('#bd-meals').innerHTML = '<li class="bd-err">A minta-hét most nem tölthető be. Az appban persze működik.</li>';
      $('#rc-body').innerHTML = '';
    });

  /* ------------------------------------------------------------------
     21 napos szokás – az app „Szokásaid” lapja (HabitsModal.js)
     A sorozat az app habitStreak-je szerint számol (nudges.js): hetente egy
     szabadnap belefér, két egymás utáni kihagyás megszakítja a láncot.
     ------------------------------------------------------------------ */
  (function () {
    var grid = $('#hb-grid');
    if (!grid) return;
    var TARGET = 21, MILESTONE = 7, START_T = 12, START_DONE = 11;
    var CHECK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5 L10 17.5 L19 7"/></svg>';
    var ARROW = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>';
    var cta = $('#hb-do'), next = $('#hb-next'), msg = $('#hb-msg'), DEFAULT = msg.textContent;
    // A rács a valós hétnapokhoz igazodik, mint az appban: a mai nap a 12., a kezdés 11 nappal korábban volt.
    var now = new Date();
    var start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - (START_T - 1));
    var col0 = (start.getDay() + 6) % 7;
    var done, T;

    function reset() { done = {}; for (var i = 1; i <= START_DONE; i++) done[i] = 1; T = START_T; }
    function streakOf() {
      var cursor = done[T] ? T : T - 1, streak = 0, misses = 0, gap = 0;
      for (var i = 0; i < 400; i++) {
        if (done[cursor]) { streak++; gap = 0; }
        else {
          gap++;
          if (gap > 1) break;
          if (misses >= Math.floor(streak / 7) + 1) break;
          misses++;
        }
        cursor--;
      }
      return streak;
    }
    function render(popAt) {
      var html = '', n = 0;
      for (var p = 0; p < col0; p++) html += '<i class="cal-cell pad"></i>';
      for (var i = 1; i <= TARGET; i++) {
        var cls = done[i] ? 'done' : (i > T ? 'fut' : 'miss');
        if (done[i]) n++;
        if (i === T && !done[i]) cls += ' today';
        if (i === popAt) cls += ' pop';
        html += '<i class="cal-cell ' + cls + '">' + i + '</i>';
      }
      grid.innerHTML = html;
      var s = streakOf();
      $('#hb-streak').textContent = s;
      $('#hb-days').textContent = s + ' / ' + TARGET + ' nap';
      $('#hb-fill').style.width = Math.min(100, (s / TARGET) * 100) + '%';
      $('#hb-ms').textContent = s >= MILESTONE ? MILESTONE + '. napi mérföldkő teljesítve' : 'Még ' + (MILESTONE - s) + ' nap az első mérföldkőig';
      $('#hb-count').textContent = n + ' bejelölés';
      var dt = !!done[T];
      cta.classList.toggle('done', dt);
      cta.disabled = dt;
      cta.innerHTML = dt ? CHECK + 'Ma megvan' : 'Mai bejelölés';
      next.innerHTML = T >= TARGET ? 'Újrakezdem' : 'Következő nap ' + ARROW;
      return s;
    }
    function say(text, hl) { msg.textContent = text; msg.classList.toggle('hl', !!hl); }

    cta.addEventListener('click', function () {
      if (done[T]) return;
      done[T] = 1;
      var s = render(T);
      if (s >= TARGET) say('Beépült. Huszonegy nap — ez már a tiéd.', true);
      else if (s === MILESTONE) say('Megvan a 7. nap — az első mérföldkő.', true);
      else say('Megvan a ' + T + '. nap. Holnap ugyanígy, ebéd után.');
    });
    next.addEventListener('click', function () {
      if (T >= TARGET) { reset(); render(); say(DEFAULT); return; }
      var missed = !done[T], before = streakOf();
      T++;
      var s = render();
      if (!missed) say(T + '. nap. Ebéd után jöhet a séta, utána jelöld be.');
      else if (s >= before) say('Kihagytál egy napot — belefér: hetente egy szabadnap jár, a sorozat nem nullázódik.', true);
      else if (s === 0) say('Két kihagyás egymás után: itt új sorozat indul. A bejelölt napok a naptárban maradnak.', true);
      else say('Ezen a héten ez már a második kihagyás, ezért a sorozat újraindult.', true);
    });
    reset(); render();
  })();

  /* ------------------------------------------------------------------
     Csapat – az app közös szokás kártyája (GroupHabitCard.js)
     A közös nap küszöbe 2 tag; biztatni azt lehet, akinek ma még nincs meg.
     ------------------------------------------------------------------ */
  (function () {
    var list = $('#tm-members');
    if (!list) return;
    // d: az elmúlt 6 nap (a legrégebbi az első), t: ma megvan-e
    var members = [
      { n: 'Anna', d: [1, 1, 1, 0, 1, 1], t: true },
      { n: 'Kata', d: [1, 1, 0, 1, 1, 1], t: true },
      { n: 'Bence', d: [1, 0, 1, 1, 1, 0], t: false },
      { n: 'Eszter', d: [1, 1, 1, 1, 0, 1], t: false, me: true },
    ];
    var cheered = {}, toast = $('#tm-toast'), meBtn = $('#tm-me'), undo = $('#tm-undo'), timer;
    var you = members.filter(function (m) { return m.me; })[0];
    // memberHabitStreak: ha ma még nincs meg, a tegnapi naptól számol visszafelé.
    function streakOf(m) {
      var days = m.d.concat([m.t ? 1 : 0]), i = days.length - 1, n = 0;
      if (!days[i]) i--;
      while (i >= 0 && days[i]) { n++; i--; }
      return n;
    }
    function render() {
      var html = '';
      members.forEach(function (m, i) {
        var dots = m.d.map(function (v) { return '<i' + (v ? ' class="on"' : '') + '></i>'; }).join('') + '<i class="t' + (m.t ? ' on' : '') + '"></i>';
        var st = streakOf(m);
        var canCheer = !m.me && !m.t && !cheered[i];
        html += '<li><span class="gh-av" aria-hidden="true">' + m.n.charAt(0) + '</span>' +
          '<span class="gh-who"><span class="gh-name' + (m.me ? ' me' : '') + '">' + m.n + (m.me ? ' (te)' : '') + '</span>' +
          (st > 0 ? '<span class="gh-streak">' + Math.min(st, 21) + '/21 nap</span>' : '') + '</span>' +
          '<span class="gh-dots" aria-hidden="true">' + dots + '</span>' +
          (canCheer ? '<button type="button" class="gh-cheer" data-i="' + i + '">Hajrá!</button>' : '') + '</li>';
      });
      list.innerHTML = html;
      $$('.gh-cheer', list).forEach(function (b) {
        b.addEventListener('click', function () {
          var i = +b.getAttribute('data-i');
          cheered[i] = 1; render();
          toast.textContent = 'Elküldtük a biztatást: ' + members[i].n;
          toast.classList.add('show');
          clearTimeout(timer); timer = setTimeout(function () { toast.classList.remove('show'); }, 2400);
        });
      });
      var doneM = members.filter(function (m) { return m.t; });
      $('#tm-n').textContent = doneM.length;
      $('#tm-tot').textContent = '/' + members.length;
      $('#tm-state').textContent = doneM.length >= 2 ? 'Megvan a mai közös nap' : 'tagnak van meg ma';
      $('#tm-names').textContent = doneM.length === 0
        ? 'Ma még senkinek. Kezdd te – a többiek látni fogják.'
        : 'Ma már megvan: ' + doneM.map(function (m) { return m.n; }).join(', ');
      meBtn.setAttribute('aria-pressed', String(you.t));
      meBtn.textContent = you.t ? 'Ma megvan' : 'Ma megcsináltam';
      undo.hidden = !you.t;
    }
    meBtn.addEventListener('click', function () { you.t = !you.t; render(); });
    render();
  })();

  /* ------------------------------------------------------------------
     Heti 30 növény – gyűrű
     ------------------------------------------------------------------ */
  (function () {
    var svg = $('#plants');
    if (!svg) return;
    var COLORS = ['#3E8E4F', '#C4452E', '#D9822B', '#D8B23A', '#7A4E8C', '#8C6A4A', '#2E8550'];
    var html = '';
    for (var i = 0; i < 30; i++) {
      var a = (i / 30) * Math.PI * 2 - Math.PI / 2, x = 60 + Math.cos(a) * 50, y = 60 + Math.sin(a) * 50;
      var on = i < 19;
      html += '<circle cx="' + x.toFixed(2) + '" cy="' + y.toFixed(2) + '" r="4.6" fill="' + (on ? COLORS[i % 7] : '#E8E5DA') + '" style="transition:opacity .4s ' + (i * 25) + 'ms, transform .4s ' + (i * 25) + 'ms;transform-origin:' + x.toFixed(1) + 'px ' + y.toFixed(1) + 'px"/>';
    }
    svg.innerHTML = html;
  })();

  /* ------------------------------------------------------------------
     Árak: havi / éves
     ------------------------------------------------------------------ */
  (function () {
    var seg = $('.seg'), amt = $('#pr-amt'), per = $('#pr-per'), note = $('#pr-note');
    var PLANS = {
      ho: { amt: '1' + NB + '990 Ft', per: '/ hó', note: 'vagy 12' + NB + '990 Ft / év · az első 7 nap ingyen' },
      ev: { amt: '12' + NB + '990 Ft', per: '/ év', note: 'havonta kb. 1' + NB + '083 Ft · az első 7 nap ingyen' },
    };
    $$('button', seg).forEach(function (b) {
      b.addEventListener('click', function () {
        var p = b.getAttribute('data-plan');
        $$('button', seg).forEach(function (x) { x.setAttribute('aria-checked', String(x === b)); });
        seg.classList.toggle('ev', p === 'ev');
        amt.textContent = PLANS[p].amt; per.textContent = PLANS[p].per; note.textContent = PLANS[p].note;
        amt.classList.remove('swap'); void amt.offsetWidth; amt.classList.add('swap');
      });
    });
  })();

  /* ------------------------------------------------------------------
     Várólista: saját backend, csak a hozzájárulással.
     ------------------------------------------------------------------ */
  (function () {
    var API = 'https://freshplate-backend-ybm3.onrender.com/api/waitlist';
    var form = $('#wl'), msg = $('#wl-msg'), btn = $('#wl-btn');
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var email = $('#wl-email').value.trim();
      var consent = $('#wl-consent').checked;
      msg.className = 'msg';
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { msg.className = 'msg err'; msg.textContent = 'Adj meg egy érvényes e-mail-címet.'; return; }
      if (!consent) { msg.className = 'msg err'; msg.textContent = 'A feliratkozáshoz a hozzájárulás bejelölése szükséges.'; return; }
      btn.disabled = true; msg.textContent = 'Küldés…';
      fetch(API, { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email, platform: 'android', consent: true, source: qs.get('from') || 'landing' }) })
        .then(function (r) { return r.json().then(function (d) { return { ok: r.ok, d: d }; }); })
        .then(function (x) {
          if (x.ok) { msg.className = 'msg ok'; msg.textContent = 'Köszönjük — szólunk, amint az Android-verzió elérhető.'; form.reset(); }
          else { msg.className = 'msg err'; msg.textContent = (x.d && x.d.error) || 'A feliratkozás most nem sikerült. Próbáld újra később.'; }
        })
        .catch(function () { msg.className = 'msg err'; msg.textContent = 'Nem érjük el a szervert. Próbáld újra egy perc múlva.'; })
        .finally(function () { btn.disabled = false; });
    });
  })();
})();
