(function(root){
"use strict";
const vertexSource="#version 300 es\nprecision highp float;\nout vec2 v_uv;\nvoid main(){\n vec2 p=vec2(float((gl_VertexID<<1)&2),float(gl_VertexID&2));\n v_uv=p;gl_Position=vec4(p*2.0-1.0,0.0,1.0);\n}\n";
const blurSource="#version 300 es\nprecision highp float;\nuniform sampler2D u_image;\nuniform vec2 u_direction;\nin vec2 v_uv;\nout vec4 outColor;\nvoid main(){\n // 9-tap Gaussian paired into five bilinear texture reads per pass.\n vec4 color=texture(u_image,v_uv)*0.2270270270;\n color+=texture(u_image,v_uv+u_direction*1.3846153846)*0.3162162162;\n color+=texture(u_image,v_uv-u_direction*1.3846153846)*0.3162162162;\n color+=texture(u_image,v_uv+u_direction*3.2307692308)*0.0702702703;\n color+=texture(u_image,v_uv-u_direction*3.2307692308)*0.0702702703;\n outColor=color;\n}\n";
const metalSource="#version 300 es\nprecision highp float;\nuniform sampler2D u_environment;\nuniform vec2 u_size;\nuniform mat3 u_rotation;\nuniform float u_radius;\nuniform float u_perspective;\nuniform float u_opticalInfluence;\nin vec2 v_uv;\nout vec4 outColor;\nfloat hash(vec2 p){vec3 p3=fract(vec3(p.xyx)*0.1031);p3+=dot(p3,p3.yzx+33.33);return fract((p3.x+p3.y)*p3.z);}\nfloat roundedBox(vec2 p,vec2 halfSize,float radius){vec2 q=abs(p)-halfSize+radius;return length(max(q,0.0))+min(max(q.x,q.y),0.0)-radius;}\nvoid main(){\n vec2 p=(v_uv-0.5)*u_size;\n float radius=min(u_radius,min(u_size.x,u_size.y)*0.5);\n float sd=roundedBox(p,u_size*0.5,radius),aa=max(fwidth(sd),0.5);\n float alpha=1.0-smoothstep(-aa,aa,sd);if(alpha<=0.0)discard;\n // Bevel normal from rounded-rectangle signed distance, plus stable micro noise.\n float e=0.25;\n vec2 g=vec2(roundedBox(p+vec2(e,0),u_size*0.5,radius)-roundedBox(p-vec2(e,0),u_size*0.5,radius),roundedBox(p+vec2(0,e),u_size*0.5,radius)-roundedBox(p-vec2(0,e),u_size*0.5,radius));\n vec2 outward=g/max(length(g),0.0001);\n float bevel=smoothstep(-7.0,0.0,sd)*1.15;\n vec2 micro=vec2(hash(floor(p*vec2(0.6,4.0))),hash(floor(p*vec2(0.3,6.0))+73.0))-0.5;\n vec3 localN=normalize(vec3(outward*sin(bevel)+micro*vec2(0.009,0.003),cos(bevel)));\n vec3 N=normalize(u_rotation*localN);\n vec3 surface=u_rotation*vec3(p,0.0),camera=vec3(0.0,0.0,u_perspective);\n vec3 I=normalize(surface-camera); // camera -> surface\n vec3 R=reflect(I,N);\n vec2 q=R.xy/max(R.z,0.2);\n vec2 UV=v_uv+u_opticalInfluence*u_opticalInfluence*q;\n // A planar 2D texture, not panorama/cubemap or a CSS gradient.\n vec3 reflected=texture(u_environment,clamp(UV,0.0,1.0)).rgb;\n float gray=dot(reflected,vec3(0.2126,0.7152,0.0722));\n float grain=(hash(vec2(floor(p.x*0.12),floor(p.y*3.0)))-0.5)*0.012;\n float metal=0.79+gray*0.18+grain*0.4;\n float rim=smoothstep(-3.0,-0.4,sd);metal+=rim*(gray-0.45)*0.16;\n metal=clamp(metal,0.75,0.99); // maintain dark HTML text contrast\n outColor=vec4(vec3(metal),alpha);\n}\n";
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
// damping=.16 means 16% velocity decay per 60Hz step, converted by elapsed time.
function stepSpring(
  axis,
  target,
  elapsed,
  stiffness = 120,
  damping = 0.16,
  limit = 12,
) {
  let remaining = clamp(elapsed, 0, 1 / 15);
  while (remaining > 0) {
    const dt = Math.min(remaining, 1 / 240);
    axis.velocity += (target - axis.value) * stiffness * dt;
    axis.velocity *= Math.pow(1 - damping, dt * 60);
    axis.value += axis.velocity * dt;
    if (Math.abs(axis.value) > limit) {
      axis.value = clamp(axis.value, -limit, limit);
      axis.velocity = 0;
    }
    remaining -= dt;
  }
  if (Math.abs(axis.value - target) < 0.002 && Math.abs(axis.velocity) < 0.01) {
    axis.value = target;
    axis.velocity = 0;
  }
  return axis.value !== target || axis.velocity !== 0;
}
// S * Rx(CSS) * Ry(CSS) * S: CSS Y points down; GLSL Y points up.
function rotationFromCSS(xDegrees, yDegrees, out = new Float32Array(9)) {
  const x = (-xDegrees * Math.PI) / 180,
    y = (yDegrees * Math.PI) / 180,
    sx = Math.sin(x),
    cx = Math.cos(x),
    sy = Math.sin(y),
    cy = Math.cos(y);
  out.set([cy, sx * sy, -cx * sy, 0, cx, sx, sy, -sx * cy, cx * cy]);
  return out;
}

// Only procedural Canvas2D shapes; no images or network requests.
function paintEnvironment(ctx, width, height, phase) {
  const pulse = Math.sin(Math.PI * Math.min(1, Math.max(0, phase)));
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = "#b7bec5";
  ctx.fillRect(0, 0, width, height);
  ctx.save();
  ctx.translate(width * (0.24 + pulse * 0.08), height * 0.45);
  ctx.rotate(-0.24);
  ctx.fillStyle = "#345b87";
  ctx.fillRect(-width * 0.34, -height, width * 0.5, height * 2);
  ctx.restore();
  const x = width * (0.77 - pulse * 0.08),
    y = height * 0.64,
    r = width * 0.33;
  // Gradient shades the sphere in the source scene, never the card material.
  const sphere = ctx.createRadialGradient(
    x - r * 0.35,
    y - r * 0.35,
    r * 0.03,
    x,
    y,
    r,
  );
  sphere.addColorStop(0, "#ffe5bb");
  sphere.addColorStop(0.38, "#ce8958");
  sphere.addColorStop(1, "#704e40");
  ctx.fillStyle = sphere;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.save();
  ctx.translate(width * (0.53 + pulse * 0.17), height * 0.4);
  ctx.rotate(-0.23);
  ctx.fillStyle = "#fff";
  ctx.fillRect(-width * 0.037, -height, width * 0.074, height * 2);
  ctx.fillStyle = "#f5f8fa";
  ctx.fillRect(width * 0.21, -height, width * 0.023, height * 2);
  ctx.restore();
}

function createMetalRenderer(canvas) {
  const gl = canvas.getContext("webgl2", {
    alpha: true,
    antialias: false,
    depth: false,
    stencil: false,
    premultipliedAlpha: false,
    powerPreference: "low-power",
  });
  if (!gl) return null;
  const resources = {
    Shader: [],
    Program: [],
    Texture: [],
    Framebuffer: [],
    VertexArray: [],
  };
  const stats = {
    frames: 0,
    uploads: 0,
    canvasResizes: 0,
    textureResizes: 0,
    disposed: false,
    created: 0,
    deleted: 0,
  };
  const owned = (kind, value) => {
    if (!value) throw new Error("GPU resource unavailable");
    resources[kind].push(value);
    stats.created++;
    return value;
  };
  const destroy = () => {
    if (stats.disposed) return;
    stats.disposed = true;
    for (const [kind, items] of Object.entries(resources)) {
      for (const item of items) {
        gl["delete" + kind](item);
        stats.deleted++;
      }
      items.length = 0;
    }
  };
  try {
    const shader = (type, source) => {
      const s = owned("Shader", gl.createShader(type));
      gl.shaderSource(s, source);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS))
        throw new Error(gl.getShaderInfoLog(s));
      return s;
    };
    const vertex = shader(gl.VERTEX_SHADER, vertexSource);
    const program = (source) => {
      const p = owned("Program", gl.createProgram());
      gl.attachShader(p, vertex);
      gl.attachShader(p, shader(gl.FRAGMENT_SHADER, source));
      gl.linkProgram(p);
      if (!gl.getProgramParameter(p, gl.LINK_STATUS))
        throw new Error(gl.getProgramInfoLog(p));
      return p;
    };
    const blur = program(blurSource),
      metal = program(metalSource),
      uniform = (p, n) => gl.getUniformLocation(p, n);
    const bu = {
      image: uniform(blur, "u_image"),
      direction: uniform(blur, "u_direction"),
    };
    const mu = Object.fromEntries(
      [
        "environment",
        "size",
        "rotation",
        "radius",
        "perspective",
        "opticalInfluence",
      ].map((n) => [n, uniform(metal, "u_" + n)]),
    );
    const vao = owned("VertexArray", gl.createVertexArray());
    const texture = () => {
      const t = owned("Texture", gl.createTexture());
      gl.bindTexture(gl.TEXTURE_2D, t);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      return t;
    };
    const source = texture(),
      horizontal = texture(),
      vertical = texture(),
      fboX = owned("Framebuffer", gl.createFramebuffer()),
      fboY = owned("Framebuffer", gl.createFramebuffer());
    const environment = document.createElement("canvas"),
      ctx = environment.getContext("2d", { alpha: false });
    if (!ctx) throw new Error("Canvas2D unavailable");
    const matrix = new Float32Array(9);
    let width = 0,
      height = 0,
      envW = 0,
      envH = 0,
      lastDpr = 0;
    function resize(cssW, cssH, maxDpr) {
      const dpr = Math.min(Math.max(window.devicePixelRatio || 1, 1), maxDpr),
        pixelW = Math.max(1, Math.round(cssW * dpr)),
        pixelH = Math.max(1, Math.round(cssH * dpr));
      // Checked each rendered frame, reset only if the dimensions/effective DPR change.
      if (
        canvas.width !== pixelW ||
        canvas.height !== pixelH ||
        lastDpr !== dpr
      ) {
        canvas.width = pixelW;
        canvas.height = pixelH;
        stats.canvasResizes++;
        lastDpr = dpr;
      }
      width = cssW;
      height = cssH;
      const nextW = Math.min(512, pixelW),
        nextH = Math.min(1024, Math.max(1, Math.round((nextW * cssH) / cssW)));
      if (nextW === envW && nextH === envH) return;
      envW = nextW;
      envH = nextH;
      environment.width = envW;
      environment.height = envH;
      stats.textureResizes++;
      gl.activeTexture(gl.TEXTURE0);
      for (const t of [source, horizontal, vertical]) {
        gl.bindTexture(gl.TEXTURE_2D, t);
        gl.texImage2D(
          gl.TEXTURE_2D,
          0,
          gl.RGBA8,
          envW,
          envH,
          0,
          gl.RGBA,
          gl.UNSIGNED_BYTE,
          null,
        );
      }
      for (const [fbo, t] of [
        [fboX, horizontal],
        [fboY, vertical],
      ]) {
        gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
        gl.framebufferTexture2D(
          gl.FRAMEBUFFER,
          gl.COLOR_ATTACHMENT0,
          gl.TEXTURE_2D,
          t,
          0,
        );
        if (
          gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE
        )
          throw new Error("Incomplete framebuffer");
      }
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    }
    function render({
      cssWidth,
      cssHeight,
      x,
      y,
      phase,
      maxDpr = 2,
      radius = 24,
      perspective = 900,
      opticalInfluence = 0.35,
    }) {
      if (
        stats.disposed ||
        gl.isContextLost() ||
        cssWidth <= 0 ||
        cssHeight <= 0
      )
        return;
      resize(cssWidth, cssHeight, maxDpr);
      paintEnvironment(ctx, envW, envH, phase);
      gl.bindVertexArray(vao);
      gl.disable(gl.DEPTH_TEST);
      gl.disable(gl.BLEND);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, source);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
      gl.texSubImage2D(
        gl.TEXTURE_2D,
        0,
        0,
        0,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        environment,
      );
      stats.uploads++;
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
      gl.useProgram(blur);
      gl.uniform1i(bu.image, 0);
      gl.viewport(0, 0, envW, envH);
      gl.bindFramebuffer(gl.FRAMEBUFFER, fboX);
      gl.uniform2f(bu.direction, 2.6 / envW, 0);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      gl.bindTexture(gl.TEXTURE_2D, horizontal);
      gl.bindFramebuffer(gl.FRAMEBUFFER, fboY);
      gl.uniform2f(bu.direction, 0, 2.6 / envH);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.useProgram(metal);
      gl.bindTexture(gl.TEXTURE_2D, vertical);
      gl.uniform1i(mu.environment, 0);
      gl.uniform2f(mu.size, width, height);
      gl.uniformMatrix3fv(mu.rotation, false, rotationFromCSS(x, y, matrix));
      gl.uniform1f(mu.radius, radius);
      gl.uniform1f(mu.perspective, perspective);
      gl.uniform1f(mu.opticalInfluence, opticalInfluence);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      stats.frames++;
    }
    return { render, destroy, stats, environment };
  } catch (error) {
    destroy();
    throw error;
  }
}

