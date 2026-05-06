/**
 * Scene3D — three.js scaffolding shared by all 3D sketches.
 *
 * Owns: a `THREE.Scene`, both a perspective and an orthographic camera, a
 * renderer (injectable for tests / WebGPU), a default lighting rig, the
 * resize handler, and a render loop that prefers *render-on-dirty* so idle
 * GPU usage stays near zero. Continuous rendering can be turned on for the
 * frames where it actually matters (e.g. while OrbitControls damping is
 * active or an animation is running).
 *
 * `OrbitControls` and the WebGLRenderer default factory live alongside this
 * module so importing `Scene3D` doesn't drag GL code into test bundles.
 */

import * as THREE from 'three';

export interface RendererLike {
  readonly domElement: HTMLElement;
  setSize(width: number, height: number, updateStyle?: boolean): void;
  setPixelRatio(value: number): void;
  render(scene: THREE.Scene, camera: THREE.Camera): void;
  dispose(): void;
}

export type RendererFactory = () => RendererLike;

export interface SceneOptions {
  readonly host: HTMLElement;
  readonly cameraType?: CameraType;
  readonly fov?: number;
  readonly near?: number;
  readonly far?: number;
  readonly orthoZoom?: number;
  readonly clearColor?: THREE.ColorRepresentation;
  readonly devicePixelRatio?: number;
  readonly rendererFactory?: RendererFactory;
  readonly raf?: (cb: FrameRequestCallback) => number;
  readonly cancelRaf?: (id: number) => void;
}

export type CameraType = 'perspective' | 'orthographic';

const DEFAULTS = {
  fov: 60,
  near: 0.1,
  far: 1000,
  orthoZoom: 2,
  clearColor: 0x0b0b0d,
};

export class Scene3D {
  readonly scene: THREE.Scene;
  readonly perspectiveCamera: THREE.PerspectiveCamera;
  readonly orthographicCamera: THREE.OrthographicCamera;
  readonly renderer: RendererLike;

  private readonly host: HTMLElement;
  private readonly raf: (cb: FrameRequestCallback) => number;
  private readonly cancelRaf: (id: number) => void;
  private readonly orthoZoom: number;
  private currentCamera: THREE.PerspectiveCamera | THREE.OrthographicCamera;
  private rafId: number | null = null;
  private continuous = false;
  private disposed = false;
  private size: { width: number; height: number; dpr: number };

  constructor(options: SceneOptions) {
    this.host = options.host;
    this.raf =
      options.raf ?? ((cb) => globalThis.requestAnimationFrame(cb));
    this.cancelRaf =
      options.cancelRaf ?? ((id) => globalThis.cancelAnimationFrame(id));
    this.orthoZoom = options.orthoZoom ?? DEFAULTS.orthoZoom;

    const factory = options.rendererFactory ?? defaultRendererFactory;
    this.renderer = factory();
    this.host.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(
      options.clearColor ?? DEFAULTS.clearColor,
    );
    this.attachDefaultLights();

    const width = this.host.clientWidth || 1;
    const height = this.host.clientHeight || 1;
    const dpr =
      options.devicePixelRatio ??
      (globalThis as { devicePixelRatio?: number }).devicePixelRatio ??
      1;
    this.size = { width, height, dpr };

    this.perspectiveCamera = new THREE.PerspectiveCamera(
      options.fov ?? DEFAULTS.fov,
      width / height,
      options.near ?? DEFAULTS.near,
      options.far ?? DEFAULTS.far,
    );
    this.perspectiveCamera.position.set(0, 0, 5);

    this.orthographicCamera = new THREE.OrthographicCamera(
      -1,
      1,
      1,
      -1,
      options.near ?? DEFAULTS.near,
      options.far ?? DEFAULTS.far,
    );
    this.orthographicCamera.position.set(0, 0, 5);

    this.applyOrthoFrustum();
    this.currentCamera =
      (options.cameraType ?? 'perspective') === 'orthographic'
        ? this.orthographicCamera
        : this.perspectiveCamera;

    this.renderer.setPixelRatio(dpr);
    this.renderer.setSize(width, height, true);
  }

  setCamera(type: CameraType): void {
    this.currentCamera =
      type === 'orthographic'
        ? this.orthographicCamera
        : this.perspectiveCamera;
    this.invalidate();
  }

  resize(width?: number, height?: number, devicePixelRatio?: number): void {
    if (this.disposed) return;
    const w = width ?? this.host.clientWidth ?? this.size.width;
    const h = height ?? this.host.clientHeight ?? this.size.height;
    const dpr =
      devicePixelRatio ??
      (globalThis as { devicePixelRatio?: number }).devicePixelRatio ??
      this.size.dpr;
    this.size = { width: w, height: h, dpr };
    this.perspectiveCamera.aspect = w / Math.max(1, h);
    this.perspectiveCamera.updateProjectionMatrix();
    this.applyOrthoFrustum();
    this.renderer.setPixelRatio(dpr);
    this.renderer.setSize(w, h, true);
    this.invalidate();
  }

  invalidate(): void {
    if (this.disposed || this.rafId !== null) return;
    this.rafId = this.raf(this.tick);
  }

  setContinuousRendering(enabled: boolean): void {
    if (this.disposed) return;
    this.continuous = enabled;
    if (enabled) this.invalidate();
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    if (this.rafId !== null) {
      this.cancelRaf(this.rafId);
      this.rafId = null;
    }
    this.renderer.dispose();
    if (this.renderer.domElement.parentNode === this.host) {
      this.host.removeChild(this.renderer.domElement);
    }
  }

  private tick = (_timestamp: number): void => {
    this.rafId = null;
    if (this.disposed) return;
    this.renderer.render(this.scene, this.currentCamera);
    if (this.continuous && !this.disposed) {
      this.rafId = this.raf(this.tick);
    }
  };

  private attachDefaultLights(): void {
    const ambient = new THREE.AmbientLight(0xffffff, 0.4);
    const key = new THREE.DirectionalLight(0xffffff, 1.0);
    key.position.set(5, 10, 7);
    this.scene.add(ambient);
    this.scene.add(key);
  }

  private applyOrthoFrustum(): void {
    const aspect = this.size.width / Math.max(1, this.size.height);
    const v = this.orthoZoom;
    const h = v * aspect;
    this.orthographicCamera.left = -h;
    this.orthographicCamera.right = h;
    this.orthographicCamera.top = v;
    this.orthographicCamera.bottom = -v;
    this.orthographicCamera.updateProjectionMatrix();
  }
}

const defaultRendererFactory: RendererFactory = () => {
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  return renderer;
};
