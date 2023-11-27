import { defineConfig } from "tsup";

export default defineConfig({
  entry: [
    "packages/camera/index.ts",
    "packages/model/index.ts",
    "packages/user/index.ts",
    "packages/scheduler/index.ts"
  ],
  splitting: false,
  sourcemap: true,
  clean: true,
  noExternal: [/.*/]
});
