import {
  createContext,
  useContext,
  useEffect,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from "react";
import {
  readStoredItem,
  writeStoredItem,
} from "../lib/browser-storage/storage";

type Theme = "dark" | "light";
type ThemeValue = readonly [Theme, Dispatch<SetStateAction<Theme>>];
const ThemeContext = createContext<ThemeValue | null>(null);
const themeStorageKey = "harbor-console-theme";
type ThemeProviderProps = { children: ReactNode };

export function ThemeProvider({ children }: ThemeProviderProps) {
  const [theme, setTheme] = useState<Theme>(() =>
    readStoredItem("localStorage", themeStorageKey) === "dark"
      ? "dark"
      : "light",
  );
  useEffect(() => {
    const root = document.documentElement;
    const previous = root.dataset.theme;
    const meta = document.querySelector('meta[name="theme-color"]');
    const previousColor = meta?.getAttribute("content");
    root.dataset.theme = theme;
    writeStoredItem("localStorage", themeStorageKey, theme);
    meta?.setAttribute(
      "content",
      getComputedStyle(root).getPropertyValue("--bg").trim(),
    );
    return () => {
      if (previous === undefined) delete root.dataset.theme;
      else root.dataset.theme = previous;
      if (previousColor) meta?.setAttribute("content", previousColor);
    };
  }, [theme]);
  return <ThemeContext value={[theme, setTheme]}>{children}</ThemeContext>;
}

export function useTheme(): ThemeValue {
  const value = useContext(ThemeContext);
  if (!value) throw new Error("useTheme must be used within ThemeProvider");
  return value;
}
