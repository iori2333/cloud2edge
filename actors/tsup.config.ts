import { defineConfig } from "tsup";

export default defineConfig({
  entry: [
    "packages/air-purifier/index.ts",
    "packages/control/index.ts",
    "packages/db/index.ts"
  ],
  splitting: false,
  sourcemap: true,
  clean: true,
  noExternal: [/.*/],
  treeshake: true,
});
