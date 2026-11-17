// The valley's sound. The katana's draw and sheathe, the wind and the held chord under the title are made here,
// from noise and tones; everything else is recordings. Footsteps are five recordings by Kenney (CC0), which are
// in this repo. The five ambiences (grass in the wind, leaves, a summer evening, water at a bank, crickets) are cut
// from the Sonniss GDC bundles, which may be used in a game but not passed on as files: they are in the released
// demo and not in this repo. MISSING_ASSETS.md says which recordings they are and how to put them back.
//
// The build writes ./audio/manifest.json listing the recordings that are there, so nothing is asked for that isn't.
// Sound starts on the first click, as browsers ask; everything is fetched and decoded before that, so the click
// itself costs nothing.

const LOOPS = ['grass', 'leaves', 'summer', 'lake', 'crickets'];

export function createSounds(base = './audio/') {
  let ctx = null;
  let master = null;
  const steps = [];
  const buffers = {};
  const loops = {};
  let begun = false;
  let lastStep = -1;
  let noise = null;
  let wind = null;
  let choir = null;
  /** A second of white noise, made once, for the wind and the blade. */
  const noiseBuffer = () => {
    if (noise) return noise;
    noise = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const d = noise.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return noise;
  };
  const env = (gain, at, peak, attack, decay) => {
    gain.gain.setValueAtTime(0.0001, at);
    gain.gain.exponentialRampToValueAtTime(peak, at + attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + attack + decay);
  };
  const ready = () => ctx && ctx.state === 'running';

  return {
    /** Fetches and decodes the recordings. Call while loading; resolves whether or not there is any sound to have. */
    async load() {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return;
      let names;
      try {
        const res = await fetch(`${base}manifest.json`);
        if (!res.ok) return;
        names = await res.json();
      } catch {
        return;
      }
      try {
        ctx = new Ctx();
        master = ctx.createGain();
        master.gain.value = 0.8;
        master.connect(ctx.destination);
        await Promise.all(
          names.map(async (name) => {
            try {
              const buffer = await ctx.decodeAudioData(await (await fetch(`${base}${name}.ogg`)).arrayBuffer());
              if (name.startsWith('footstep')) steps.push(buffer);
              else buffers[name] = buffer;
            } catch {
              // a missing recording is just a missing sound
            }
          }),
        );
      } catch {
        ctx = null;
      }
    },
    /** Call from a click. */
    start() {
      if (!ctx) return;
      if (ctx.state === 'suspended') ctx.resume();
      if (begun) return;
      begun = true;
      // the wind in the grass, as filtered noise, for when its recording isn't here
      {
        const source = ctx.createBufferSource();
        source.buffer = noiseBuffer();
        source.loop = true;
        const band = ctx.createBiquadFilter();
        band.type = 'bandpass';
        band.frequency.value = 520;
        band.Q.value = 0.6;
        const gain = ctx.createGain();
        gain.gain.value = 0;
        source.connect(band).connect(gain).connect(master);
        source.start();
        wind = { gain, band };
      }
      // a chord held low under everything, like voices far off: louder under the title
      {
        const gain = ctx.createGain();
        gain.gain.value = 0;
        const low = ctx.createBiquadFilter();
        low.type = 'lowpass';
        low.frequency.value = 1400;
        low.connect(gain).connect(master);
        // D, A, D, F#, A: open, and a little bright
        for (const [f, v] of [[73.42, 0.3], [110, 0.22], [146.83, 0.18], [185, 0.1], [220, 0.12], [293.66, 0.06]]) {
          for (const detune of [-6, 6]) {
            const o = ctx.createOscillator();
            o.type = 'triangle';
            o.frequency.value = f;
            o.detune.value = detune;
            const g = ctx.createGain();
            g.gain.value = v * 0.5;
            // each voice breathes on its own
            const lfo = ctx.createOscillator();
            lfo.frequency.value = 0.07 + Math.random() * 0.1;
            const depth = ctx.createGain();
            depth.gain.value = v * 0.35;
            lfo.connect(depth).connect(g.gain);
            o.connect(g).connect(low);
            o.start();
            lfo.start();
          }
        }
        choir = gain;
      }
      for (const name of LOOPS) {
        if (!buffers[name]) continue;
        const source = ctx.createBufferSource();
        source.buffer = buffers[name];
        source.loop = true;
        const gain = ctx.createGain();
        gain.gain.value = 0;
        source.connect(gain).connect(master);
        // (not all from their first second, or every visit begins the same)
        source.start(0, Math.random() * source.buffer.duration);
        loops[name] = gain;
      }
    },
    /** One footfall, 0 to 1 loud. Never the same recording twice running. */
    step(volume) {
      if (!ctx || ctx.state !== 'running' || !steps.length) return;
      let pick = Math.floor(Math.random() * steps.length);
      if (pick === lastStep) pick = (pick + 1) % steps.length;
      lastStep = pick;
      const source = ctx.createBufferSource();
      source.buffer = steps[pick];
      source.playbackRate.value = 0.92 + Math.random() * 0.16;
      const gain = ctx.createGain();
      gain.gain.value = volume;
      const pan = ctx.createStereoPanner();
      pan.pan.value = (Math.random() - 0.5) * 0.3;
      source.connect(gain).connect(pan).connect(master);
      source.start();
    },
    /** The blade leaving its scabbard: a scrape rising into a ring of steel. */
    draw() {
      if (!ready()) return;
      const t = ctx.currentTime;
      const scrape = ctx.createBufferSource();
      scrape.buffer = noiseBuffer();
      const hp = ctx.createBiquadFilter();
      hp.type = 'bandpass';
      hp.Q.value = 3;
      hp.frequency.setValueAtTime(2200, t);
      hp.frequency.exponentialRampToValueAtTime(7400, t + 0.32);
      const sg = ctx.createGain();
      env(sg, t, 0.32, 0.05, 0.34);
      scrape.connect(hp).connect(sg).connect(master);
      scrape.start(t, Math.random());
      scrape.stop(t + 0.5);
      // the ring: a few high partials, not in tune with each other, as metal rings
      for (const [f, v, d] of [[3150, 0.07, 1.9], [4710, 0.05, 1.5], [6980, 0.03, 1.1], [9420, 0.015, 0.8]]) {
        const o = ctx.createOscillator();
        o.frequency.value = f;
        const g = ctx.createGain();
        env(g, t + 0.26, v, 0.01, d);
        const pan = ctx.createStereoPanner();
        pan.pan.value = 0.15;
        o.connect(g).connect(pan).connect(master);
        o.start(t + 0.25);
        o.stop(t + 0.3 + d);
      }
    },
    /** The blade going home: a short slide and the knock of the guard against the mouth of the scabbard. */
    sheathe(late = 0.32) {
      if (!ready()) return;
      const t = ctx.currentTime;
      const slide = ctx.createBufferSource();
      slide.buffer = noiseBuffer();
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.Q.value = 2;
      bp.frequency.setValueAtTime(6000, t);
      bp.frequency.exponentialRampToValueAtTime(2400, t + late);
      const sg = ctx.createGain();
      env(sg, t, 0.18, 0.04, late);
      slide.connect(bp).connect(sg).connect(master);
      slide.start(t, Math.random());
      slide.stop(t + late + 0.1);
      const knock = ctx.createBufferSource();
      knock.buffer = noiseBuffer();
      const lp = ctx.createBiquadFilter();
      lp.type = 'bandpass';
      lp.frequency.value = 1300;
      lp.Q.value = 5;
      const kg = ctx.createGain();
      env(kg, t + late, 0.9, 0.003, 0.09);
      knock.connect(lp).connect(kg).connect(master);
      knock.start(t + late, Math.random());
      knock.stop(t + late + 0.2);
    },
    /**
     * @param here.wind m/s; here.gust 0 to 1, the gust passing now; here.tree 0 to 1, how far under a tree you
     *   are; here.tarn 0 to 1, how near the water; here.dusk 0 to 1
     */
    update(dt, here) {
      if (!begun) return;
      const ease = Math.min(1, dt * 1.6);
      const to = (name, value) => {
        if (loops[name]) loops[name].gain.value += (value - loops[name].gain.value) * ease;
      };
      if (wind && !buffers.grass) {
        wind.gain.gain.value += ((0.02 + here.wind * 0.012) * (0.4 + 0.6 * here.gust) - wind.gain.gain.value) * ease;
        wind.band.frequency.value = 380 + 420 * here.gust;
      }
      if (choir) choir.gain.value += ((here.title ? 0.22 : 0.05) - choir.gain.value) * Math.min(1, dt * 0.6);
      to('grass', (0.1 + Math.min(0.5, here.wind * 0.055)) * (0.55 + 0.45 * here.gust));
      to('leaves', here.tree * (0.3 + 0.5 * here.gust));
      to('summer', 0.55 * (1 - 0.5 * here.dusk));
      to('lake', here.tarn * 0.5);
      to('crickets', here.dusk * 0.3);
    },
  };
}
