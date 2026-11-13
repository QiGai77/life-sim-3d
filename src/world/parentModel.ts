import * as THREE from 'three';
import { Builder, C, Mat } from './lowpoly';
import { parentFace } from './textures';

export interface ParentRig {
  root: THREE.Group;
  body: THREE.Group;
  head: THREE.Group;
  legL: THREE.Group;
  legR: THREE.Group;
  armL: THREE.Group;
  armR: THREE.Group;
  faceMat: THREE.MeshBasicMaterial;
  faceOpen: THREE.Texture;
  faceBlink: THREE.Texture;
}

const ico = (r: number, d = 1) => new THREE.IcosahedronGeometry(r, d);
const cyl = (a: number, b: number, h: number, s = 7) => new THREE.CylinderGeometry(a, b, h, s);
const cap = (r: number, l: number, s = 6) => new THREE.CapsuleGeometry(r, l, 2, s);

/** Simple stylised low-poly mum (blue sweater, brown bob, friendly painted face). Faces +z. */
export function buildParent(): ParentRig {
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);

  // legs
  const mkLeg = (s: number) => {
    const g = new THREE.Group();
    g.position.set(s * 0.09, 0.86, 0);
    const b = new Builder();
    b.add(cap(0.075, 0.62), C.pants, { pos: [0, -0.4, 0], jitter: 0.005 });
    b.add(ico(0.075, 1), '#f3eee6', { pos: [0, -0.82, 0.05], scale: [1, 0.55, 1.6] });
    g.add(b.mesh());
    body.add(g);
    return g;
  };
  const legL = mkLeg(1), legR = mkLeg(-1);

  // torso
  const tb = new Builder();
  tb.add(cyl(0.165, 0.2, 0.6, 8), C.sweater, { pos: [0, 1.13, 0], jitter: 0.008 });
  tb.add(ico(0.19, 1), C.sweater, { pos: [0, 1.38, 0], scale: [1.18, 0.55, 0.85], jitter: 0.006 });
  tb.add(cyl(0.2, 0.18, 0.12, 8), '#6f87c2', { pos: [0, 0.85, 0] });
  tb.add(cyl(0.05, 0.055, 0.1, 6), C.skin, { pos: [0, 1.48, 0] });
  body.add(tb.mesh());

  const mkArm = (s: number) => {
    const g = new THREE.Group();
    g.position.set(s * 0.22, 1.39, 0);
    const b = new Builder();
    b.add(cap(0.058, 0.44), C.sweater, { pos: [0, -0.26, 0], jitter: 0.005 });
    b.add(ico(0.06, 1), C.skin, { pos: [0, -0.56, 0.01], scale: [0.85, 1.1, 0.7] });
    g.add(b.mesh());
    g.rotation.z = s * 0.08;
    body.add(g);
    return g;
  };
  const armL = mkArm(1), armR = mkArm(-1);

  // head
  const head = new THREE.Group();
  head.position.set(0, 1.62, 0);
  const hb = new Builder();
  hb.add(ico(0.125, 1), C.skin, { scale: [0.92, 1.06, 0.95], jitter: 0.004 });
  hb.add(ico(0.016, 0), C.skinShade, { pos: [0, -0.03, 0.118], scale: [1, 0.8, 0.8] }); // nose
  for (const s of [-1, 1]) hb.add(ico(0.025, 0), C.skin, { pos: [s * 0.115, 0, 0] });
  // bob haircut
  hb.add(ico(0.142, 1), C.hair, { pos: [0, 0.045, -0.02], scale: [1.0, 0.9, 1.0], jitter: 0.008 });
  hb.add(ico(0.12, 1), C.hair, { pos: [0, -0.04, -0.06], scale: [1.18, 0.95, 0.85], jitter: 0.008, seed: 2 });
  for (const s of [-1, 1]) hb.add(ico(0.075, 1), C.hair, { pos: [s * 0.11, -0.06, 0.0], scale: [0.55, 1.3, 0.9], jitter: 0.006, seed: 3 });
  // fringe
  hb.add(ico(0.1, 1), C.hair, { pos: [0.03, 0.115, 0.05], scale: [1.1, 0.4, 0.65], rot: [0.35, 0, -0.25], jitter: 0.006, seed: 4 });
  const hm = hb.mesh();
  head.add(hm);

  const faceOpen = parentFace(false), faceBlink = parentFace(true);
  const faceMat = new THREE.MeshBasicMaterial({ map: faceOpen, transparent: true, depthWrite: false });
  const face = new THREE.Mesh(
    new THREE.SphereGeometry(0.1215, 12, 8, Math.PI / 2 - 0.72, 1.44, Math.PI / 2 - 0.62, 1.2),
    faceMat,
  );
  face.scale.set(0.92, 1.06, 0.95);
  face.position.z = 0.003;
  face.rotation.x = 0.16; // sit the features a little lower on the face
  head.add(face);
  body.add(head);

  root.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) {
      o.castShadow = true;
      (o as THREE.Mesh).receiveShadow = true;
    }
  });
  face.castShadow = false;
  void Mat;
  return { root, body, head, legL, legR, armL, armR, faceMat, faceOpen, faceBlink };
}
