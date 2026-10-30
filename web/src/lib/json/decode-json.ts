import { z } from "zod";

// The console forbids eval; disable JIT and its capability probe before constructing schemas.
z.config({ jitless: true });

/** Object boundary for opaque, vendor-owned extension properties. */
export const objectSchema = z.record(z.string(), z.unknown());

/** Parses a JSON string (or decoded value) and validates its expected shape. */
export function decodeJson<T>(value: unknown, schema: z.ZodType<T>): T {
  const decoded: unknown =
    typeof value === "string" ? JSON.parse(value) : value;
  return schema.parse(decoded);
}
