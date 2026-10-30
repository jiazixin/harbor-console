import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { LocaleProvider } from "../app/locale-context";
import { ThemeProvider } from "../app/theme-provider";
import { ToastProvider } from "../app/toast-provider";

/**
 * The application providers for component tests: an isolated QueryClient that
 * does not retry, and the locale context.
 */
type TestProvidersProps = { children: ReactNode };

export function TestProviders({ children }: TestProvidersProps) {
  const [client] = useState(
    () => new QueryClient({ defaultOptions: { queries: { retry: false } } }),
  );
  return (
    <QueryClientProvider client={client}>
      <LocaleProvider>
        <ThemeProvider>
          <ToastProvider>{children}</ToastProvider>
        </ThemeProvider>
      </LocaleProvider>
    </QueryClientProvider>
  );
}
