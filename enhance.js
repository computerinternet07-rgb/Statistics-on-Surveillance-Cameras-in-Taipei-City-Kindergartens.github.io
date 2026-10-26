(function () {
  'use strict';
  const jobs = new Map();
  const load = (src, module = false) => {
    if (jobs.has(src)) return jobs.get(src);
    const promise = new Promise((resolve, reject) => {
      const script = document.createElement('script'); script.src = src + (src === './scene.js' ? '?v=20261026-map-labels' : '?v=20261026-camera-fallback');
      if (module) script.type = 'module'; script.async = true;
      script.onload = resolve; script.onerror = reject; document.head.append(script);
    });
    jobs.set(src, promise); return promise;
  };
  function whenNear(element, fn) {
    let requested = false;
    const run = () => { if (requested) return; requested = true; fn().catch(() => {}); };
    if (!window.IntersectionObserver) { setTimeout(run, 1500); return; }
    const observer = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) { observer.disconnect(); run(); }
    }, {rootMargin: '160px'});
    observer.observe(element);
  }
  // Optional visual code never blocks the first data request or the query controls.
  whenNear(document.getElementById('mapQuery'), async () => {
    await new Promise(resolve => requestAnimationFrame(() => setTimeout(resolve, 0)));
    await load('./map-data.js'); await load('./scene.js', true);
  });
  whenNear(document.getElementById('query'), async () => {
    await load('./metal-cards.js'); window.SchoolMetal?.update();
  });
})();
