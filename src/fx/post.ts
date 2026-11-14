import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { GTAOPass } from 'three/examples/jsm/postprocessing/GTAOPass.js';

/**
 * v3 realistic optical camera pass:
 *  - subtle natural edge softness (deepens when sleepy)
 *  - natural warm sunlight balance + subtle film grain (no heavy purple cartoon vignette)
 *  - cream fade for cutscenes
 */
const BabyVisionShader = {
  uniforms: {
    tDiffuse: { value: null as THREE.Texture | null },
    resolution: { value: new THREE.Vector2(1, 1) },
    blur: { value: 1.35 },
    vignette: { value: 0.36 },
    sleepy: { value: 0.0 },
    fade: { value: 0.0 },
    fadeColor: { value: new THREE.Color('#f7efe4') },
    warm: { value: 0.06 },
    time: { value: 0.0 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform vec2 resolution;
    uniform float blur, vignette, sleepy, fade, warm, time;
    uniform vec3 fadeColor;
    varying vec2 vUv;
    float hash12(vec2 p) {
      vec3 p3 = fract(vec3(p.xyx) * 0.1031);
      p3 += dot(p3, p3.yzx + 33.33);
      return fract((p3.x + p3.y) * p3.z);
    }
    void main() {
      vec2 uv = vUv;
      float aspect = resolution.x / resolution.y;
      vec2 c = (uv - 0.5) * vec2(aspect, 1.0);
      float d = length(c) / (0.5 * sqrt(aspect * aspect + 1.0));
      vec3 col = texture2D(tDiffuse, uv).rgb;
      float r = smoothstep(0.45, 1.0, d) * (blur + sleepy * 5.2);
      if (r > 0.3) {
        vec3 acc = col; float w = 1.0;
        for (int i = 0; i < 8; i++) {
          float fi = float(i);
          float a = fi * 2.39996;
          float rr = r * sqrt((fi + 0.5) / 8.0);
          vec2 o = vec2(cos(a), sin(a)) * rr / resolution;
          acc += texture2D(tDiffuse, uv + o).rgb; w += 1.0;
        }
        col = acc / w;
      }
      // natural warm filmic balance + subtle micro-contrast
      col = mix(col, col * vec3(1.03, 1.005, 0.965), warm);
      col = mix(col, smoothstep(0.0, 1.0, col), 0.08);
      // natural optical lens vignette
      float v = smoothstep(1.12 - sleepy * 0.25, 0.38 - sleepy * 0.2, d);
      col *= mix(vec3(1.0 - vignette), vec3(1.0), v);
      // subtle organic camera sensor grain
      float grain = (hash12(gl_FragCoord.xy + fract(time) * 100.0) - 0.5) * 0.016;
      col += grain;
      col = mix(col, fadeColor, fade);
      gl_FragColor = vec4(col, 1.0);
    }
  `,
};

export class Post {
  composer: EffectComposer;
  bloom: UnrealBloomPass;
  vision: ShaderPass;
  ao: GTAOPass | null = null;

  constructor(private renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.Camera, mobile: boolean) {
    const size = renderer.getDrawingBufferSize(new THREE.Vector2());
    const rt = new THREE.WebGLRenderTarget(size.x, size.y, { type: THREE.HalfFloatType, samples: mobile ? 2 : 4 });
    this.composer = new EffectComposer(renderer, rt);
    this.composer.addPass(new RenderPass(scene, camera));
    if (!mobile && !/noao/.test(location.search)) {
      const ao = new GTAOPass(scene, camera, size.x, size.y);
      ao.output = GTAOPass.OUTPUT.Default;
      ao.blendIntensity = 0.58;
      ao.updateGtaoMaterial({ radius: 0.28, distanceExponent: 1.5, thickness: 0.85, scale: 1.0, samples: 14 });
      ao.updatePdMaterial({ lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 6, rings: 2, samples: 8 });
      this.ao = ao;
      this.composer.addPass(ao);
    }
    const div = mobile ? 3 : 2;
    // higher threshold so only sunlit windows, lamps & TV glow softly
    this.bloom = new UnrealBloomPass(new THREE.Vector2(size.x / div, size.y / div), 0.24, 0.45, 0.92);
    this.composer.addPass(this.bloom);
    this.vision = new ShaderPass(BabyVisionShader);
    this.composer.addPass(this.vision);
    this.composer.addPass(new OutputPass());
  }

  setSize(w: number, h: number, pr: number) {
    this.composer.setPixelRatio(pr);
    this.composer.setSize(w, h);
    this.ao?.setSize(w * pr, h * pr);
    this.vision.uniforms.resolution.value.set(w * pr, h * pr);
  }

  render() {
    this.composer.render();
  }
}
