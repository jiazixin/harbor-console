import { createHash } from "node:crypto";
import path from "node:path";
import { fileURLToPath, URL } from "node:url";

import react from "@vitejs/plugin-react";
import { loadEnv } from "vite";
import { defineConfig } from "vitest/config";

export default defineConfig(({ mode }) => {
  const environment = loadEnv(
    mode,
    fileURLToPath(new URL(".", import.meta.url)),
    "",
  );
  const backendURL = environment.HARBOR_BACKEND_URL || "http://127.0.0.1:8080";
  const backendOrigin = new URL(backendURL).origin;
  return {
    root: fileURLToPath(new URL(".", import.meta.url)),
    publicDir: "public",
    css: {
      modules: {
        // Stable scoped names allow styles to address a composed primitive explicitly.
        generateScopedName(name, filename) {
          const relative = path
            .relative(fileURLToPath(new URL(".", import.meta.url)), filename)
            .split(path.sep)
            .join("/");
          return `hc_${createHash("sha256").update(relative).digest("hex").slice(0, 8)}_${name}`;
        },
      },
    },
    plugins: [react()],
    build: {
      target: ["chrome124", "firefox126", "safari17.4"],
      outDir: fileURLToPath(new URL("./dist", import.meta.url)),
      emptyOutDir: true,
      assetsDir: "bundles",
      sourcemap: false,
      // Keep the entry's modulepreload in index.html, but do not inject preload
      // links for lazy routes: WebKit reports any link preload still waiting
      // for its importer three seconds after the load event as unused.
      modulePreload: {
        resolveDependencies: (_filename, dependencies, { hostType }) =>
          hostType === "html" ? dependencies : [],
      },
      rollupOptions: {
        output: {
          manualChunks(moduleId) {
            if (moduleId.includes("/node_modules/react")) {
              return "react-vendor";
            }

            return undefined;
          },
        },
      },
    },
    server: {
      host: "127.0.0.1",
      port: 5173,
      proxy: {
        "/api": {
          target: backendURL,
          changeOrigin: true,
          configure(proxy) {
            proxy.on("proxyReq", (proxyRequest, request) => {
              if (request.headers.origin) {
                proxyRequest.setHeader("Origin", backendOrigin);
              }
            });
          },
        },
        "/healthz": backendURL,
      },
    },
    test: {
      css: { include: [/\.css$/], modules: { classNameStrategy: "scoped" } },
      environment: "jsdom",
      setupFiles: ["./src/test/setup.ts"],
      include: ["src/**/*.test.{ts,tsx}", "tests/**/*.test.mjs"],
    },
  };
});
