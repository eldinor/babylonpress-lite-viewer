# Minimal Babylon Lite Viewer Plan

## Purpose

Create a minimal, reliable Babylon Lite-based model viewer.

The viewer must be small, framework-independent, and centered around a single public Stage 1 API:

```ts
createLiteViewerForCanvas(canvas, options)
```

The first stage must be fully implemented, tested, and demonstrated before any wrapper layer is added.

This viewer is **not** an Inspector and must never grow into an Inspector.

---

## Core Decisions

### We do not need Inspector

The Lite Viewer is only for loading and viewing a model.

Out of scope permanently:

- Inspector
- Scene tree
- Material editor
- Property panels
- Gizmos
- Debug UI
- Node graph
- Animation editor
- Runtime scene editing tools

### Stage 1 does not use custom HTML elements

Stage 1 must use only:

```html
<canvas id="viewer"></canvas>
```

No custom element:

```html
<litools-lite-viewer></litools-lite-viewer>
```

No extended HTML elements.

No Shadow DOM.

No Lit.

No Preact.

No React.

The first implementation must be pure TypeScript and canvas-based.

### Wrapper layers are optional later

Later wrappers may be implemented as separate packages:

```txt
@litools/babylon-lite-viewer
  core canvas API

@litools/babylon-lite-viewer-preact
  optional Preact wrapper

@litools/babylon-lite-viewer-element
  optional custom element wrapper
```

The core viewer must not depend on any wrapper.

Dependency direction must always be:

```txt
Preact wrapper       → core viewer
Custom element       → core viewer
Application code     → core viewer
```

Never:

```txt
core viewer → Preact
core viewer → custom element
core viewer → Lit
```

---

# Stage 1 — Core Canvas Viewer

## Stage 1 Goal

Implement, test, and demonstrate:

```ts
createLiteViewerForCanvas(canvas, options)
```

This is the required first milestone.

Stage 1 is complete only when:

1. the core function works,
2. model loading works,
3. camera controls work,
4. fit-to-view works,
5. errors are handled,
6. disposal works,
7. tests exist,
8. a separate demo page exists.

---

## Stage 1 Public API

### Main Function

```ts
export async function createLiteViewerForCanvas(
  canvas: HTMLCanvasElement,
  options?: LiteViewerOptions
): Promise<LiteViewerDetails>;
```

### Options

```ts
export type LiteViewerOptions = {
  source?: string;
  environment?: string;

  autoStart?: boolean;

  camera?: {
    autoFrame?: boolean;
    padding?: number;
    minRadius?: number;
    maxRadius?: number;
  };

  onInitialized?: (details: LiteViewerDetails) => void;
  onLoaded?: (details: LiteViewerDetails) => void;
  onError?: (error: unknown) => void;
};
```

### Returned Details

```ts
export type LiteViewerDetails = {
  viewer: LiteViewer;
  canvas: HTMLCanvasElement;
  engine: unknown;
  scene: unknown;
  camera: unknown;
};
```

Use proper Babylon Lite types when available. Use `unknown` only as a temporary placeholder if the Lite types are not stable or not easily exported.

---

## Core Class

```ts
export class LiteViewer {
  constructor(canvas: HTMLCanvasElement, options?: LiteViewerOptions);

  initialize(): Promise<LiteViewerDetails>;

  loadModel(source: string): Promise<void>;

  setEnvironment(source: string): Promise<void>;

  frameModel(): void;

  start(): void;

  stop(): void;

  dispose(): void;
}
```

---

## Required File Structure

```txt
src/
  createLiteViewerForCanvas.ts
  LiteViewer.ts
  types.ts
  defaults.ts
  index.ts

  camera/
    fitArcRotateCameraToBounds.ts

  bounds/
    Bounds3.ts
    computeBoundsFromLoadedModel.ts

examples/
  basic-canvas/
    index.html
    main.ts
    style.css

tests/
  fitArcRotateCameraToBounds.test.ts
  LiteViewer.lifecycle.test.ts
```

---

## Basic Usage

```html
<canvas id="viewer"></canvas>
```

```ts
import { createLiteViewerForCanvas } from "@litools/babylon-lite-viewer";

const canvas = document.querySelector("#viewer") as HTMLCanvasElement;

const details = await createLiteViewerForCanvas(canvas, {
  source: "/models/model.glb",
  autoStart: true,
  camera: {
    autoFrame: true,
    padding: 1.25,
  },
});
```

