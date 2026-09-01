import { defineConfig, loadEnv } from "vite";
import { resolve } from "path";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");

  return {
    define: {
      __VELOBOT_API_BASE__: JSON.stringify(env.VITE_API_BASE_URL ?? "http://localhost:3000"),
      __VELOBOT_SUPABASE_URL__: JSON.stringify(env.VITE_SUPABASE_URL ?? ""),
      __VELOBOT_SUPABASE_ANON_KEY__: JSON.stringify(env.VITE_SUPABASE_ANON_KEY ?? ""),
    },
    build: {
      lib: {
        entry: resolve(__dirname, "src/main.ts"),
        name: "VeloBotWidget",
        formats: ["iife"],
        fileName: () => "widget.js",
      },
      // A single dependency-free file is the whole point of the embed —
      // no code-splitting, no external CSS file to fetch separately.
      cssCodeSplit: false,
      rollupOptions: {
        output: { inlineDynamicImports: true },
      },
      minify: "esbuild",
      sourcemap: true,
    },
  };
});
