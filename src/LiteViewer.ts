import {
  addToScene,
  attachControl,
  createDefaultCamera,
  createEngine,
  createHemisphericLight,
  createSceneContext,
  disposeEngine,
  disposeScene,
  loadEnvironment,
  loadGltf,
  registerScene,
  startEngine,
  stopEngine,
  type ArcRotateCamera,
  type AssetContainer,
  type EngineContext,
  type SceneContext,
} from "@babylonjs/lite";
import { WEBGPU_REQUIRED_MESSAGE } from "./defaults.js";
import type {
  LiteViewerDetails,
  LiteViewerOptions,
  LiteViewerSource,
  ViewerState,
} from "./types.js";

/**
 * Minimal Babylon Lite model viewer for a single canvas.
 *
 * The viewer owns a WebGPU engine, an active scene, and an ArcRotate camera. It
 * loads one model scene at a time: loading a new model disposes the previous
 * scene before creating the next one. Loaded models are framed automatically.
 */
export class LiteViewer {
  private engine?: EngineContext;
  private scene?: SceneContext;
  private camera?: ArcRotateCamera;
  private loadedModel?: AssetContainer;
  private state: ViewerState = "idle";
  private running = false;
  private detachCameraControl?: () => void;
  private sceneRegistered = false;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly options: LiteViewerOptions = {},
  ) {}

  /**
   * Initializes the WebGPU engine, scene, light, and camera.
   *
   * If `options.source` is provided, the model is loaded before the promise
   * resolves. Rendering starts automatically unless `options.autoStart` is false.
   *
   * @returns Handles for the initialized viewer, canvas, engine, scene, and camera.
   * @throws If WebGPU is unavailable or Babylon Lite initialization fails.
   */
  async initialize(): Promise<LiteViewerDetails> {
    if (this.state === "disposed") {
      throw new Error("Cannot initialize a disposed LiteViewer.");
    }

    if (this.engine && this.scene && this.camera) {
      return this.createDetails();
    }

    this.state = "initializing";

    try {
      this.assertWebGPUSupported();

      const engine = await createEngine(this.canvas);
      const scene = createSceneContext(engine);

      this.engine = engine;
      this.scene = scene;

      this.addDefaultLight(scene);

      this.state = "ready";

      if (this.options.source) {
        await this.loadModel(this.options.source);
      }

      if (this.options.environment) {
        await this.setEnvironment(this.options.environment);
      }

      if (!this.camera) {
        this.createCameraForScene(this.requireScene());
      }
      this.options.onInitialized?.(this.createDetails());

      if (!this.sceneRegistered) {
        await registerScene(this.requireScene());
        this.sceneRegistered = true;
      }

      if (this.options.autoStart !== false) {
        this.start();
      }

      return this.createDetails();
    } catch (error) {
      this.state = "error";
      this.options.onError?.(error);
      this.dispose();
      throw error;
    }
  }

  /**
   * Loads a glTF/GLB model from a URL, `Blob`, or `ArrayBuffer`.
   *
   * When another model is already loaded, the current scene is disposed and a
   * fresh scene is created first. This keeps only one model active at a time.
   * The loaded model is framed automatically before `onLoaded` runs.
   *
   * @param source - Remote URL, application-hosted URL, uploaded file `Blob`, or model `ArrayBuffer`.
   */
  async loadModel(source: LiteViewerSource): Promise<void> {
    this.state = "loading";

    try {
      if (this.loadedModel || this.sceneRegistered) {
        this.disposeCurrentScene();
        this.createScene();
      }

      const scene = this.requireScene();

      const model = await loadModelSource(this.requireEngine(), source);
      addToScene(scene, model);

      this.loadedModel = model;
      this.frameModel();

      if (!this.sceneRegistered && this.engine) {
        await registerScene(scene);
        this.sceneRegistered = true;
      }

      this.state = "loaded";
      this.options.onLoaded?.(this.createDetails());
    } catch (error) {
      this.state = "error";
      this.options.onError?.(error);
      throw error;
    }
  }

  /**
   * Loads an environment texture into the active scene.
   *
   * The viewer uses a packaged BRDF LUT texture required by Babylon Lite's
   * environment loader.
   *
   * @param source - Environment texture URL.
   */
  async setEnvironment(source: string): Promise<void> {
    const scene = this.requireScene();

    try {
      const environmentUrl = resolveAssetUrl(source);
      const { DEFAULT_BRDF_LUT_URL } = await import("./brdfLut.js");
      await loadEnvironment(scene, environmentUrl, {
        brdfUrl: DEFAULT_BRDF_LUT_URL,
        skipSkybox: this.options.skipSkybox,
        skipGround: this.options.skipGround ?? true,
      });
    } catch (error) {
      this.state = "error";
      this.options.onError?.(error);
      throw error;
    }
  }

  /**
   * Starts the Babylon Lite render loop.
   *
   * This is called automatically by {@link initialize} unless `autoStart` is false.
   */
  start(): void {
    if (!this.engine || this.running || this.state === "disposed") return;

    void startEngine(this.engine);
    this.running = true;
  }

  /**
   * Stops the Babylon Lite render loop.
   */
  stop(): void {
    if (!this.engine || !this.running) return;

    stopEngine(this.engine);
    this.running = false;
  }

  /**
   * Stops rendering and disposes the active scene and engine.
   *
   * A disposed viewer cannot be initialized again.
   */
  dispose(): void {
    if (this.state === "disposed") return;

    this.stop();
    this.disposeCurrentScene();
    if (this.engine) {
      disposeEngine(this.engine);
    }

    this.detachCameraControl = undefined;
    this.sceneRegistered = false;
    this.camera = undefined;
    this.scene = undefined;
    this.engine = undefined;
    this.state = "disposed";
  }

  private assertWebGPUSupported(): void {
    const gpu = (globalThis.navigator as NavigatorWithGpu | undefined)?.gpu;
    if (!gpu) {
      throw new Error(WEBGPU_REQUIRED_MESSAGE);
    }
  }

  private createDetails(): LiteViewerDetails {
    if (!this.engine || !this.scene || !this.camera) {
      throw new Error("LiteViewer is not initialized.");
    }

    return {
      viewer: this,
      canvas: this.canvas,
      engine: this.engine,
      scene: this.scene,
      camera: this.camera,
    };
  }

  private requireEngine(): EngineContext {
    if (!this.engine) {
      throw new Error("LiteViewer must be initialized before loading models.");
    }

    return this.engine;
  }

  private requireScene(): SceneContext {
    if (!this.scene) {
      throw new Error("LiteViewer must be initialized before loading models.");
    }

    return this.scene;
  }

  private createScene(): SceneContext {
    const scene = createSceneContext(this.requireEngine());
    this.addDefaultLight(scene);
    this.scene = scene;
    return scene;
  }

  private addDefaultLight(scene: SceneContext): void {
    if (this.options.light === false) return;

    addToScene(scene, createHemisphericLight([0, 1, 0], 1));
  }

  private createCameraForScene(scene: SceneContext): void {
    this.detachCameraControl?.();
    const camera = createDefaultCamera(scene);
    camera.alpha += Math.PI;
    this.camera = camera;
    this.detachCameraControl = attachControl(camera, this.canvas, scene);
  }

  private frameModel(): void {
    if (!this.scene || !this.loadedModel) return;

    this.createCameraForScene(this.scene);
  }

  private disposeCurrentScene(): void {
    this.detachCameraControl?.();
    this.detachCameraControl = undefined;

    if (this.scene) {
      disposeScene(this.scene);
    }

    this.scene = undefined;
    this.camera = undefined;
    this.sceneRegistered = false;
    this.loadedModel = undefined;
  }
}

type NavigatorWithGpu = Navigator & {
  gpu?: unknown;
};

function resolveAssetUrl(source: string): string {
  if (typeof document === "undefined") {
    return source;
  }

  return new URL(source, document.baseURI).href;
}

function loadModelSource(
  engine: EngineContext,
  source: LiteViewerSource,
): Promise<AssetContainer> {
  if (typeof source === "string") {
    return loadGltf(engine, resolveAssetUrl(source));
  }

  return loadGltf(engine, source);
}