---

# Stage 1 Implementation Requirements

## 1. Validate Canvas

The function must fail clearly if no valid canvas is provided.

```ts
if (!(canvas instanceof HTMLCanvasElement)) {
  throw new Error("createLiteViewerForCanvas requires an HTMLCanvasElement.");
}
```

---

## 2. Validate WebGPU Support

Babylon Lite is WebGPU-oriented. The viewer must show a clear error if WebGPU is unavailable.

Expected behavior:

- throw a readable error,
- call `onError` if provided,
- do not leave partial state behind.

Example message:

```txt
This viewer requires WebGPU. Please use a browser with WebGPU support.
```

---

## 3. Create Engine and Scene

Use the current Babylon Lite API style:

```ts
const engine = await createEngine(canvas);
const scene = createSceneContext(engine);
```

The exact imports must be verified against the current Babylon Lite package before implementation.

---

## 4. Create Camera

Use an ArcRotate-style camera or Babylon Lite default camera if that is the correct current API.

The viewer must provide orbit controls suitable for model viewing.

Expected flow:

```ts
const camera = createDefaultCamera(scene);
// or createArcRotateCamera(...)

attachControl(camera, canvas, scene);
```

The implementation must not assume full Babylon.js camera helpers exist in Babylon Lite.

Do not use:

- `FramingBehavior`
- `camera.useFramingBehavior`
- `camera.zoomOn`
- full Babylon.js Inspector camera helpers

---

## 5. Add Basic Light

Stage 1 must add simple default lighting so a model is visible.

Example:

```ts
createHemisphericLight(...)
```

or the closest Babylon Lite equivalent.

Keep lighting minimal.

Do not add complex studio lighting in Stage 1.

---

## 6. Load Model

Implement:

```ts
viewer.loadModel(source)
```

Requirements:

- support `.glb` / `.gltf`,
- remove or replace previously loaded model if `loadModel()` is called again,
- preserve camera settings except when `frameModel()` is explicitly called,
- call `onLoaded` after successful load,
- call `onError` and reject on failure.

Expected internal flow:

```ts
const model = await loadGltf(engine, source);
addToScene(scene, model);
this.loadedModel = model;
this.loadedModelBounds = computeBoundsFromLoadedModel(model);

if (this.options.camera?.autoFrame !== false) {
  this.frameModel();
}
```

Exact function names must be checked against the current Babylon Lite API.

---

# Fit-to-View / Auto-Framing Rules

## Important Decision

Babylon Lite does not appear to expose full Babylon.js-style camera framing helpers such as:

- `FramingBehavior`
- `camera.useFramingBehavior`
- `camera.zoomOn`

Therefore the viewer must implement its own small fit-to-view helper.

This helper must be conservative.

---

## Fit-to-View Must Only Change

```txt
camera.target
camera.radius
```

That is all.

---

## Fit-to-View Must Not Change

```txt
camera.fov
camera.minZ
camera.maxZ
camera.alpha
camera.beta
camera.projection
canvas.width
canvas.height
model.position
model.rotation
model.scale
```

These values are considered stable viewer or model settings.

Fit-to-view is allowed to read camera FOV for distance calculation, but it must never assign to `camera.fov`.

Near and far clipping must remain static. Do not modify `camera.minZ` or `camera.maxZ`.

---

## Fit-to-View Concept

The 2D map version:

```ts
function fitView(view: View, engine: EngineContext, b: Bounds): void {
  const w = engine.canvas.width || 1;
  const h = engine.canvas.height || 1;
  const mapW = b.maxX - b.minX + TILE_W;
  const mapH = b.maxY - b.minY + TILE_H;

  view.zoom = Math.min(
    MAX_ZOOM,
    Math.max(MIN_ZOOM, Math.min(w / mapW, h / mapH) * 0.95)
  );

  const cx = (b.minX + b.maxX) / 2;
  const cy = (b.minY + b.maxY) / 2;

  view.x = cx - w / 2 / view.zoom;
  view.y = cy - h / 2 / view.zoom;
}
```

The 3D model equivalent:

```txt
canvas size
→ loaded model bounds
→ model center
→ model bounding radius
→ read current camera FOV
→ calculate required ArcRotate radius
→ set camera.target
→ set camera.radius
```

---

