import { LiteViewer } from "./LiteViewer.js";
import type { LiteViewerDetails, LiteViewerOptions } from "./types.js";

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
