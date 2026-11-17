// The sky and the light that goes with it, from one number: the hour, from noon to sunset. The dome is a painted
// gradient, deep blue overhead and pale at the horizon, with the clouds laid over it from their cube map and the
// far mountains over those; the same colours light the grass, the far land, the clouds and the mountains.
// Colours are in linear light and meant to be seen as written: the frame's tone curve leaves everything below
// white alone.
import * as THREE from 'three';
import { COMMON } from '../lib/index.js';
import { createBackdrop } from './backdrop.js';
import { createClouds } from './clouds.js';
import { HERO } from './world.js';

// e: degrees the sun is above the horizon
const KEYS = [
  {
    // sunset
    e: 2,
    sun: [2.5, 0.95, 0.34],
    amb: [0.2, 0.24, 0.5],
    bounce: [0.08, 0.06, 0.04],
    zenith: [0.028, 0.085, 0.36],
    mid: [0.34, 0.33, 0.56],
    horizon: [1.12, 0.56, 0.24],
    glow: [2.2, 0.9, 0.3],
    fog: [0.6, 0.42, 0.42],
    fogSun: [1.8, 0.8, 0.3],
    haze: 0.00017,
    cloudLit: [1.6, 0.74, 0.4],
    cloudMid: [0.82, 0.4, 0.42],
    cloudShade: [0.27, 0.22, 0.45],
    cloudUnder: [0.16, 0.14, 0.34],
    exposure: 1.12,
  },
  {
    // golden hour
    e: 11,
    sun: [3.0, 1.9, 0.9],
    amb: [0.3, 0.36, 0.62],
    bounce: [0.12, 0.11, 0.05],
    zenith: [0.03, 0.14, 0.46],
    mid: [0.2, 0.4, 0.66],
    horizon: [1.0, 0.76, 0.44],
    glow: [1.6, 0.9, 0.35],
    fog: [0.66, 0.6, 0.58],
    fogSun: [1.5, 0.95, 0.5],
    haze: 0.0002,
    cloudLit: [1.5, 1.1, 0.7],
    cloudMid: [0.84, 0.64, 0.56],
    cloudShade: [0.34, 0.34, 0.52],
    cloudUnder: [0.22, 0.22, 0.42],
    exposure: 1,
  },
  {
    e: 27,
    sun: [2.75, 2.4, 1.8],
    amb: [0.3, 0.45, 0.78],
    bounce: [0.1, 0.15, 0.05],
    zenith: [0.04, 0.26, 0.62],
    mid: [0.095, 0.4, 0.72],
    horizon: [0.46, 0.7, 0.82],
    glow: [0.7, 0.62, 0.42],
    fog: [0.42, 0.68, 0.84],
    fogSun: [0.85, 0.84, 0.78],
    haze: 0.00017,
    cloudLit: [1.26, 1.2, 1.08],
    cloudMid: [0.62, 0.74, 0.86],
    cloudShade: [0.37, 0.51, 0.7],
    cloudUnder: [0.3, 0.44, 0.64],
    exposure: 1,
  },
  {
    e: 50,
    sun: [2.7, 2.55, 2.2],
    amb: [0.3, 0.47, 0.82],
    bounce: [0.1, 0.16, 0.05],
    zenith: [0.035, 0.25, 0.62],
    mid: [0.08, 0.39, 0.72],
    horizon: [0.38, 0.7, 0.84],
    glow: [0.5, 0.5, 0.45],
    fog: [0.4, 0.67, 0.85],
    fogSun: [0.66, 0.78, 0.9],
    haze: 0.00017,
    cloudLit: [1.24, 1.22, 1.16],
    cloudMid: [0.62, 0.74, 0.86],
    cloudShade: [0.37, 0.51, 0.7],
    cloudUnder: [0.3, 0.44, 0.64],
    exposure: 1,
  },
];

