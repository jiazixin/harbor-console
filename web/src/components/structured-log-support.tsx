export type LogTimezone = "local" | "utc";

type ParsedLogLine = {
  time: string;
  level: string;
  content: string;
};

export function parseHarborLogLine(value: string): ParsedLogLine {
  const match =
    /^(\d{4}-\d{2}-\d{2}[T ][0-9:.+-]+Z?)\s+\[?(TRACE|DEBUG|INFO|WARNING|WARN|ERROR|FATAL)\]?\s*(.*)$/i.exec(
      value,
    );
  if (!match) return { time: "", level: "LOG", content: value };
  const [, time = "", rawLevel = "", content = ""] = match;
  const level = rawLevel.toUpperCase();
  return { time, level: level === "WARNING" ? "WARN" : level, content };
}
