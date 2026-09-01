import { defineConfig } from "vitest/config";
import path from "path";

// Mirrors tsconfig.json's paths — "@/*" -> this app's root, plus the
// workspace package alias, so tests can import the same way app code does.
export default defineConfig({
  test: {
    environment: "node",
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
      "@velobot/shared": path.resolve(__dirname, "../../packages/shared/src/index.ts"),
      // Vite (unlike plain Node `require`) honors package.json's "browser"
      // field, which is how the real "server-only" package enforces its
      // guard — it resolves to a throwing shim under Vite's bundling even
      // though this is a Node test run, not a browser one. Every file this
      // suite imports uses it purely as a lint-time marker, so a no-op is
      // exactly correct here.
      "server-only": path.resolve(__dirname, "./lib/test-utils/server-only-noop.ts"),
    },
  },
});
