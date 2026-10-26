(function (root) {
  'use strict';
  const D = root.CameraData;
  const validEndpoint = url => /^https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]+\/exec$/.test(url || '');
  const callbackName = () => {
    const bytes = new Uint8Array(16);
    if (root.crypto?.getRandomValues) root.crypto.getRandomValues(bytes);
    else for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
    return '__tpeCamera_' + Array.from(bytes, value => value.toString(16).padStart(2, '0')).join('');
  };

  root.PublicDataClient = function (config, onData, onStatus) {
    const key = 'taipei-camera:public:v3:' + config.GAS_URL;
    const legacyKey = 'taipei-camera:public:v2:' + config.GAS_URL;
    const staleAfter = Number(config.STALE_AFTER_MS) || 7200000;
    const maxAge = Number(config.MAX_SNAPSHOT_AGE_MS) || 604800000;
    let current = null, source = '', currentFingerprint = '', timer = 0;
    let pending = null, cancelLive = null, stopped = false, lastAttempt = 0;
    let snapshotController = null;
    const age = data => Date.now() - Date.parse(data?.generatedAt);
    const usable = data => D.validate(data) && Number.isFinite(age(data)) && age(data) >= -300000 && age(data) <= maxAge;
    const fingerprint = data => JSON.stringify([data.columns, data.groups, data.dataAsOf, data.academicYear]);

    function status(failed = false) {
      if (stopped) return;
      if (!current) onStatus({kind: failed ? 'error' : 'loading'});
      else if (age(current) > staleAfter) onStatus({kind: 'stale', generatedAt: current.generatedAt, failed});
      else onStatus({kind: 'ready', generatedAt: current.generatedAt});
    }
    function accept(data, via) {
      if (stopped || !usable(data)) return false;
      // A slower snapshot response may not overwrite a newer live response.
      if (current && Date.parse(data.generatedAt) < Date.parse(current.generatedAt)) return true;
      const nextFingerprint = fingerprint(data);
      const changed = !current || nextFingerprint !== currentFingerprint;
      current = data; source = via; currentFingerprint = nextFingerprint;
      try { localStorage.setItem(key, JSON.stringify(data)); } catch (ignore) { /* LINE/private storage may be unavailable. */ }
      if (changed) onData(data, {source: via});
      status();
      return true;
    }
    function cached() {
      for (const name of [key, legacyKey]) {
        try {
          const data = JSON.parse(localStorage.getItem(name));
          if (usable(data)) return data;
        } catch (ignore) { /* Corrupt or blocked storage must not stop networking. */ }
      }
      return null;
    }
    async function snapshot() {
      let timeout;
      try {
        const url = new URL(config.PUBLIC_DATA_URL || './public-data.json', location.href);
        if (url.origin !== location.origin) return false;
        snapshotController = new AbortController();
        timeout = setTimeout(() => snapshotController?.abort(), 6000);
        const response = await fetch(url.href, {credentials: 'omit', cache: 'no-cache', signal: snapshotController.signal});
        if (!response.ok) return false;
        const text = await response.text();
        if (text.length > 1000000) return false;
        return accept(JSON.parse(text), 'snapshot');
      } catch (ignore) { return false; }
      finally { clearTimeout(timeout); snapshotController = null; }
    }
    function live() {
      return new Promise((resolve, reject) => {
        if (!validEndpoint(config.GAS_URL)) { reject(new Error('INVALID_ENDPOINT')); return; }
        const name = callbackName(), script = document.createElement('script');
        const url = new URL(config.GAS_URL);
        url.searchParams.set('api', 'public-data'); url.searchParams.set('callback', name);
        let finished = false, timeout;
        function finish(error, data) {
          if (finished) return;
          finished = true; clearTimeout(timeout); script.remove();
          delete root[name]; cancelLive = null;
          if (error) reject(error); else resolve(data);
        }
        root[name] = data => finish(usable(data) ? null : new Error('INVALID_DATA'), data);
        script.async = true; script.src = url.href; script.referrerPolicy = 'no-referrer';
        script.onerror = () => finish(new Error('NETWORK_ERROR'));
        cancelLive = () => finish(new Error('CANCELLED'));
        timeout = setTimeout(() => finish(new Error('TIMEOUT')), 18000);
        // Public read-only JSONP works without Google iframe, login, cookies or CORS.
        document.head.append(script);
      });
    }
    function refresh(force = false) {
      if (stopped || pending) return pending || Promise.resolve();
      if (!force && Date.now() - lastAttempt < 60000) return Promise.resolve();
      lastAttempt = Date.now(); status();
      const fromSnapshot = snapshot();
      const fromLive = live().then(data => accept(data, 'live')).catch(() => false);
      pending = Promise.all([fromSnapshot, fromLive]).then(results => {
        if (!stopped) status(!results.some(Boolean));
      }).finally(() => { pending = null; });
      return pending;
    }
    function resume() { if (!document.hidden) refresh(); }
    function destroy() {
      stopped = true; clearInterval(timer); cancelLive?.(); snapshotController?.abort();
      document.removeEventListener('visibilitychange', resume);
      root.removeEventListener('online', resume); root.removeEventListener('pageshow', resume);
    }
    return {
      start() {
        const data = cached(); if (data) accept(data, 'cache');
        refresh(true);
        timer = setInterval(resume, Math.max(60000, Number(config.POLL_MS) || 300000));
        document.addEventListener('visibilitychange', resume);
        root.addEventListener('online', resume); root.addEventListener('pageshow', resume);
      },
      refresh: () => refresh(true), destroy,
      diagnostics: () => ({source, generatedAt: current?.generatedAt || null, pending: !!pending, records: current?.columns.name.length || 0})
    };
  };
})(window);
