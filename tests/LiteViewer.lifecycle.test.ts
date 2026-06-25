import { beforeEach, describe, expect, it, vi } from "vitest";

const createEngine = vi.fn();
const createSceneContext = vi.fn();
const createDefaultCamera = vi.fn();
const attachControl = vi.fn();
const registerScene = vi.fn();
const loadGltf = vi.fn();
const addToScene = vi.fn();
const startEngine = vi.fn();
const stopEngine = vi.fn();
const disposeScene = vi.fn();
const disposeEngine = vi.fn();

vi.mock("@babylonjs/lite", () => ({
  addToScene,
  attachControl,
  createDefaultCamera,
  createEngine,
  createHemisphericLight: vi.fn(() => ({ lightType: "hemispheric" })),
  createSceneContext,
  disposeEngine,
  disposeScene,
  loadEnvironment: vi.fn(),
  loadGltf,
  registerScene,
  startEngine,
  stopEngine,
}));

describe("LiteViewer lifecycle", () => {
  beforeEach(() => {
    vi.resetModules();
    createEngine.mockReset();
    createSceneContext.mockReset();
    createDefaultCamera.mockReset();
    attachControl.mockReset();
    registerScene.mockReset();
    loadGltf.mockReset();
    addToScene.mockClear();
    startEngine.mockClear();
    stopEngine.mockClear();
    disposeScene.mockClear();
    disposeEngine.mockClear();

    createEngine.mockResolvedValue({ engine: true });
    createSceneContext.mockReturnValue({
      camera: null,
      lights: [],
      meshes: [],
    });
    createDefaultCamera.mockReturnValue({
      target: { x: 0, y: 0, z: 0 },
      radius: 5,
      fov: Math.PI / 4,
      alpha: 1,
      beta: 1,
    });
    attachControl.mockReturnValue(vi.fn());
    registerScene.mockResolvedValue(undefined);

    Object.defineProperty(navigator, "gpu", {
      configurable: true,
      value: {},
    });
  });

  it("viewer initializes", async () => {
    const { LiteViewer } = await import("../src/LiteViewer.js");
    const viewer = new LiteViewer(document.createElement("canvas"));

    const details = await viewer.initialize();

    expect(details.viewer).toBe(viewer);
    expect(createEngine).toHaveBeenCalledWith(details.canvas);
    expect(createDefaultCamera).toHaveBeenCalledOnce();
    expect(registerScene).toHaveBeenCalledOnce();
  });

  it("loadModel can be called", async () => {
    const model = {
      entities: [createMesh()],
    };
    loadGltf.mockResolvedValueOnce(model);
    const { LiteViewer } = await import("../src/LiteViewer.js");
    const viewer = new LiteViewer(document.createElement("canvas"));

    await viewer.initialize();
    await viewer.loadModel("/models/box.glb");

    expect(loadGltf).toHaveBeenCalledWith(
      expect.anything(),
      "http://localhost:3000/models/box.glb",
    );
    expect(addToScene).toHaveBeenCalledWith(expect.anything(), model);
    expect(disposeScene).toHaveBeenCalledOnce();
  });

  it("frameModel does nothing without a model", async () => {
    const { LiteViewer } = await import("../src/LiteViewer.js");
    const viewer = new LiteViewer(document.createElement("canvas"));

    await viewer.initialize();

    expect(() => viewer.frameModel()).not.toThrow();
  });

  it("dispose can be called twice safely", async () => {
    const { LiteViewer } = await import("../src/LiteViewer.js");
    const viewer = new LiteViewer(document.createElement("canvas"));

    await viewer.initialize();

    expect(() => {
      viewer.dispose();
      viewer.dispose();
    }).not.toThrow();
  });

  it("errors call onError", async () => {
    const error = new Error("load failed");
    const onError = vi.fn();
    loadGltf.mockRejectedValueOnce(error);
    const { LiteViewer } = await import("../src/LiteViewer.js");
    const viewer = new LiteViewer(document.createElement("canvas"), { onError });

    await viewer.initialize();
    await expect(viewer.loadModel("broken.glb")).rejects.toThrow("load failed");

    expect(onError).toHaveBeenCalledWith(error);
  });
});

function createMesh() {
  return {
    name: "mesh",
    visible: true,
    children: [],
    material: {},
    boundMin: [-1, -1, -1],
    boundMax: [1, 1, 1],
  };
}
