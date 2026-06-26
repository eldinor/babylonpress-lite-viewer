import { mkdirSync, mkdtempSync, readdirSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import { spawnSync } from "node:child_process";

const root = realpathSync(new URL("..", import.meta.url));
const workspace = mkdtempSync(join(tmpdir(), "babylonpress-lite-viewer-package-"));
const npmCacheDir = join(workspace, ".npm-cache");
const packDir = join(workspace, "pack");

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: root,
    encoding: "utf8",
    env: {
      ...process.env,
      npm_config_cache: npmCacheDir,
    },
    shell: process.platform === "win32",
    stdio: "pipe",
    ...options,
  });

  if (result.status !== 0) {
    const renderedCommand = [command, ...args].join(" ");
    throw new Error(
      [
        `Command failed: ${renderedCommand}`,
        result.stdout.trim(),
        result.stderr.trim(),
      ]
        .filter(Boolean)
        .join("\n\n"),
    );
  }

  return result.stdout.trim();
}

try {
  mkdirSync(packDir);
  run("npm", ["pack", "--pack-destination", packDir]);

  const tarballName = readdirSync(packDir).find((name) => name.endsWith(".tgz"));

  if (!tarballName) {
    throw new Error("npm pack did not produce a .tgz package.");
  }

  const tarballPath = join(packDir, tarballName);

  writeFileSync(
    join(workspace, "package.json"),
    JSON.stringify({ private: true, type: "module" }, null, 2),
  );
  run("npm", ["install", "--no-audit", "--no-fund", tarballPath], {
    cwd: workspace,
  });

  writeFileSync(
    join(workspace, "index.html"),
    [
      '<!doctype html>',
      '<html lang="en">',
      "  <head>",
      '    <meta charset="UTF-8" />',
      "    <title>Package Consumption Smoke Test</title>",
      "  </head>",
      "  <body>",
      '    <canvas id="viewer"></canvas>',
      '    <script type="module" src="/src/main.js"></script>',
      "  </body>",
      "</html>",
      "",
    ].join("\n"),
  );

  mkdirSync(join(workspace, "src"));
  writeFileSync(
    join(workspace, "src", "main.js"),
    [
      'import { createLiteViewerForCanvas, DEFAULT_CLEAR_COLOR, LiteViewer } from "@litools/babylonpress-lite-viewer";',
      "",
      'if (typeof createLiteViewerForCanvas !== "function") throw new Error("createLiteViewerForCanvas export missing");',
      'if (typeof LiteViewer !== "function") throw new Error("LiteViewer export missing");',
      'if (!DEFAULT_CLEAR_COLOR || typeof DEFAULT_CLEAR_COLOR.r !== "number") throw new Error("DEFAULT_CLEAR_COLOR export missing");',
      "",
      "window.babylonPressLiteViewerSmoke = {",
      "  createLiteViewerForCanvas,",
      "  DEFAULT_CLEAR_COLOR,",
      "  LiteViewer,",
      "};",
      "",
    ].join("\n"),
  );

  const viteBin = join(root, "node_modules", "vite", "bin", "vite.js");
  run(process.execPath, [viteBin, "build", "--outDir", "dist"], {
    cwd: workspace,
    shell: false,
  });

  console.log("Package consumption smoke test passed.");
  console.log(`Packed and consumed ${basename(tarballPath)} from a temporary app.`);
} finally {
  rmSync(workspace, { recursive: true, force: true });
}
