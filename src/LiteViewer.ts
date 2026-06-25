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
      const light = createHemisphericLight([0, 1, 0], 1);

      this.engine = engine;
      this.scene = scene;

      addToScene(scene, light);

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

      if (this.options.autoStart) {
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
      this.createCameraForScene(scene);

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

  async setEnvironment(source: string): Promise<void> {
    const scene = this.requireScene();

    try {
      const environmentUrl = resolveAssetUrl(source);
      await loadEnvironment(scene, environmentUrl, {
        brdfUrl: resolveSiblingUrl(environmentUrl, "environmentBRDFTexture.png"),
        skipGround: true,
      });
    } catch (error) {
      this.state = "error";
      this.options.onError?.(error);
      throw error;
    }
  }

  frameModel(): void {
    if (!this.scene || !this.loadedModel) return;

    this.createCameraForScene(this.scene);
  }

  start(): void {
    if (!this.engine || this.running || this.state === "disposed") return;

    void startEngine(this.engine);
    this.running = true;
  }

  stop(): void {
    if (!this.engine || !this.running) return;

    stopEngine(this.engine);
    this.running = false;
  }

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
    addToScene(scene, createHemisphericLight([0, 1, 0], 1));
    this.scene = scene;
    return scene;
  }

  private createCameraForScene(scene: SceneContext): void {
    this.detachCameraControl?.();
    const camera = createDefaultCamera(scene);
    camera.alpha += Math.PI;
    this.camera = camera;
    this.detachCameraControl = attachControl(camera, this.canvas, scene);
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

function resolveSiblingUrl(source: string, filename: string): string {
  const lastSlash = source.lastIndexOf("/");
  return lastSlash === -1 ? filename : `${source.slice(0, lastSlash + 1)}${filename}`;
}

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
