import { defineConfig } from "tsup";

export default defineConfig({
  entry: [
    "packages/air-purifier/index.ts",
    "packages/control/index.ts",
    "packages/led/index.ts"
  ],
  splitting: false,
  sourcemap: true,
  clean: true
});