// One reusable renderer for the whole query list, not one WebGL context per school.
if (root.SchoolMetal) return;
const eligibleSelector = '.school[data-metal-eligible="true"]';
const canvas = document.createElement('canvas');
canvas.className = 'school-reflection'; canvas.setAttribute('aria-hidden', 'true');
const reduce = matchMedia('(prefers-reduced-motion: reduce)');
const highContrast = matchMedia('(forced-colors: active)');
const x = {value: 0, velocity: 0}, y = {value: 0, velocity: 0};
let renderer = null, active = null, raf = 0, last = 0, dead = false, attempted = false;
let targetX = 0, targetY = 0, pulseStart = 0, pulseEnd = 0, staticImage = '', touch = null;
let totalCreated = 0, totalDeleted = 0, lastStats = null;
const listeners = [];
const listen = (node, type, handler, options) => {
  node.addEventListener(type, handler, options);
  listeners.push(() => node.removeEventListener(type, handler, options));
};
const sizeObserver = root.ResizeObserver ? new ResizeObserver(() => wake()) : null;
function disposeRenderer() {
  if (!renderer) return;
  renderer.destroy(); totalDeleted += renderer.stats.deleted; lastStats = {...renderer.stats}; renderer = null;
}
function initialize() {
  if (renderer) return true;
  if (attempted || dead || highContrast.matches) return false;
  attempted = true;
  try {
    renderer = createMetalRenderer(canvas);
    if (!renderer) return false;
    totalCreated += renderer.stats.created;
    renderer.render({cssWidth:512,cssHeight:320,x:0,y:0,phase:1,maxDpr:1,radius:14,perspective:1200,opticalInfluence:.28});
    staticImage = canvas.toDataURL('image/png');
    document.documentElement.style.setProperty('--school-metal-image', 'url("' + staticImage + '")');
    return true;
  } catch (error) { disposeRenderer(); return false; }
}
function cancelFrame() { if (raf) cancelAnimationFrame(raf); raf = 0; last = 0; }
function release() {
  cancelFrame(); sizeObserver?.disconnect();
  if (active) { active.style.removeProperty('transform'); active.removeAttribute('data-metal-active'); }
  canvas.remove(); active = null; touch = null;
  targetX = targetY = x.value = y.value = x.velocity = y.velocity = 0;
}
function activate(card, pulse = true) {
  if (!card?.matches(eligibleSelector) || dead || highContrast.matches || !initialize()) return;
  if (active !== card) { release(); active = card; card.prepend(canvas); sizeObserver?.observe(card); }
  card.dataset.metalActive = 'true';
  pulseStart = performance.now(); pulseEnd = pulse && !reduce.matches ? pulseStart + 700 : pulseStart;
  wake();
}
function wake() { if (!raf && active && renderer && !dead && !document.hidden) raf = requestAnimationFrame(tick); }
function tick(now) {
  raf = 0;
  if (!active?.isConnected || !renderer || dead || document.hidden) { release(); return; }
  if (last && now - last < 30) { wake(); return; }
  const dt = last ? Math.min((now - last) / 1000, 1 / 15) : 1 / 30; last = now;
  let moving = false;
  if (reduce.matches) targetX = targetY = x.value = y.value = x.velocity = y.velocity = 0;
  else moving = stepSpring(x, targetX, dt, 120, .16, 2) | stepSpring(y, targetY, dt, 120, .16, 2);
  // HTML retains its original dimensions. Only a gentle visual transform is used.
  active.style.transform = 'perspective(1200px) rotateX(' + x.value + 'deg) rotateY(' + y.value + 'deg)';
  try {
    renderer.render({cssWidth:active.clientWidth,cssHeight:active.clientHeight,x:x.value,y:y.value,phase:reduce.matches?1:clamp((now-pulseStart)/700,0,1),maxDpr:1.5,radius:14,perspective:1200,opticalInfluence:.28});
  } catch (error) { release(); disposeRenderer(); return; }
  if (moving || (!reduce.matches && now < pulseEnd)) wake();
  else { last = 0; active.removeAttribute('data-metal-active'); }
}
function aim(event) {
  if (!active || reduce.matches) return;
  const rect = active.getBoundingClientRect();
  targetX = -clamp((event.clientY - rect.top) / rect.height * 2 - 1, -1, 1) * 2;
  targetY = clamp((event.clientX - rect.left) / rect.width * 2 - 1, -1, 1) * 2;
  active.dataset.metalActive = 'true'; wake();
}
function reset() { targetX = targetY = 0; pulseEnd = performance.now(); wake(); }
listen(document, 'pointerover', event => {
  if (event.pointerType === 'touch') return;
  const card = event.target.closest?.(eligibleSelector);
  if (card && !card.contains(event.relatedTarget)) activate(card);
}, {passive:true});
listen(document, 'pointermove', event => {
  if (event.pointerType === 'touch') {
    if (touch && touch.id === event.pointerId && (event.clientX-touch.x)**2+(event.clientY-touch.y)**2 > 100) release();
    return;
  }
  const card = event.target.closest?.(eligibleSelector);
  if (card && active !== card) activate(card);
  if (active?.contains(event.target)) aim(event);
}, {passive:true});
listen(document, 'pointerout', event => {
  if (active && active.contains(event.target) && !active.contains(event.relatedTarget)) reset();
}, {passive:true});
listen(document, 'pointerdown', event => {
  if (event.isPrimary === false || event.button !== 0) return;
  const card = event.target.closest?.(eligibleSelector);
  if (!card) { release(); return; }
  activate(card);
  if (event.pointerType === 'touch') touch = {id:event.pointerId,x:event.clientX,y:event.clientY};
  else aim(event);
}, {passive:true});
listen(document, 'pointerup', event => { if (touch?.id === event.pointerId) { touch = null; reset(); } }, {passive:true});
listen(document, 'pointercancel', release, {passive:true});
listen(document, 'focusin', event => {
  const card = event.target.closest?.(eligibleSelector); if (card) activate(card, false); else release();
});
listen(document, 'keydown', event => { if (event.key === 'Escape') release(); });
listen(root, 'scroll', release, {passive:true});
listen(root, 'resize', release, {passive:true});
listen(root, 'blur', release);
listen(document, 'visibilitychange', () => { if (document.hidden) release(); });
listen(reduce, 'change', release);
listen(highContrast, 'change', () => { release(); if (!highContrast.matches) update(); });
listen(canvas, 'webglcontextlost', event => { event.preventDefault(); release(); disposeRenderer(); });
listen(canvas, 'webglcontextrestored', () => { attempted = false; initialize(); });
function update() {
  if (active && !active.isConnected) release();
  // The module itself is loaded near the query. One static frame is sufficient
  // for every qualifying card; a list without qualifying schools allocates no GPU.
  if (document.querySelector(eligibleSelector)) initialize();
}
listen(document, 'school-cards:updated', update);
listen(root, 'pageshow', update);
// A new query can appear after the lazy loader has run while data was still pending.
let nearObserver;
if (root.IntersectionObserver) {
  nearObserver = new IntersectionObserver(entries => { if (entries.some(entry => entry.isIntersecting)) update(); }, {rootMargin:'240px'});
  const host = document.querySelector('#localQuery,#queryRoot'); if (host) nearObserver.observe(host);
}
function destroy() {
  if (dead) return;
  release(); dead = true; listeners.forEach(remove => remove()); sizeObserver?.disconnect(); nearObserver?.disconnect();
  disposeRenderer(); document.documentElement.style.removeProperty('--school-metal-image'); staticImage = '';
}
listen(root, 'pagehide', event => { if (event.persisted) release(); else destroy(); });
root.SchoolMetal = {
  update, release, destroy,
  diagnostics: () => ({active:!!active,animating:!!raf,contexts:renderer?1:0,created:totalCreated,deleted:totalDeleted,angles:[x.value,y.value],stats:renderer?{...renderer.stats}:lastStats})
};
update();

})(window);