## Bounds Type

```ts
export type Bounds3 = {
  minX: number;
  minY: number;
  minZ: number;
  maxX: number;
  maxY: number;
  maxZ: number;
};
```

---

## Camera-Like Type

```ts
export type ArcRotateCameraLike = {
  target: { x: number; y: number; z: number };
  radius: number;
  fov?: number;
};
```

---

## Fit Helper

```ts
export type FitToViewOptions = {
  padding?: number;
  minRadius?: number;
  maxRadius?: number;
};

export function fitArcRotateCameraToBounds(
  camera: ArcRotateCameraLike,
  canvas: HTMLCanvasElement,
  bounds: Bounds3,
  options: FitToViewOptions = {}
): void {
  const w = canvas.width || canvas.clientWidth || 1;
  const h = canvas.height || canvas.clientHeight || 1;

  const padding = options.padding ?? 1.25;
  const minRadius = options.minRadius ?? 0.01;
  const maxRadius = options.maxRadius ?? Number.POSITIVE_INFINITY;

  const sizeX = bounds.maxX - bounds.minX;
  const sizeY = bounds.maxY - bounds.minY;
  const sizeZ = bounds.maxZ - bounds.minZ;

  const center = {
    x: (bounds.minX + bounds.maxX) / 2,
    y: (bounds.minY + bounds.maxY) / 2,
    z: (bounds.minZ + bounds.maxZ) / 2,
  };

  const boundingRadius =
    Math.sqrt(sizeX * sizeX + sizeY * sizeY + sizeZ * sizeZ) / 2;

  const aspect = w / h;

  // Read only. Never assign to camera.fov.
  const verticalFov = camera.fov ?? Math.PI / 4;

  const horizontalFov =
    2 * Math.atan(Math.tan(verticalFov / 2) * aspect);

  const distanceVertical =
    boundingRadius / Math.sin(verticalFov / 2);

  const distanceHorizontal =
    boundingRadius / Math.sin(horizontalFov / 2);

  const requiredRadius =
    Math.max(distanceVertical, distanceHorizontal) * padding;

  camera.target = center;
  camera.radius = clamp(requiredRadius, minRadius, maxRadius);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
```

---

## Model Bounds Helper

Implement:

```ts
export function computeBoundsFromLoadedModel(model: unknown): Bounds3;
```

The implementation must inspect the actual Babylon Lite loaded model structure.

Requirements:

- include all visible renderable meshes/primitives in the loaded model,
- ignore non-renderable metadata objects,
- handle nested nodes if the loaded glTF structure is hierarchical,
- return bounds in world/model space suitable for camera targeting,
- fail clearly if no renderable bounds can be found.

If Babylon Lite exposes mesh bounding info, use it.

If not, compute bounds from positions/geometry data as needed.

Do not move, scale, or normalize the model to compute bounds.

---

## `frameModel()` Method

```ts
frameModel(): void {
  if (!this.loadedModelBounds) return;

  fitArcRotateCameraToBounds(
    this.camera,
    this.canvas,
    this.loadedModelBounds,
    {
      padding: this.options.camera?.padding,
      minRadius: this.options.camera?.minRadius,
      maxRadius: this.options.camera?.maxRadius,
    }
  );
}
```

`frameModel()` must not do anything if no model is loaded.

It must not reload the model.

It must not reset alpha/beta.

It must not change FOV or near/far clipping.

---

# Stage 1 State Management

The viewer should internally track:

```ts
type ViewerState =
  | "idle"
  | "initializing"
  | "ready"
  | "loading"
  | "loaded"
  | "error"
  | "disposed";
```

State is internal in Stage 1.

Do not build a UI state system yet.

---

# Stage 1 Error Handling

All async operations must be wrapped safely.

Errors must:

- reject the original Promise,
- call `onError` if provided,
- put the viewer into `"error"` state,
- not leave duplicate models or duplicate render loops.

---

# Stage 1 Disposal

`dispose()` must:

- stop the render loop if running,
- detach camera controls if the API supports it,
- dispose/remove loaded model resources if the API supports it,
- dispose engine/scene resources if the API supports it,
- clear references,
- set state to `"disposed"`.

Calling `dispose()` more than once must be safe.

---

# Stage 1 Tests

## Unit Tests

Required tests for `fitArcRotateCameraToBounds`:

