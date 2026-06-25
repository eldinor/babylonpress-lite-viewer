import type {
  ArcRotateCamera,
  EngineContext,
  SceneContext,
} from "@babylonjs/lite";
import type { LiteViewer } from "./LiteViewer.js";

export type LiteViewerSource = string | Blob | ArrayBuffer;

export type LiteViewerOptions = {
  source?: LiteViewerSource;
  environment?: string;
  autoStart?: boolean;
  onInitialized?: (details: LiteViewerDetails) => void;
  onLoaded?: (details: LiteViewerDetails) => void;
  onError?: (error: unknown) => void;
};

export type LiteViewerDetails = {
  viewer: LiteViewer;
  canvas: HTMLCanvasElement;
  engine: EngineContext;
  scene: SceneContext;
  camera: ArcRotateCamera;
};

export type ViewerState =
  | "idle"
  | "initializing"
  | "ready"
  | "loading"
  | "loaded"
  | "error"
  | "disposed";
