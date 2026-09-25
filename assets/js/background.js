// Fondo animado: espiral difuminada morada/rosa girando en círculos (WebGL).
// Si el navegador no soporta WebGL se usa un degradado cónico en CSS (.bg-fallback).

const VERT = `
attribute vec2 aPos;
void main() { gl_Position = vec4(aPos, 0.0, 1.0); }
`;

const FRAG = `
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
uniform vec2 uRes;
uniform float uRot1;
uniform float uRot2;
uniform float uOrbit;
uniform float uHue;
uniform vec2 uFlow;
uniform vec2 uMouse;
uniform float uIntensity;

float hash(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}
float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  float a = hash(i);
  float b = hash(i + vec2(1.0, 0.0));
  float c = hash(i + vec2(0.0, 1.0));
  float d = hash(i + vec2(1.0, 1.0));
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}
float fbm(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  for (int i = 0; i < 4; i++) {
    v += a * noise(p);
    p = p * 2.03 + 17.1;
    a *= 0.5;
  }
  return v;
}

void main() {
  vec2 uv = (gl_FragCoord.xy - 0.5 * uRes) / min(uRes.x, uRes.y);
  // el centro de la espiral orbita lentamente en círculo
  vec2 center = vec2(cos(uOrbit), sin(uOrbit)) * 0.10 + uMouse * 0.035;
  vec2 p = uv - center;
  // deformación orgánica para que se vea difuminada y viva
  vec2 w = vec2(fbm(p * 1.6 + uFlow), fbm(p * 1.6 - uFlow + 5.2)) - 0.5;
  p += w * 0.22;

  float r = length(p);
  float a = atan(p.y, p.x);
  float lr = log(r + 0.035);

  float s1 = pow(0.5 + 0.5 * sin(a * 2.0 + lr * 4.2 - uRot1), 2.4);
  float s2 = pow(0.5 + 0.5 * sin(a * 3.0 - lr * 2.6 + uRot2), 3.2);
  float env = (1.0 - smoothstep(0.06, 1.45, r)) * smoothstep(0.0, 0.2, r);
  float hue = 0.5 + 0.5 * sin(a + uHue + r * 2.2);

  vec3 purple = vec3(0.52, 0.22, 0.98);
  vec3 pink = vec3(1.0, 0.20, 0.72);
  vec3 col = vec3(0.018, 0.006, 0.035);
  col += mix(purple, pink, hue) * s1 * env * 0.78 * uIntensity;
  col += mix(pink, purple, hue) * s2 * env * 0.30 * uIntensity;
  col += mix(purple, pink, 0.4) * exp(-r * r * 14.0) * 0.30 * uIntensity;
  col += vec3(1.0, 0.86, 1.0) * pow(s1, 8.0) * env * 0.06 * uIntensity;

  float vig = 1.0 - smoothstep(0.3, 1.75, length(uv));
  col *= vig;
  // tramado para evitar bandas en los degradados oscuros
  col += (hash(gl_FragCoord.xy + uFlow * 91.0) - 0.5) * (1.5 / 255.0);
  gl_FragColor = vec4(col, 1.0);
}
`;

function compile(gl, type, src) {
  const sh = gl.createShader(type);
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(sh);
    gl.deleteShader(sh);
    throw new Error(log || 'shader');
  }
  return sh;
}

export function startBackground(canvas, { intensity = 1 } = {}) {
  if (!canvas) return () => {};
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const fail = () => {
    document.documentElement.classList.add('no-webgl');
    return () => {};
  };

  let gl;
  try {
    gl = canvas.getContext('webgl', {
      alpha: false, antialias: false, depth: false, stencil: false,
      premultipliedAlpha: false, preserveDrawingBuffer: false, powerPreference: 'low-power',
    });
  } catch { gl = null; }
  if (!gl) return fail();

  let prog, uni, raf = 0, running = true, lost = false;
  const TAU = Math.PI * 2;
  const mouse = { x: 0, y: 0, tx: 0, ty: 0 };

  function init() {
    try {
      prog = gl.createProgram();
      gl.attachShader(prog, compile(gl, gl.VERTEX_SHADER, VERT));
      gl.attachShader(prog, compile(gl, gl.FRAGMENT_SHADER, FRAG));
      gl.linkProgram(prog);
      if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
    } catch (e) {
      console.warn('[fondo] WebGL no disponible:', e);
      return false;
    }
    gl.useProgram(prog);
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    // un triángulo que cubre toda la pantalla
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, 'aPos');
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    uni = {};
    for (const n of ['uRes', 'uRot1', 'uRot2', 'uOrbit', 'uHue', 'uFlow', 'uMouse', 'uIntensity']) {
      uni[n] = gl.getUniformLocation(prog, n);
    }
    return true;
  }

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    // la espiral es difusa: renderizar a menos resolución la hace más suave y ligera
    const scale = window.innerWidth < 768 ? 0.42 : 0.5;
    const w = Math.max(2, Math.round(window.innerWidth * dpr * scale));
    const h = Math.max(2, Math.round(window.innerHeight * dpr * scale));
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
      gl.viewport(0, 0, w, h);
    }
  }

  const speed = reduced ? 0.12 : 1;
  const start = performance.now();
  let last = 0;
  const minFrame = reduced ? 1000 / 12 : 1000 / 50;

  function frame(now) {
    raf = requestAnimationFrame(frame);
    if (!running || lost) return;
    if (now - last < minFrame) return;
    last = now;
    const t = ((now - start) / 1000) * speed;
    mouse.x += (mouse.tx - mouse.x) * 0.04;
    mouse.y += (mouse.ty - mouse.y) * 0.04;
    gl.uniform2f(uni.uRes, canvas.width, canvas.height);
    gl.uniform1f(uni.uRot1, (t * 0.35) % TAU);
    gl.uniform1f(uni.uRot2, (t * 0.22) % TAU);
    gl.uniform1f(uni.uOrbit, (t * 0.12) % TAU);
    gl.uniform1f(uni.uHue, (t * 0.15) % TAU);
    gl.uniform2f(uni.uFlow, Math.cos(t * 0.05) * 2.0, Math.sin(t * 0.05) * 2.0);
    gl.uniform2f(uni.uMouse, mouse.x, mouse.y);
    gl.uniform1f(uni.uIntensity, intensity);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  if (!init()) return fail();
  resize();
  canvas.classList.add('is-ready');
  raf = requestAnimationFrame(frame);

  let rt;
  const onResize = () => { clearTimeout(rt); rt = setTimeout(resize, 120); };
  const onVis = () => { running = !document.hidden; };
  const onMove = (e) => {
    mouse.tx = (e.clientX / window.innerWidth - 0.5) * 2;
    mouse.ty = -(e.clientY / window.innerHeight - 0.5) * 2;
  };
  window.addEventListener('resize', onResize, { passive: true });
  document.addEventListener('visibilitychange', onVis);
  if (!reduced) window.addEventListener('pointermove', onMove, { passive: true });

  canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); lost = true; });
  canvas.addEventListener('webglcontextrestored', () => { if (init()) { lost = false; resize(); } });

  return () => {
    cancelAnimationFrame(raf);
    window.removeEventListener('resize', onResize);
    document.removeEventListener('visibilitychange', onVis);
    window.removeEventListener('pointermove', onMove);
  };
}
