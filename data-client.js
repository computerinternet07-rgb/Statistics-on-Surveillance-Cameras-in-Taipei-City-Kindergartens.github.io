(function (root) {
  'use strict';
  const D = root.CameraData;
  const MAX_BYTES = 1000000;
  const columns = ['type','district','name','outdoor','indoor','group'];
  const validEndpoint = url => /^https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]+\/exec$/.test(url || '');

  async function readJSON(response) {
    if (!response.ok || !/^application\/json(?:\s*;|$)/i.test(response.headers.get('content-type') || '')) throw new Error('EXPECTED_JSON');
    if (Number(response.headers.get('content-length')) > MAX_BYTES) throw new Error('RESPONSE_TOO_LARGE');
    let text;
    if (response.body?.getReader && typeof TextDecoder !== 'undefined') {
      const reader = response.body.getReader(), decoder = new TextDecoder();
      let bytes = 0; text = '';
      try {
        for (;;) {
          const {done, value} = await reader.read();
          if (done) break;
          bytes += value.byteLength;
          if (bytes > MAX_BYTES) { await reader.cancel(); throw new Error('RESPONSE_TOO_LARGE'); }
          text += decoder.decode(value, {stream: true});
        }
        text += decoder.decode();
      } finally { reader.releaseLock(); }
    } else {
      text = await response.text();
      if (new TextEncoder().encode(text).byteLength > MAX_BYTES) throw new Error('RESPONSE_TOO_LARGE');
    }
    // A response is data only: never execute scripts or interpret a callback.
    return JSON.parse(text);
  }

  root.PublicDataClient = function (config, onData, onStatus) {
    const key = 'taipei-camera:public:v3:' + config.GAS_URL;
    const legacyKey = 'taipei-camera:public:v2:' + config.GAS_URL;
    const staleAfter = Number(config.STALE_AFTER_MS) || 7200000;
    const maxAge = Number(config.MAX_SNAPSHOT_AGE_MS) || 604800000;
    let current = null, source = '', currentFingerprint = '', timer = 0;
    let pending = null, stopped = false, started = false, lastAttempt = 0;
    const controllers = new Set();
    const age = data => Date.now() - Date.parse(data?.generatedAt);
    const usable = data => D.validate(data) && columns.every(k => data.columns[k].every(value => value.length <= 300)) &&
      data.groups.every(group => group.label.length <= 40) && Number.isFinite(age(data)) && age(data) >= -300000 && age(data) <= maxAge;
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
    async function requestJSON(url, liveRequest) {
      const controller = new AbortController(); controllers.add(controller);
      const timeout = setTimeout(() => controller.abort(), liveRequest ? 12000 : 6000);
      try {
        const response = await fetch(url.href, {
          method: 'GET', mode: liveRequest ? 'cors' : 'same-origin',
          credentials: 'omit', cache: 'no-cache', referrerPolicy: 'no-referrer',
          redirect: liveRequest ? 'follow' : 'error',
          headers: {Accept: 'application/json'}, signal: controller.signal
        });
        if (response.url) {
          const finalOrigin = new URL(response.url).origin;
          if (liveRequest ? !['https://script.google.com','https://script.googleusercontent.com'].includes(finalOrigin) : finalOrigin !== location.origin) throw new Error('UNEXPECTED_ORIGIN');
        }
        return await readJSON(response);
      } finally { clearTimeout(timeout); controllers.delete(controller); }
    }
    async function snapshot() {
      try {
        const url = new URL(config.PUBLIC_DATA_URL || './public-data.json', location.href);
        if (url.origin !== location.origin || url.username || url.password) return false;
        return accept(await requestJSON(url, false), 'snapshot');
      } catch (ignore) { return false; }
    }
    async function live() {
      if (!validEndpoint(config.GAS_URL)) throw new Error('INVALID_ENDPOINT');
      const url = new URL(config.GAS_URL); url.searchParams.set('api', 'public-data');
      return requestJSON(url, true);
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
      stopped = true; clearInterval(timer); controllers.forEach(controller => controller.abort()); controllers.clear();
      document.removeEventListener('visibilitychange', resume);
      root.removeEventListener('online', resume); root.removeEventListener('pageshow', resume);
    }
    return {
      start() {
        if (started || stopped) return;
        started = true;
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