function blend(e) {
  let a = KEYS[0];
  let b = KEYS[KEYS.length - 1];
  for (let i = 0; i < KEYS.length - 1; i++) {
    if (e >= KEYS[i].e && e <= KEYS[i + 1].e) {
      a = KEYS[i];
      b = KEYS[i + 1];
      break;
    }
  }
  if (e <= KEYS[0].e) b = a;
  if (e >= b.e) a = b;
  const t = a === b ? 0 : (e - a.e) / (b.e - a.e);
  const out = {};
  for (const k of Object.keys(a)) out[k] = Array.isArray(a[k]) ? a[k].map((v, i) => v + (b[k][i] - v) * t) : a[k] + (b[k] - a[k]) * t;
  return out;
}

/** The last hour there is: sunset. */
export const SUNSET = 20.4;

/**
 * The sun at an hour, 12 to sunset: sets `out` to its direction and returns its degrees above the horizon. It
 * comes down on the left of the way the valley runs and swings round towards it, so by evening it stands low over
 * the mountains.
 */
function sunAt(hour, out) {
  const [dx, dz] = HERO;
  const t = THREE.MathUtils.clamp((hour - 12) / 8.5, 0, 1);
  const e = 64 - 62 * t ** 1.25;
  const left = THREE.MathUtils.degToRad(88 - 64 * t);
  const el = THREE.MathUtils.degToRad(e);
  const hx = Math.cos(left) * dx + Math.sin(left) * dz;
  const hz = Math.cos(left) * dz - Math.sin(left) * dx;
  out.set(hx * Math.cos(el), Math.sin(el), hz * Math.cos(el)).normalize();
  return e;
}

const vertex = /* glsl */ `
out vec3 vDir;
void main() {
  vDir = position;
  vec4 p = projectionMatrix * vec4(mat3(viewMatrix) * position, 1.0);
  gl_Position = p.xyww;
}
`;

