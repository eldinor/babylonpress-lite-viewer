import { LiteViewer } from "./LiteViewer.js";
import type { LiteViewerDetails, LiteViewerOptions } from "./types.js";

/**
 * Creates and initializes a {@link LiteViewer} for an existing canvas element.
 *
 * This is the simplest entry point for applications that want a ready-to-use
 * viewer in one call. The returned details object includes the viewer instance
 * and the underlying Babylon Lite engine, scene, and camera.
 *
 * @param canvas - Canvas element where the viewer should render.
 * @param options - Optional startup settings, including an initial model source.
 * @returns Initialized viewer details.
 *
 * @example
 * ```ts
 * const details = await createLiteViewerForCanvas(canvas, {
 *   source: "https://playground.babylonjs.com/scenes/BoomBox.glb",
 * });
 * ```
 */
export async function createLiteViewerForCanvas(
  canvas: HTMLCanvasElement,
  options?: LiteViewerOptions,
): Promise<LiteViewerDetails> {
  if (!(canvas instanceof HTMLCanvasElement)) {
    throw new Error("createLiteViewerForCanvas requires an HTMLCanvasElement.");
  }

  const viewer = new LiteViewer(canvas, options);
  return viewer.initialize();
}
