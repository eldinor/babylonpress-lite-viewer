import { cpSync } from "node:fs";

cpSync("src/assets", "dist/assets", { recursive: true });