1. centers camera target on bounds center,
2. changes radius,
3. respects `minRadius`,
4. respects `maxRadius`,
5. does not change `fov`,
6. does not change `minZ`,
7. does not change `maxZ`,
8. does not change `alpha`,
9. does not change `beta`.

Use a plain camera-like object in tests.

Example:

```ts
const camera = {
  target: { x: 0, y: 0, z: 0 },
  radius: 1,
  fov: Math.PI / 4,
  minZ: 0.1,
  maxZ: 1000,
  alpha: 1,
  beta: 1,
};
```

After fitting, assert:

```ts
expect(camera.fov).toBe(Math.PI / 4);
expect(camera.minZ).toBe(0.1);
expect(camera.maxZ).toBe(1000);
expect(camera.alpha).toBe(1);
expect(camera.beta).toBe(1);
```

## Lifecycle Tests

Test:

1. viewer initializes,
2. `loadModel()` can be called,
3. `frameModel()` does nothing without a model,
4. `dispose()` can be called twice safely,
5. errors call `onError`.

Mock Babylon Lite where necessary.

Do not require real WebGPU in unit tests.

---

# Stage 1 Demo Page

Create a separate demo page:

```txt
examples/basic-canvas/
```

The page must demonstrate the Stage 1 API only.

It must not use Preact, React, Lit, or custom elements.

## Demo Requirements

The demo page must include:

- a full-page canvas,
- a model URL passed into `createLiteViewerForCanvas`,
- loading indicator using normal DOM,
- error display using normal DOM,
- a “Frame model” button that calls `viewer.frameModel()`,
- a “Load another model” button or select if practical,
- basic CSS.

Example UI:

```html
<div class="app">
  <canvas id="viewer"></canvas>

  <div id="loading">Loading…</div>
  <div id="error"></div>

  <div class="toolbar">
    <button id="frame">Frame model</button>
  </div>
</div>
```

Example initialization:

```ts
const canvas = document.querySelector("#viewer") as HTMLCanvasElement;
const loading = document.querySelector("#loading") as HTMLElement;
const error = document.querySelector("#error") as HTMLElement;

const details = await createLiteViewerForCanvas(canvas, {
  source: "/models/model.glb",
  autoStart: true,
  camera: {
    autoFrame: true,
    padding: 1.25,
  },
  onInitialized: () => {
    loading.textContent = "Initializing…";
  },
  onLoaded: () => {
    loading.hidden = true;
  },
  onError: (err) => {
    loading.hidden = true;
    error.textContent = String(err);
  },
});

document.querySelector("#frame")?.addEventListener("click", () => {
  details.viewer.frameModel();
});
```

---

# Stage 1 Completion Checklist

Stage 1 is done only when all are true:

```txt
[ ] createLiteViewerForCanvas implemented
[ ] LiteViewer class implemented
[ ] TypeScript types exported
[ ] basic model loading works
[ ] default camera works
[ ] camera controls work
[ ] default light works
[ ] fit-to-view implemented without changing FOV/minZ/maxZ/alpha/beta
[ ] frameModel() method works
[ ] loadModel() can replace the current model
[ ] error handling implemented
[ ] dispose() implemented and safe
[ ] unit tests implemented
[ ] lifecycle tests implemented or mocked
[ ] examples/basic-canvas demo page created
[ ] package builds successfully
```

---

# Stage 2 — Optional Custom HTML Element Wrapper

Stage 2 is not part of the first implementation.

It may be implemented later only after Stage 1 is complete and stable.

Stage 2 must not change the core viewer architecture.

---

## Stage 2 Goal

Create an optional custom element wrapper around the Stage 1 core viewer.

The custom element must be a thin wrapper.

It must not own rendering logic.

It must not duplicate the core viewer.

It must not replace `createLiteViewerForCanvas`.

---

## Stage 2 Package

Recommended package:

```txt
@litools/babylon-lite-viewer-element
```

It depends on:

```txt
@litools/babylon-lite-viewer
```

The core package must not depend on the element package.

---

## Custom Element Name

Use a Litools-prefixed custom element name.

Recommended:

```html
<litools-lite-viewer></litools-lite-viewer>
```

Alternative:

```html
<litools-babylon-lite-viewer></litools-babylon-lite-viewer>
```

Do not use:

```html
<babylon-lite-viewer></babylon-lite-viewer>
```

