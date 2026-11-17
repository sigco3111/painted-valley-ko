// The wanderer's katana, and its scabbard at his left hip. Drawn in the same flat paint and inked line as he is
// (wanderer.js): bright steel with a pale wavy line along its edge, a dark-wrapped hilt, a guard of old gold, and
// a scabbard of black lacquer that the cloak lies over.
//
// Its place is worked out in the world each frame from his body, not hung on a bone: sheathed, it rides at his left
// hip; drawn, its hilt is in his right hand and the blade points forward and low, a reverent guard. Between the
// two it slides out of the scabbard and swings round to his hand, catching the light as it goes.
import * as THREE from 'three';

const BLADE = 0.71; // metres from the guard to the tip
const HILT = 0.27;
const SORI = 0.02; // how far the blade curves back from straight
const GRIP = 0.075; // the right hand closes this far below the guard
const DRAW = 0.72; // seconds to draw
const SHEATHE = 0.85;

/** Where the blade's centre runs, s from 0 at the guard to 1 at the tip: it curves towards its back (-x). */
const bend = (s) => -SORI * s * s;

function bladeGeometry() {
  const N = 40;
  const pos = [];
  const uv = [];
  // a section is three points: the back of the blade on one face, the back on the other, the edge
  const section = (s) => {
    const tipStart = 0.9;
    const w = 0.031 - 0.007 * s;
    // the point: the edge sweeps up to meet the back
    const k = s < tipStart ? 1 : Math.cos(((s - tipStart) / (1 - tipStart)) * (Math.PI / 2));
    const width = w * Math.max(0.02, k);
    const t = 0.0038 * Math.max(0.15, k) * (1 - 0.3 * s);
    const y = s * BLADE;
    const cx = bend(s);
    const back = cx - 0.012 * (1 - 0.2 * s);
    const edge = back + width;
    return [
      [back, y, t, 0, s],
      [back, y, -t, 0, s],
      [edge, y, 0, 1, s],
    ];
  };
  const quad = (a, b, c, d) => {
    for (const v of [a, b, c, a, c, d]) {
      pos.push(v[0], v[1], v[2]);
      uv.push(v[3], v[4]);
    }
  };
  for (let i = 0; i < N; i++) {
    const a = section(i / N);
    const b = section((i + 1) / N);
    quad(a[0], b[0], b[2], a[2]);
    quad(a[2], b[2], b[1], a[1]);
    quad(a[1], b[1], b[0], a[0]);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.computeVertexNormals();
  return g;
}

/** The scabbard: a lacquered sleeve on the blade's own curve, a little larger than the blade. */
function sayaGeometry() {
  const N = 28;
  const R = 10;
  const pos = [];
  const index = [];
  const uv = [];
  for (let i = 0; i <= N; i++) {
    const s = i / N;
    const y = 0.004 + s * (BLADE + 0.025);
    const cx = bend(s) + 0.004;
    const w = 0.024 - 0.004 * s;
    const t = 0.012 - 0.002 * s;
    for (let j = 0; j < R; j++) {
      const a = (j / R) * Math.PI * 2;
      // the end is rounded shut
      const shut = s > 0.97 ? Math.sqrt(Math.max(0, 1 - ((s - 0.97) / 0.03) ** 2)) : 1;
      pos.push(cx + Math.cos(a) * w * shut, y, Math.sin(a) * t * shut);
      uv.push(j / R, s);
    }
  }
  for (let i = 0; i < N; i++) {
    for (let j = 0; j < R; j++) {
      const a = i * R + j;
      const b = i * R + ((j + 1) % R);
      index.push(a, a + R, b, b, a + R, b + R);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(index);
  g.computeVertexNormals();
  return g;
}

const ease = (t) => t * t * (3 - 2 * t);

/**
 * @param wanderer what createWanderer made: his bones, and the paint he is drawn in
 * @returns { group, update(dt), toggle(), drawn, busy }
 */
export function createKatana(wanderer, { onDraw = () => {}, onSheathe = () => {} } = {}) {
  const { paint, man, cloak } = wanderer;
  const B = man.bones;

  // the sword: everything in the frame of the guard, the blade up +y, its edge towards +x
  const sword = new THREE.Group();
  const steel = paint('BLADE', { blade: 1 });
  const blade = new THREE.Mesh(bladeGeometry(), steel);
  const tsuka = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.016, HILT, 10, 1), paint('TSUKA'));
  tsuka.scale.set(1.25, 1, 0.85);
  tsuka.position.set(0.002, -HILT / 2 - 0.006, 0);
  const tsuba = new THREE.Mesh(new THREE.CylinderGeometry(0.038, 0.038, 0.007, 16, 1), paint('TSUBA'));
  tsuba.scale.set(1, 1, 0.82);
  const pommel = new THREE.Mesh(new THREE.SphereGeometry(0.017, 10, 6), paint('TSUBA'));
  pommel.scale.set(1.2, 0.6, 0.9);
  pommel.position.set(0.002, -HILT - 0.006, 0);
  const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.017, 0.028, 8, 1), paint('TSUBA'));
  collar.scale.set(1.3, 1, 0.6);
  collar.position.set(-0.004, 0.017, 0);
  sword.add(blade, tsuka, tsuba, pommel, collar);
  for (const m of sword.children) m.frustumCulled = false;
  sword.matrixAutoUpdate = false;

  // the scabbard, with a band of gold at its mouth
  const saya = new THREE.Group();
  const sleeve = new THREE.Mesh(sayaGeometry(), paint('SAYA'));
  const mouth = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.026, 0.03, 12, 1), paint('TSUBA'));
  mouth.scale.set(1, 1, 0.5);
  mouth.position.set(0.004, 0.02, 0);
  saya.add(sleeve, mouth);
  for (const m of saya.children) m.frustumCulled = false;
  saya.matrixAutoUpdate = false;

  const group = new THREE.Group();
  group.add(sword, saya);

  // two points along the scabbard for the cloak to lie over
  const sayaTop = new THREE.Object3D();
  const sayaEnd = new THREE.Object3D();
  B.__sayaTop = sayaTop;
  B.__sayaEnd = sayaEnd;
  if (cloak) {
    cloak.sticks.push(['__sayaTop', '__sayaEnd', 0.035]);
    cloak.ends = new Float32Array(cloak.sticks.length * 6);
    cloak.endsBefore = new Float32Array(cloak.sticks.length * 6);
  }

  const F = new THREE.Vector3();
  const R = new THREE.Vector3();
  const UP = new THREE.Vector3(0, 1, 0);
  const v = new THREE.Vector3();
  const w = new THREE.Vector3();
  const basis = new THREE.Matrix4();
  /** A pose: where the guard is, and which way the blade and its edge point. */
  const pose = () => ({ at: new THREE.Vector3(), q: new THREE.Quaternion() });
  const sheathed = pose();
  const cleared = pose();
  const held = pose();
  const now = pose();
  const orient = (out, along, edge) => {
    along.normalize();
    edge.addScaledVector(along, -edge.dot(along)).normalize();
    const flat = new THREE.Vector3().crossVectors(edge, along);
    basis.makeBasis(edge, along, flat);
    out.setFromRotationMatrix(basis);
  };

  const state = {
    group,
    sword,
    saya,
    drawn: false,
    /** 0 sheathed to 1 in his hand */
    t: 0,
    busy: false,
    toggle() {
      if (state.busy) return false;
      state.drawn = !state.drawn;
      state.busy = true;
      (state.drawn ? onDraw : onSheathe)();
      return true;
    },
    /** Straight to drawn or sheathed, with no moving between. */
    set(drawn) {
      state.drawn = drawn;
      state.t = drawn ? 1 : 0;
      state.busy = false;
    },
    /** Before the animator: nothing. After it has posed him: call this to move the arm and set the sword. */
    update(dt, animator) {
      if (state.busy) {
        state.t += (state.drawn ? dt / DRAW : -dt / SHEATHE);
        if (state.t >= 1 || state.t <= 0) {
          state.t = Math.min(1, Math.max(0, state.t));
          state.busy = false;
        }
      }
      const t = state.t;
      const yaw = man.object.rotation.y;
      F.set(Math.sin(yaw), 0, Math.cos(yaw));
      R.set(-Math.cos(yaw), 0, Math.sin(yaw));

      // his right arm: across to the hilt as the sword comes out, then forward with it in his hand
      const reach = Math.sin(Math.min(1, t / 0.55) * Math.PI) * (state.busy ? 1 : 0);
      const hold = ease(Math.min(1, Math.max(0, (t - 0.35) / 0.65)));
      if (animator && (reach > 0.001 || hold > 0.001)) {
        animator.rotateWorld(B.upperarm_r, R, 0.14 * hold + 0.75 * reach);
        // (held out a little from his side, so the blade clears his leg)
        animator.rotateWorld(B.upperarm_r, F, -0.3 * hold);
        animator.rotateWorld(B.upperarm_r, UP, 0.55 * reach);
        animator.rotateWorld(B.lowerarm_r, R, 0.5 * hold + 0.9 * reach);
      }

      // sheathed: through his sash at the left hip, the hilt forward and up, edge up, the scabbard down behind
      B.pelvis.getWorldPosition(v);
      sheathed.at.copy(v).addScaledVector(R, -0.17).addScaledVector(F, 0.13).addScaledVector(UP, 0.03);
      orient(sheathed.q, w.copy(F).multiplyScalar(-0.86).addScaledVector(UP, -0.42).addScaledVector(R, -0.12), new THREE.Vector3(0, 1, 0));
      // the scabbard stays there always
      basis.compose(sheathed.at, sheathed.q, new THREE.Vector3(1, 1, 1));
      saya.matrix.copy(basis);
      saya.matrixWorldNeedsUpdate = true;
      const along = new THREE.Vector3(0, 1, 0).applyQuaternion(sheathed.q);
      sayaTop.position.copy(sheathed.at).addScaledVector(along, 0.18);
      sayaEnd.position.copy(sheathed.at).addScaledVector(along, BLADE);
      sayaTop.updateMatrixWorld();
      sayaEnd.updateMatrixWorld();

      // just out of the scabbard: the same line, a blade's length on
      cleared.q.copy(sheathed.q);
      cleared.at.copy(sheathed.at).addScaledVector(along, -BLADE - 0.02);

      // held: the hilt in his right hand, the blade forward and low, the edge down
      B.hand_r.getWorldPosition(v);
      B.lowerarm_r.getWorldPosition(w);
      const palm = v.clone().addScaledVector(w.sub(v).normalize(), -0.07);
      const point = new THREE.Vector3().copy(F).multiplyScalar(0.4).addScaledVector(UP, -0.5).addScaledVector(R, 0.75);
      orient(held.q, point, new THREE.Vector3(0, -1, 0).addScaledVector(R, 0.2));
      held.at.copy(palm).addScaledVector(point.normalize(), GRIP);

      if (t <= 0) {
        now.at.copy(sheathed.at);
        now.q.copy(sheathed.q);
      } else if (t < 0.4) {
        const k = ease(t / 0.4);
        now.at.lerpVectors(sheathed.at, cleared.at, k);
        now.q.copy(sheathed.q);
      } else {
        // round from the scabbard's mouth to his hand, high through the air
        const k = ease((t - 0.4) / 0.6);
        const mid = v.lerpVectors(cleared.at, held.at, 0.5).addScaledVector(UP, 0.25).addScaledVector(F, 0.15);
        const a = 1 - k;
        now.at.set(0, 0, 0).addScaledVector(cleared.at, a * a).addScaledVector(mid, 2 * a * k).addScaledVector(held.at, k * k);
        now.q.slerpQuaternions(cleared.q, held.q, k);
      }
      basis.compose(now.at, now.q, new THREE.Vector3(1, 1, 1));
      sword.matrix.copy(basis);
      sword.matrixWorldNeedsUpdate = true;
      // the light runs up the blade as it comes round
      steel.uniforms.uGleam.value = state.busy && t > 0.3 ? (state.drawn ? (t - 0.3) / 0.6 : 1.2 - (t - 0.3) / 0.7) * 1.3 - 0.1 : -1;
    },
  };
  return state;
}
