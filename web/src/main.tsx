import { QueryClientProvider } from "@tanstack/react-query";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "react-router";
import { LocaleProvider } from "./app/locale-context";
import { createQueryClient } from "./app/query-client";
import { createConsoleRouter } from "./app/router";
import { ThemeProvider } from "./app/theme-provider";
import { ToastProvider } from "./app/toast-provider";

import "./styles/base.css";
import "./styles/motion.css";
import "./styles/tokens.css";

const root = document.querySelector<HTMLElement>("#root");
if (!root) throw new Error("Harbor Console root element is missing");
const queryClient = createQueryClient();
const router = createConsoleRouter();
createRoot(root).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <LocaleProvider>
        <ThemeProvider>
          <ToastProvider>
            <RouterProvider router={router} />
          </ToastProvider>
        </ThemeProvider>
      </LocaleProvider>
    </QueryClientProvider>
  </StrictMode>,
);