Reason: avoid confusion with official Babylon packages.

Custom element names must contain a hyphen.

---

## Stage 2 Usage

```html
<litools-lite-viewer
  source="/models/model.glb"
  environment="/env/studio.env"
  auto-frame>
</litools-lite-viewer>
```

JavaScript access:

```ts
const element = document.querySelector("litools-lite-viewer");

element.addEventListener("viewer-ready", (event) => {
  console.log(event.detail.viewer);
});

element.source = "/models/another.glb";
```

---

## Stage 2 Public API

### Attributes

```txt
source
environment
auto-start
auto-frame
```

### Properties

```ts
source?: string;
environment?: string;
autoStart: boolean;
autoFrame: boolean;
viewer?: LiteViewer;
viewerDetails?: LiteViewerDetails;
```

### Events

```txt
viewer-ready
viewer-loaded
viewer-error
viewer-disposed
```

Events should use `CustomEvent`.

They should be:

```ts
{
  bubbles: true,
  composed: true
}
```

---

## Stage 2 Element Responsibilities

The element should:

1. create its own internal canvas,
2. read attributes,
3. map attributes to `LiteViewerOptions`,
4. call `createLiteViewerForCanvas`,
5. expose `viewer` / `viewerDetails`,
6. call `viewer.loadModel()` when `source` changes,
7. call `viewer.setEnvironment()` when `environment` changes,
8. call `viewer.dispose()` in `disconnectedCallback`,
9. dispatch clear lifecycle events.

The element must not:

- implement model loading itself,
- implement camera fitting itself,
- implement rendering logic itself,
- use Inspector concepts,
- mutate FOV/minZ/maxZ during auto-frame,
- require Preact or React.

---

## Stage 2 Native HTMLElement First

Start with native `HTMLElement`.

Do not use Lit unless the wrapper becomes much more complex.

Native element is enough for:

- one canvas,
- attributes,
- lifecycle callbacks,
- events,
- simple default style.

Use Lit only later if adding:

- complex loading UI,
- toolbar,
- slots,
- themes,
- many reactive properties.

---

## Stage 2 Implementation Sketch

```ts
import {
  createLiteViewerForCanvas,
  type LiteViewer,
  type LiteViewerDetails,
} from "@litools/babylon-lite-viewer";

export class LitoolsLiteViewerElement extends HTMLElement {
  static observedAttributes = [
    "source",
    "environment",
    "auto-start",
    "auto-frame",
  ];

  private canvas?: HTMLCanvasElement;
  private _viewer?: LiteViewer;
  private _viewerDetails?: LiteViewerDetails;
  private initialized = false;

  get viewer() {
    return this._viewer;
  }

  get viewerDetails() {
    return this._viewerDetails;
  }

  get source() {
    return this.getAttribute("source") ?? undefined;
  }

  set source(value: string | undefined) {
    if (value == null) {
      this.removeAttribute("source");
    } else {
      this.setAttribute("source", value);
    }
  }

  get environment() {
    return this.getAttribute("environment") ?? undefined;
  }

  set environment(value: string | undefined) {
    if (value == null) {
      this.removeAttribute("environment");
    } else {
      this.setAttribute("environment", value);
    }
  }

  get autoStart() {
    return this.hasAttribute("auto-start");
  }

  set autoStart(value: boolean) {
    this.toggleAttribute("auto-start", value);
  }

  get autoFrame() {
    return this.hasAttribute("auto-frame");
  }

  set autoFrame(value: boolean) {
    this.toggleAttribute("auto-frame", value);
  }

  connectedCallback() {
    if (this.initialized) return;

    this.initialized = true;

    const shadow = this.attachShadow({ mode: "open" });

    const style = document.createElement("style");
    style.textContent = `
      :host {
        display: block;
        width: 100%;
        height: 100%;
      }

      canvas {
        display: block;
        width: 100%;
        height: 100%;
      }
    `;

    this.canvas = document.createElement("canvas");

    shadow.append(style, this.canvas);

    void this.initializeViewer();
  }

  disconnectedCallback() {
    this._viewer?.dispose();
    this._viewer = undefined;
    this._viewerDetails = undefined;
    this.initialized = false;

    this.dispatchEvent(
      new CustomEvent("viewer-disposed", {
        bubbles: true,
        composed: true,
      })
    );
  }

  async attributeChangedCallback(
    name: string,
    oldValue: string | null,
    newValue: string | null
  ) {
    if (oldValue === newValue) return;
    if (!this._viewer) return;

    try {
      if (name === "source" && newValue) {
        await this._viewer.loadModel(newValue);
        this.dispatchEvent(
          new CustomEvent("viewer-loaded", {
            detail: this._viewerDetails,
            bubbles: true,
            composed: true,
          })
        );
      }

      if (name === "environment" && newValue) {
        await this._viewer.setEnvironment(newValue);
      }
    } catch (error) {
      this.dispatchViewerError(error);
    }
  }

  private async initializeViewer() {
    if (!this.canvas) return;

    try {
      const details = await createLiteViewerForCanvas(this.canvas, {
        source: this.source,
        environment: this.environment,
        autoStart: this.autoStart,
        camera: {
          autoFrame: this.autoFrame,
        },
        onLoaded: () => {
          this.dispatchEvent(
            new CustomEvent("viewer-loaded", {
              detail: this._viewerDetails,
              bubbles: true,
              composed: true,
            })
          );
        },
        onError: (error) => {
          this.dispatchViewerError(error);
        },
      });

      this._viewer = details.viewer;
      this._viewerDetails = details;

      this.dispatchEvent(
        new CustomEvent("viewer-ready", {
          detail: details,
          bubbles: true,
          composed: true,
        })
      );
    } catch (error) {
      this.dispatchViewerError(error);
    }
  }

  private dispatchViewerError(error: unknown) {
    this.dispatchEvent(
      new CustomEvent("viewer-error", {
        detail: { error },
        bubbles: true,
        composed: true,
      })
    );
  }
}
```

