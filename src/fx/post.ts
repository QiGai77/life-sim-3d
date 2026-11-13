import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';

/**
 * "Baby vision": soft radial edge-blur (cheap fake depth-of-field), warm grade,
 * vignette that deepens when sleepy, and a cream fade for cutscenes.
 */
const BabyVisionShader = {
  uniforms: {
    tDiffuse: { value: null as THREE.Texture | null },
    resolution: { value: new THREE.Vector2(1, 1) },
    blur: { value: 5.0 },
    vignette: { value: 0.62 },
    sleepy: { value: 0.0 },
    fade: { value: 0.0 },
    fadeColor: { value: new THREE.Color('#fff4e6') },
    warm: { value: 0.1 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform vec2 resolution;
    uniform float blur, vignette, sleepy, fade, warm;
    uniform vec3 fadeColor;
    varying vec2 vUv;
    void main() {
      vec2 uv = vUv;
      float aspect = resolution.x / resolution.y;
      vec2 c = (uv - 0.5) * vec2(aspect, 1.0);
      float d = length(c) / (0.5 * sqrt(aspect * aspect + 1.0)); // 0 centre .. 1 corner
      vec3 col = texture2D(tDiffuse, uv).rgb;
      float r = smoothstep(0.32, 1.0, d) * (blur + sleepy * 6.0);
      if (r > 0.3) {
        vec3 acc = col; float w = 1.0;
        for (int i = 0; i < 10; i++) {
          float fi = float(i);
          float a = fi * 2.39996;
          float rr = r * sqrt((fi + 0.5) / 10.0);
          vec2 o = vec2(cos(a), sin(a)) * rr / resolution;
          acc += texture2D(tDiffuse, uv + o).rgb; w += 1.0;
        }
        col = acc / w;
      }
      // warm, slightly lifted pastel grade
      col = mix(col, col * vec3(1.06, 1.0, 0.92), warm);
      col = mix(col, vec3(dot(col, vec3(0.299, 0.587, 0.114))), -0.06);
      // vignette (rounded, slightly purple like a lens)
      float v = smoothstep(1.05 - sleepy * 0.25, 0.42 - sleepy * 0.2, d);
      col *= mix(vec3(1.0 - vignette, 1.0 - vignette * 1.05, 1.0 - vignette * 0.9), vec3(1.0), v);
      col = mix(col, fadeColor, fade);
      gl_FragColor = vec4(col, 1.0);
    }
  `,
};

export class Post {
  composer: EffectComposer;
  bloom: UnrealBloomPass;
  vision: ShaderPass;

  constructor(private renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.Camera, mobile: boolean) {
    const size = renderer.getDrawingBufferSize(new THREE.Vector2());
    const rt = new THREE.WebGLRenderTarget(size.x, size.y, { type: THREE.HalfFloatType, samples: mobile ? 2 : 4 });
    this.composer = new EffectComposer(renderer, rt);
    this.composer.addPass(new RenderPass(scene, camera));
    const div = mobile ? 3 : 2;
    this.bloom = new UnrealBloomPass(new THREE.Vector2(size.x / div, size.y / div), 0.5, 0.55, 0.82);
    this.composer.addPass(this.bloom);
    this.vision = new ShaderPass(BabyVisionShader);
    this.composer.addPass(this.vision);
    this.composer.addPass(new OutputPass());
  }

  setSize(w: number, h: number, pr: number) {
    this.composer.setPixelRatio(pr);
    this.composer.setSize(w, h);
    this.vision.uniforms.resolution.value.set(w * pr, h * pr);
  }

  render() {
    this.composer.render();
  }
}