const fragment = /* glsl */ `
${COMMON}
precision highp samplerCube;
layout(location = 0) out vec4 outC;
in vec3 vDir;
uniform vec3 uZenith, uMid, uHorizon, uGlow;
uniform samplerCube tClouds;
uniform sampler2D tBack0, tBack1, tBack2;
uniform vec3 uBankLit, uBankShade;
uniform vec2 uBackdropEl;
// The heavens behind the painted day: a river of nebula, two far spirals, the stars and a vast moon. uCosmos is
// how much of it shows through, from a ghost of it at noon to all of it at sunset.
uniform float uCosmos;
uniform vec3 uMoonDir;
uniform mat3 uGalaxy;

float keepSharp = 0.0;
float h31(vec3 p) {
  p = fract(p * 0.1031);
  p += dot(p, p.zyx + 31.32);
  return fract((p.x + p.y) * p.z);
}
float vnoise(vec3 p) {
  vec3 i = floor(p);
  vec3 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(h31(i), h31(i + vec3(1, 0, 0)), f.x), mix(h31(i + vec3(0, 1, 0)), h31(i + vec3(1, 1, 0)), f.x), f.y),
             mix(mix(h31(i + vec3(0, 0, 1)), h31(i + vec3(1, 0, 1)), f.x), mix(h31(i + vec3(0, 1, 1)), h31(i + vec3(1, 1, 1)), f.x), f.y), f.z);
}
float fbm(vec3 p) {
  float s = 0.0, a = 0.5;
  for (int i = 0; i < 5; i++) { s += a * vnoise(p); p = p * 2.03 + 17.1; a *= 0.5; }
  return s;
}
// a painter's tones: a few flat steps with a short soft turn between them
float tones(float v, float n) { float x = v * n; return (floor(x) + smoothstep(0.42, 0.58, fract(x))) / n; }

// one far spiral, seen at a slant
vec3 spiral(vec3 d, vec3 at, vec3 up, float size, vec3 tint) {
  vec3 r = normalize(cross(up, at));
  vec3 u = cross(at, r);
  float f = dot(d, at);
  if (f < 0.9) return vec3(0.0);
  vec2 q = vec2(dot(d, r), dot(d, u)) / size;
  q.y /= 0.42;
  float rad = length(q);
  float arms = 0.5 + 0.5 * cos(2.0 * (atan(q.y, q.x) - 2.6 * log(rad + 0.05)) );
  float body = exp(-rad * 2.6) * (0.35 + 0.65 * arms) + exp(-rad * rad * 60.0) * 1.6;
  return tint * tones(clamp(body, 0.0, 1.2) / 1.2, 4.0) * 1.2;
}

vec4 heavens(vec3 d, float sd) {
  vec3 g = uGalaxy * d;
  // the river of the galaxy: a band across the sky, torn by lanes of dust
  float lat = g.y + 0.12 * (fbm(g * 2.1) - 0.5);
  float band = exp(-lat * lat / 0.05);
  float cloud = fbm(g * 3.4 + vec3(0.0, 0.0, uTime * 0.002));
  float dust = smoothstep(0.48, 0.62, fbm(g * 6.5 + 4.0)) * exp(-lat * lat / 0.012);
  float neb = clamp(band * (0.25 + 1.1 * cloud * cloud) - dust * 0.7, 0.0, 1.0);
  float t = tones(neb, 5.0);
  vec3 deep = vec3(0.05, 0.03, 0.16);
  vec3 violet = vec3(0.34, 0.12, 0.55);
  vec3 rose = vec3(0.95, 0.32, 0.55);
  vec3 gold = vec3(1.6, 1.05, 0.55);
  vec3 col = mix(deep, violet, smoothstep(0.0, 0.4, t));
  col = mix(col, rose, smoothstep(0.35, 0.7, t));
  col = mix(col, gold, smoothstep(0.72, 1.0, t));
  // a cool veil of teal beside the river
  float veil = smoothstep(0.55, 0.75, fbm(g * 2.2 + 9.0)) * exp(-pow(lat - 0.28, 2.0) / 0.03);
  col = mix(col, vec3(0.12, 0.55, 0.62), tones(veil, 3.0) * 0.8);
  float amount = max(t, veil * 0.8);
  // two far spirals
  col += spiral(d, normalize(uGalaxy[1] * 0.3 + vec3(0.55, 0.62, -0.4)), vec3(0.3, 1.0, 0.2), 0.07, vec3(0.9, 0.75, 1.1));
  col += spiral(d, normalize(vec3(-0.7, 0.42, 0.45)), vec3(-0.4, 1.0, 0.1), 0.045, vec3(0.6, 0.85, 1.2));
  // the stars: one in each cell of the sky at most, more of them along the river
  vec3 q = d * 210.0;
  vec3 cell = floor(q);
  float star = 0.0;
  vec3 starTint = vec3(1.0);
  for (int k = 0; k < 2; k++) {
    vec3 c = cell + (k == 0 ? vec3(0.0) : vec3(0.5));
    vec3 cc = floor(c);
    float r = h31(cc);
    if (r < 0.2 + 0.55 * band) {
      vec3 p = cc + 0.25 + 0.5 * vec3(h31(cc + 1.3), h31(cc + 2.7), h31(cc + 4.1)) - (k == 0 ? vec3(0.0) : vec3(0.5));
      float dd = length(q - p);
      float size = 0.05 + 0.14 * pow(h31(cc + 7.7), 6.0);
      float tw = 0.75 + 0.25 * sin(uTime * (1.5 + 3.0 * h31(cc + 9.1)) + r * 40.0);
      float s = smoothstep(size + 0.06, size, dd) * tw * (0.4 + 1.8 * pow(h31(cc + 5.5), 3.0));
      if (s > star) { star = s; starTint = mix(vec3(0.7, 0.8, 1.3), vec3(1.4, 1.05, 0.7), h31(cc + 3.3)); }
    }
  }
  col += starTint * star * 2.2;
  keepSharp = star;
  return vec4(col, clamp(amount + star, 0.0, 1.0));
}

// the vast moon: a disc in two tones of paint, lit from the side the sun is on, with a halo round it
vec3 moon(vec3 d, vec3 col, out float cover) {
  cover = 0.0;
  float R = 0.115;
  vec3 m = normalize(uMoonDir);
  float f = dot(d, m);
  float ang = acos(clamp(f, -1.0, 1.0));
  // the halo: a soft glow and a thin ring, as the old paintings give a holy thing
  float halo = exp(-max(ang - R, 0.0) * 11.0) * 0.45 + smoothstep(0.007, 0.0, abs(ang - R * 1.45)) * 0.28 + smoothstep(0.004, 0.0, abs(ang - R * 1.9)) * 0.1;
  col += vec3(0.9, 0.85, 1.2) * halo * uCosmos;
  if (ang > R + 0.004) return col;
  vec3 r = normalize(cross(vec3(0.0, 1.0, 0.0), m));
  vec3 u = cross(m, r);
  vec2 q = vec2(dot(d, r), dot(d, u)) / R;
  float z = sqrt(max(0.0, 1.0 - dot(q, q)));
  vec3 n = normalize(q.x * r + q.y * u + z * -m);
  // the sun's side of it lit, the far side in a cool shade that still glows
  vec3 s = normalize(uSunDir - m * dot(uSunDir, m) * 0.6);
  float lit = smoothstep(-0.04, 0.04, dot(n, s) + 0.15);
  float maria = smoothstep(0.52, 0.56, fbm(vec3(q * 2.6, 3.0)));
  float crater = smoothstep(0.62, 0.64, fbm(vec3(q * 7.0, 8.0)));
  vec3 litPaint = mix(vec3(2.1, 1.95, 1.7), vec3(1.45, 1.35, 1.4), maria);
  litPaint = mix(litPaint, vec3(1.7, 1.55, 1.5), crater * 0.6);
  vec3 shadePaint = mix(vec3(0.16, 0.15, 0.36), vec3(0.11, 0.1, 0.28), maria);
  vec3 disc = mix(shadePaint, litPaint, lit);
  cover = smoothstep(R + 0.004, R, ang) * uCosmos;
  return mix(col, disc, cover);
}

void main() {
  vec3 d = normalize(vDir);
  float h = max(d.y, 0.0);
  vec3 col = mix(uHorizon, uMid, smoothstep(0.0, 0.3, pow(h, 0.8)));
  col = mix(col, uZenith, smoothstep(0.18, 0.85, h));
  float sd = max(dot(d, uSunDir), 0.0);
  col += uGlow * (pow(sd, 6.0) * 0.05 + pow(sd, 90.0) * 0.3 + pow(sd, 1400.0) * 1.4) + uSunColor * smoothstep(0.99988, 0.99996, sd) * 8.0;
  // the heavens show through the day's blue, most of all overhead
  {
    vec4 hv = heavens(d, sd);
    float above = smoothstep(-0.02, 0.35, d.y);
    float through = uCosmos * above;
    col = mix(col, col * 0.3 + vec3(0.02, 0.01, 0.07), through * 0.85 * smoothstep(-0.05, 0.55, d.y));
    col += hv.rgb * hv.a * through * (0.55 + 0.45 * uCosmos);
    float mc;
    col = moon(d, col, mc);
    keepSharp *= through * (1.0 - mc);
  }
  vec4 c = texture(tClouds, d);
  // under the heavens the high clouds thin away, and the low banks stay
  c *= 1.0 - 0.7 * uCosmos * smoothstep(0.12, 0.45, d.y);
  // towards the sun a cloud's edge is lit through
  c.rgb += uGlow * pow(sd, 40.0) * 0.5 * c.a * (1.0 - c.a) * 4.0;
  col = col * (1.0 - c.a) + c.rgb;
  // the far country stands in front of the clouds, mixed from its paint with this hour's light
  float v = (asin(clamp(d.y, -1.0, 1.0)) - uBackdropEl.x) / (uBackdropEl.y - uBackdropEl.x);
  float done = 0.0;
  if (v < 1.0) {
    vec2 uv = vec2(atan(d.z, d.x) / TAU + 0.5, max(v, 0.0));
    vec4 b0 = textureLod(tBack0, uv, 0.0);
    if (b0.a > 0.002) {
      vec4 b1 = textureLod(tBack1, uv, 0.0);
      vec4 b2 = textureLod(tBack2, uv, 0.0);
      float inv = 1.0 / b0.a;
      // how much of what is here is the bank of cloud, and how much the land behind it
      float bank = clamp(b2.b * inv, 0.0, 1.0);
      float w = inv / max(1.0 - bank, 1e-3);
      vec3 ambient = uSkyColor * 0.6 + dot(uSkyColor, vec3(0.38));
      vec3 inLight = b0.rgb * w;
      vec3 inShade = b1.rgb * w;
      vec3 land = mix(inShade * inShade * ambient, inLight * inLight * (uSunColor * 0.42 + uSkyColor * 0.35), clamp(b1.a * w, 0.0, 1.0));
      // (towards a low sun the far country warms, but it is not set alight)
      vec3 air = mix(uFogColor, uFogSunColor, pow(sd, 6.0) * 0.45);
      land = mix(land, air, 1.0 - pow(1.0 - clamp(b2.r * w, 0.0, 0.996), uFogDensity / 0.00015));
      land = mix(land, vec3(0.86, 0.92, 1.0) * (uSkyColor * 0.5 + uSunColor * 0.26), clamp(b2.g * w, 0.0, 1.0));
      vec3 cloud = mix(uBankShade, uBankLit, clamp(b2.a * inv / max(bank, 1e-3), 0.0, 1.0) * (0.2 + 0.8 * smoothstep(0.04, 0.4, uSunDir.y)));
      land = mix(land, mix(cloud, air, 0.18), bank);
      col = mix(col, land, b0.a);
      keepSharp *= 1.0 - b0.a;
      done = b0.a * (1.0 - bank);
    }
  }
  // (alpha marks what is painted already and wants no more of the brush: the far country)
  // (the stars are left out of the brush, or it would wipe them away)
  done = max(done, smoothstep(0.04, 0.25, keepSharp * (1.0 - c.a)) * 0.72);
  outC = vec4(col, 1.0 - 0.75 * done);
}
`;