---

## Stage 2 Registration

```ts
export function defineLitoolsLiteViewerElement() {
  if (!customElements.get("litools-lite-viewer")) {
    customElements.define("litools-lite-viewer", LitoolsLiteViewerElement);
  }
}
```

Usage:

```ts
import { defineLitoolsLiteViewerElement } from "@litools/babylon-lite-viewer-element";

defineLitoolsLiteViewerElement();
```

---

## Stage 2 Tests

Required tests:

1. defines custom element once,
2. creates internal canvas,
3. passes `source` to core viewer,
4. calls `loadModel()` when `source` attribute changes,
5. calls `setEnvironment()` when `environment` changes,
6. dispatches `viewer-ready`,
7. dispatches `viewer-loaded`,
8. dispatches `viewer-error`,
9. disposes viewer when disconnected.

Mock the core viewer.

Do not require real WebGPU in Stage 2 tests.

---

## Stage 2 Demo Page

Create:

```txt
examples/basic-element/
```

Demo:

```html
<litools-lite-viewer
  id="viewer"
  source="/models/model.glb"
  auto-frame>
</litools-lite-viewer>

<script type="module">
  import { defineLitoolsLiteViewerElement } from "@litools/babylon-lite-viewer-element";

  defineLitoolsLiteViewerElement();

  const viewer = document.querySelector("#viewer");

  viewer.addEventListener("viewer-ready", (event) => {
    console.log("ready", event.detail.viewer);
  });

  viewer.addEventListener("viewer-error", (event) => {
    console.error(event.detail.error);
  });
</script>
```

---

# Future Optional Stage — Preact Wrapper

This is not Stage 1 and not Stage 2.

It can be implemented later as:

```txt
@litools/babylon-lite-viewer-preact
```

Exports:

```ts
LiteViewerCanvas
```

The Preact wrapper should:

- render a normal `<canvas>`,
- use `useRef` for the canvas,
- create the viewer once on mount,
- call `viewer.loadModel()` when `source` changes,
- call `viewer.setEnvironment()` when `environment` changes,
- dispose viewer on unmount.

It must not use custom elements internally.

---

# Final Architecture

```txt
Stage 1:
  @litools/babylon-lite-viewer
    createLiteViewerForCanvas
    LiteViewer
    frameModel
    fitArcRotateCameraToBounds
    basic-canvas demo

Stage 2 later:
  @litools/babylon-lite-viewer-element
    <litools-lite-viewer>
    wraps Stage 1 only

Optional later:
  @litools/babylon-lite-viewer-preact
    <LiteViewerCanvas>
    wraps Stage 1 only
```

The core stays clean.

The core stays canvas-based.

The core never becomes an Inspector.
