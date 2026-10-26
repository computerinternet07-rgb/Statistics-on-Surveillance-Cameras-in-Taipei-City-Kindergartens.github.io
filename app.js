(function () {
  'use strict';
  const D = window.CameraData, $ = id => document.getElementById(id), cfg = window.SITE_CONFIG || {};
  const header = document.querySelector('.site-header');
  let headerHeight = header.getBoundingClientRect().height;
  function measureHeader() { headerHeight = Math.ceil(header.getBoundingClientRect().height); document.documentElement.style.setProperty('--header-height', headerHeight + 'px'); }
  if (window.ResizeObserver) new ResizeObserver(measureHeader).observe(header);
  else addEventListener('resize', measureHeader, {passive: true});
  measureHeader();
  $('copyrightYear').textContent = new Intl.DateTimeFormat('en', {year: 'numeric', timeZone: 'Asia/Taipei'}).format(new Date());
  const navLinks = Array.from(document.querySelectorAll('.nav a[href^="#"]'));
  const navSections = navLinks.map(a => document.querySelector(a.getAttribute('href')));
  let data = null, records = [], queryApi = null, pending = null, pendingSearch = false, firstReady = null;

  function updateNavigation() {
    header.classList.toggle('is-scrolled', scrollY > 8);
    let active = 0;
    navSections.forEach((section, i) => { if (section && section.getBoundingClientRect().top <= headerHeight + 40) active = i; });
    navLinks.forEach((a, i) => { if (i === active) a.setAttribute('aria-current', 'location'); else a.removeAttribute('aria-current'); });
  }
  function render(dataIn) {
    if (!D.validate(dataIn)) return;
    data = dataIn; records = D.rows(data); const s = D.stats(records);
    $('indexValue').textContent = D.percent(s.index); $('scoreFill').style.transform = 'scaleX(' + ((s.index || 0) / 100) + ')';
    const selected = $('compareGroup').value;
    $('compareGroup').replaceChildren(new Option('全部類型', 'all'), ...data.groups.map(g => new Option(g.label, g.id)));
    $('compareGroup').value = data.groups.some(g => g.id === selected) ? selected : 'all';
    renderBars();
    if (!queryApi) {
      const initial = pending ? {...pending} : null;
      $('localQuery').hidden = false; queryApi = window.mountQuery($('localQuery'), syncFilter);
      queryApi.setData(data); if (initial) queryApi.setFilter(initial);
    } else queryApi.setData(data);
    $('queryPlaceholder').hidden = true;
    if (pendingSearch) { pendingSearch = false; queryApi.showResults(); }
    if (firstReady === null) { firstReady = performance.now(); document.documentElement.dataset.dataReady = 'true'; }
    document.dispatchEvent(new CustomEvent('camera:data-ready'));
  }
  function renderBars() {
    const group = $('compareGroup').value, rs = D.filter(records, {group});
    $('districtBars').replaceChildren(...D.districts.map(name => {
      const s = D.stats(rs.filter(r => r.district === name)), button = document.createElement('button');
      button.className = 'district-bar'; button.setAttribute('aria-label', name + '，' + s.total + '所，裝設覆蓋率' + D.percent(s.index) + '，查看園所');
      const a = document.createElement('span'); a.textContent = name;
      const track = document.createElement('i'); track.setAttribute('aria-hidden', 'true');
      const bar = document.createElement('b'); bar.style.transform = 'scaleX(' + ((s.index || 0) / 100) + ')'; track.append(bar);
      const b = document.createElement('span'); b.textContent = s.total ? D.percent(s.index) : '—'; button.append(a, track, b);
      button.onclick = () => openQuery({district: name, group, q: ''}); return button;
    }));
  }
  function syncFilter(f) {
    if (!f || !(f.district === 'all' || D.districts.includes(f.district))) return;
    pending = Object.assign({q: '', district: 'all', group: 'all', indoor: 'all', outdoor: 'all'}, f);
    document.querySelectorAll('#districtButtons button').forEach(b => {
      const active = b.textContent === pending.district; b.classList.toggle('active', active); b.setAttribute('aria-pressed', String(active));
    });
    $('queryHeading').textContent = pending.district === 'all' ? '園所查詢' : pending.district + '園所查詢';
  }
  function openQuery(f, showResults = false) {
    pendingSearch = showResults;
    pending = Object.assign({q: '', district: 'all', group: 'all', indoor: 'all', outdoor: 'all'}, f);
    $('queryPlaceholder').hidden = !!queryApi;
    if (queryApi) { $('localQuery').hidden = false; queryApi.setFilter(pending); }
    syncFilter(pending);
    if (showResults && queryApi) { pendingSearch = false; queryApi.showResults(); return; }
    $('query').scrollIntoView({block: 'start'}); $('queryHeading').focus({preventScroll: true});
  }
  window.openDistrict = district => openQuery({district});
  $('districtButtons').replaceChildren(...D.districts.map(district => {
    const button = document.createElement('button'); button.textContent = district; button.onclick = () => openQuery({district}); return button;
  }));
  let composing = false;
  $('schoolSearch').addEventListener('compositionstart', () => { composing = true; });
  $('schoolSearch').addEventListener('compositionend', () => { composing = false; });
  $('heroSearch').onsubmit = event => { event.preventDefault(); if (!composing) openQuery({q: $('schoolSearch').value}, true); };
  $('cityQuery').onclick = () => openQuery({district: 'all'}); $('compareGroup').onchange = renderBars;
  $('largeText').onclick = () => {
    const large = !document.body.classList.contains('large'); document.body.classList.toggle('large', large);
    $('largeText').setAttribute('aria-pressed', large); $('largeText').textContent = large ? '標準文字' : '放大文字';
  };

  let client;
  function showStatus(state) {
    const status = $('connectionStatus');
    status.replaceChildren(); status.hidden = state.kind === 'ready' || state.kind === 'loading';
    if (state.kind === 'ready') return;
    if (state.kind === 'loading') { $('queryPlaceholder').hidden = !!queryApi; return; }
    let text = '暫時無法讀取園所資料。';
    if (state.kind === 'stale') {
      const time = new Intl.DateTimeFormat('zh-TW', {timeZone: 'Asia/Taipei', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit'}).format(new Date(state.generatedAt));
      text = '目前顯示 ' + time + ' 同步的資料。';
    }
    status.append(document.createTextNode(text));
    const retry = document.createElement('button'); retry.type = 'button'; retry.textContent = '重新更新'; retry.style.marginLeft = '12px';
    retry.onclick = () => client.refresh(); status.append(retry);
    if (!queryApi) { $('queryPlaceholder').hidden = true; }
  }
  client = new window.PublicDataClient(cfg, render, showStatus);
  window.cameraApp = {openQuery, render, diagnostics: () => ({...client.diagnostics(), firstReady})};
  if (window.PREVIEW_DATA) { render(window.PREVIEW_DATA); showStatus({kind: 'ready'}); }
  else client.start();
  const hash = new URLSearchParams(location.hash.slice(1));
  if (D.districts.includes(hash.get('district'))) openQuery({district: hash.get('district')});
  let scrollPending = false; const top = $('backTop');
  function scrollState() {
    scrollPending = false; updateNavigation();
    const max = document.documentElement.scrollHeight - innerHeight;
    const progress = max > 0 ? Math.min(1, Math.max(0, scrollY / max)) : 0;
    top.hidden = scrollY < 280; $('topProgress').style.strokeDashoffset = String(100 - progress * 100);
  }
  function queueScroll() { if (!scrollPending) { scrollPending = true; requestAnimationFrame(scrollState); } }
  addEventListener('scroll', queueScroll, {passive: true}); addEventListener('resize', queueScroll); scrollState();
  top.onclick = $('mobileTop').onclick = () => {
    window.scrollTo({top: 0, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth'});
    $('main').focus({preventScroll: true});
  };
  addEventListener('pagehide', event => { if (!event.persisted) client.destroy(); });
})();
