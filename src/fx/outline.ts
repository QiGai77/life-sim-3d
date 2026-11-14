import * as THREE from 'three';
import { hullGeometry } from '../world/lowpoly';
import type { Interactable } from '../world/types';

/**
 * Soft white glow outline for the hovered interactable: an inflated back-face hull
 * in HDR white, which the bloom pass turns into a gentle halo.
 */
const hullMat = new THREE.ShaderMaterial({
  uniforms: { opacity: { value: 0.9 }, thickness: { value: 0.009 } },
  vertexShader: /* glsl */ `
    uniform float thickness;
    void main() {
      vec3 p = position + normal * thickness;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    uniform float opacity;
    void main() { gl_FragColor = vec4(vec3(1.9, 1.85, 1.75), opacity); }
  `,
  side: THREE.BackSide,
  transparent: true,
  depthWrite: false,
});

export class Outline {
  private cache = new Map<Interactable, THREE.Mesh[]>();
  private current: Interactable | null = null;
  private t = 0;

  private glow: THREE.MeshStandardMaterial[] = [];
  set(i: Interactable | null) {
    if (i === this.current) return;
    if (this.current) this.cache.get(this.current)?.forEach((m) => (m.visible = false));
    this.glow.forEach((m) => m.emissive.setRGB(0, 0, 0));
    this.glow = [];
    this.current = i;
    if (!i || i.kind === 'look') return;
    // skinned meshes (dog, parents) can't use a static hull → soft emissive pulse instead
    let skinned = false;
    i.obj.traverse((o) => {
      const m = o as THREE.SkinnedMesh;
      if (m.isSkinnedMesh) {
        skinned = true;
        const mat = m.material as THREE.MeshStandardMaterial;
        if (mat.emissive && !this.glow.includes(mat)) this.glow.push(mat);
      }
    });
    if (skinned) return;
    let hulls = this.cache.get(i);
    if (!hulls) {
      hulls = [];
      const meshes: THREE.Mesh[] = [];
      i.obj.traverse((o) => {
        const m = o as THREE.Mesh;
        if (m.isMesh && !m.userData.noOutline && !m.userData.isHull && !(m.material as THREE.Material & { emissive?: unknown }).hasOwnProperty('isPointsMaterial')) meshes.push(m);
      });
      for (const m of meshes) {
        const h = new THREE.Mesh(hullGeometry(m.geometry), hullMat);
        h.userData.isHull = true;
        h.raycast = () => {};
        h.renderOrder = 2;
        m.add(h);
        hulls.push(h);
      }
      this.cache.set(i, hulls);
    }
    hulls.forEach((h) => (h.visible = true));
  }

  update(dt: number) {
    this.t += dt;
    hullMat.uniforms.opacity.value = 0.6 + Math.sin(this.t * 4) * 0.25;
    const k = 0.1 + Math.sin(this.t * 4) * 0.06;
    this.glow.forEach((m) => m.emissive.setRGB(k, k * 0.9, k * 0.75));
  }
}