/** @param options.cloudSize, options.cloudSteps, options.liveClouds see clouds.js; options.backdropWidth backdrop.js */
const colour = () => new THREE.Color();

/**
 * The sky's two pictures, the clouds and the far mountains, which need nothing from the land: make them first and
 * the graphics card can be painting them while the land is worked out. `light(hour)` paints the clouds for an hour.
 */
export function createSkyParts(renderer, { cloudSize = 1024, cloudSteps = 110, liveClouds = true, backdropWidth = 8192 } = {}) {
  const clouds = createClouds(renderer, HERO, { size: cloudSize, steps: cloudSteps, live: liveClouds });
  const afternoon = new THREE.Vector3();
  sunAt(16, afternoon);
  const backdrop = createBackdrop(renderer, HERO, [afternoon.x, afternoon.z], { width: backdropWidth, ground: backdropWidth > 4096 ? 4096 : 2048 });
  const sunDir = new THREE.Vector3();
  const c = { fog: colour(), lit: colour(), mid: colour(), shade: colour(), under: colour() };
  const parts = {
    clouds,
    backdrop,
    /** The hour the clouds were last painted whole for, so the same hour isn't painted twice. */
    drawn: Number.NaN,
    light(hour) {
      const k = blend(sunAt(hour, sunDir));
      clouds.setLight({ sunDir, lit: c.lit.setRGB(...k.cloudLit), mid: c.mid.setRGB(...k.cloudMid), shade: c.shade.setRGB(...k.cloudShade), under: c.under.setRGB(...k.cloudUnder), haze: c.fog.setRGB(...k.fog) });
      clouds.drawAll();
      parts.drawn = hour;
    },
  };
  return parts;
}

