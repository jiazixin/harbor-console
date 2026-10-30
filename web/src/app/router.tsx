import { createHashRouter } from "react-router";
import { consoleRoutes } from "./console-routes";
import { ReactApplication } from "./react-application";
import { SessionProvider } from "./session-provider";

/**
 * Hash routing: the Go server serves the console at one path and has no SPA
 * fallback for client routes.
 */
export function createConsoleRouter() {
  return createHashRouter([
    {
      path: "/",
      element: (
        <SessionProvider>
          <ReactApplication />
        </SessionProvider>
      ),
      children: consoleRoutes,
    },
  ]);
}
