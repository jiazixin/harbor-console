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
    plugins: [react()],
    resolve: {
      alias: {
        "@": fileURLToPath(new URL("./src", import.meta.url)),
      },
    },
    build: {
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
        "/health": backendURL,
      },
    },
    test: {
      environment: "jsdom",
      setupFiles: ["./src/test/setup.ts"],
      include: ["src/**/*.test.{ts,tsx}"],
    },
  };
});
