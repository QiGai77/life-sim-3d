import * as THREE from 'three';
import { GLTFLoader, type GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { HDRLoader } from 'three/examples/jsm/loaders/HDRLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';

/**
 * All binary assets are self-hosted under public/ (no CDN at runtime → works in mainland China).
 * Every load has a fallback, so the game still starts if one file fails.
 */
const BASE = import.meta.env.BASE_URL;

export interface TexSet {
  floorDiff: THREE.Texture;
  floorNor: THREE.Texture;
  floorRough: THREE.Texture;
  wallNor: THREE.Texture;
  rugNor: THREE.Texture;
  velvetNor: THREE.Texture;
  teddyNor: THREE.Texture;
  furDetail: THREE.Texture;
  woodGrain: THREE.Texture;
  oakNor: THREE.Texture;
  knitNor: THREE.Texture;
}

class AssetStore {
  tex = {} as TexSet;
  hdr: THREE.DataTexture | null = null;
  gltf: Record<string, GLTF | null> = {};
  progress = 0;

  async load(onProgress: (k: number) => void) {
    const tl = new THREE.TextureLoader();
    const files: [keyof TexSet, string, boolean][] = [
      ['floorDiff', 'tex/floor_diff.jpg', true],
      ['floorNor', 'tex/floor_nor.jpg', false],
      ['floorRough', 'tex/floor_rough.jpg', false],
      ['wallNor', 'tex/wall_nor.jpg', false],
      ['rugNor', 'tex/rug_nor.jpg', false],
      ['velvetNor', 'tex/velvet_nor.jpg', false],
      ['teddyNor', 'tex/teddy_nor.jpg', false],
      ['furDetail', 'tex/fur_detail.jpg', true],
      ['woodGrain', 'tex/wood_grain.jpg', true],
      ['oakNor', 'tex/oak_nor.jpg', false],
      ['knitNor', 'tex/knit_nor.jpg', false],
    ];
    const models = ['mom', 'dad', 'shiba'];
    const total = files.length + models.length + 1;
    let done = 0;
    const tick = () => {
      done++;
      this.progress = done / total;
      onProgress(this.progress);
    };
    const gl = new GLTFLoader();
    gl.setMeshoptDecoder(MeshoptDecoder);
    const jobs: Promise<unknown>[] = [];
    for (const [k, f, srgb] of files) {
      jobs.push(
        tl.loadAsync(BASE + f).then(
          (t) => {
            t.wrapS = t.wrapT = THREE.RepeatWrapping;
            t.anisotropy = 4;
            if (srgb) t.colorSpace = THREE.SRGBColorSpace;
            this.tex[k] = t;
            tick();
          },
          () => {
            const d = new THREE.DataTexture(new Uint8Array(k.endsWith('Nor') ? [128, 128, 255, 255] : [220, 220, 220, 255]), 1, 1);
            d.needsUpdate = true;
            this.tex[k] = d;
            tick();
          },
        ),
      );
    }
    for (const m of models) {
      jobs.push(
        gl.loadAsync(`${BASE}models/${m}.glb`).then(
          (g) => {
            this.gltf[m] = g;
            tick();
          },
          (e) => {
            console.warn('model failed', m, e);
            this.gltf[m] = null;
            tick();
          },
        ),
      );
    }
    jobs.push(
      new HDRLoader().loadAsync(BASE + 'env/lebombo_512.hdr').then(
        (t) => {
          t.mapping = THREE.EquirectangularReflectionMapping;
          this.hdr = t;
          tick();
        },
        () => tick(),
      ),
    );
    // the UI font (bundled subset) – make sure it is ready before canvases draw Chinese text
    const font = (document as any).fonts?.load?.('20px WenKai', '妈爸宝') ?? Promise.resolve();
    jobs.push(font.catch(() => {}));
    await Promise.all(jobs);
  }
}

export const assets = new AssetStore();
