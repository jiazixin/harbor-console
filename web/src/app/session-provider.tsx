import { createContext, useContext, type ReactNode } from "react";
import { useConsoleRoute } from "./console-route";
import { useConsoleSession } from "./use-console-session";

type SessionValue = ReturnType<typeof useConsoleSession>;
const SessionContext = createContext<SessionValue | null>(null);
type SessionProviderProps = { children: ReactNode };

export function SessionProvider({ children }: SessionProviderProps) {
  const { navigate } = useConsoleRoute();
  const value = useConsoleSession(navigate);
  return <SessionContext value={value}>{children}</SessionContext>;
}

export function useSession(): SessionValue {
  const value = useContext(SessionContext);
  if (!value) throw new Error("useSession must be used within SessionProvider");
  return value;
}