/** @param options.parts what createSkyParts made, if the sky's pictures were begun early */
export function createSky(renderer, field, { parts = null, ...options } = {}) {
  parts ??= createSkyParts(renderer, options);
  const { clouds, backdrop } = parts;
  const uniforms = {
    ...field.uniforms,
    uZenith: { value: new THREE.Color() },
    uMid: { value: new THREE.Color() },
    uHorizon: { value: new THREE.Color() },
    uGlow: { value: new THREE.Color() },
    tClouds: { value: clouds.texture },
    tBack0: { value: backdrop.textures[0] },
    tBack1: { value: backdrop.textures[1] },
    tBack2: { value: backdrop.textures[2] },
    uBackdropEl: { value: new THREE.Vector2(backdrop.el[0], backdrop.el[1]) },
    uBankLit: { value: new THREE.Color() },
    uBankShade: { value: new THREE.Color() },
    uCosmos: { value: 0.5 },
    uMoonDir: { value: new THREE.Vector3() },
    uGalaxy: { value: new THREE.Matrix3() },
  };
  {
    // the moon stands a little to the right of where the sun goes down, high and vast
    const [dx, dz] = HERO;
    const a = THREE.MathUtils.degToRad(-30);
    const el = THREE.MathUtils.degToRad(21);
    const hx = Math.cos(a) * dx + Math.sin(a) * dz;
    const hz = Math.cos(a) * dz - Math.sin(a) * dx;
    uniforms.uMoonDir.value.set(hx * Math.cos(el), Math.sin(el), hz * Math.cos(el)).normalize();
    // the galaxy's plane, tilted so its river arcs up from the mountains past the moon and over
    const m = new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(1.05, Math.atan2(dx, dz) + 0.9, 0.35, 'YXZ'));
    uniforms.uGalaxy.value.setFromMatrix4(m.invert());
  }
  const material = new THREE.ShaderMaterial({ glslVersion: THREE.GLSL3, vertexShader: vertex, fragmentShader: fragment, uniforms, side: THREE.BackSide, depthWrite: false, depthTest: true });
  const mesh = new THREE.Mesh(new THREE.IcosahedronGeometry(1, 4), material);
  mesh.frustumCulled = false;
  mesh.renderOrder = -10;

  const sunDir = new THREE.Vector3();
  const c = { sun: colour(), amb: colour(), bounce: colour(), fog: colour(), fogSun: colour(), lit: colour(), mid: colour(), shade: colour(), under: colour() };
  const sky = {
    mesh,
    uniforms,
    clouds,
    backdrop,
    hour: 15.5,
    exposure: 1,
    sunDir,
    elevation: 0,
    /**
     * hour: 12 to sunset. `soft` for a small step, as time passing makes: the clouds then take the new light a
     * strip at a time as they billow, and nothing is drawn again at once.
     */
    /** How much of the heavens shows; null follows the hour. */
    cosmos: null,
    setHour(hour, soft = false) {
      sky.hour = hour;
      uniforms.uCosmos.value = sky.cosmos ?? 0.38 + 0.62 * THREE.MathUtils.smoothstep(hour, 14, 20.2);
      const e = sunAt(hour, sunDir);
      sky.elevation = e;
      const k = blend(e);
      field.setLight({
        sunDir,
        sunColor: c.sun.setRGB(...k.sun),
        skyColor: c.amb.setRGB(...k.amb),
        bounceColor: c.bounce.setRGB(...k.bounce),
        fogColor: c.fog.setRGB(...k.fog),
        fogSunColor: c.fogSun.setRGB(...k.fogSun),
        fogDensity: k.haze,
        cloudShade: 0.15,
      });
      uniforms.uZenith.value.setRGB(...k.zenith);
      uniforms.uMid.value.setRGB(...k.mid);
      uniforms.uHorizon.value.setRGB(...k.horizon);
      uniforms.uGlow.value.setRGB(...k.glow);
      uniforms.uBankLit.value.setRGB(...k.cloudLit);
      uniforms.uBankShade.value.setRGB(...k.cloudMid.map((m, i) => m * 0.35 + k.cloudShade[i] * 0.65));
      clouds.setLight({ sunDir, lit: c.lit.setRGB(...k.cloudLit), mid: c.mid.setRGB(...k.cloudMid), shade: c.shade.setRGB(...k.cloudShade), under: c.under.setRGB(...k.cloudUnder), haze: c.fog });
      if (soft) parts.drawn = Number.NaN;
      else if (parts.drawn !== hour) {
        clouds.drawAll();
        parts.drawn = hour;
      }
      sky.exposure = k.exposure;
    },
    update(dt, camera) {
      mesh.position.copy(camera.position);
      mesh.scale.setScalar(camera.far * 0.5);
      clouds.update(dt);
    },
  };
  return sky;
}
