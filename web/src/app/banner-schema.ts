import { z } from "zod";
import { decodeJson } from "../lib/json/decode-json";

const bannerSchema = z.object({
  message: z.string().default(""),
  type: z.enum(["danger", "info", "success", "warning"]).catch("warning"),
  closable: z.boolean().default(false),
  fromDate: z.string().default(""),
  toDate: z.string().default(""),
});

/** Validates the vendor banner setting before any component reads its fields. */
export function parseBanner(value: unknown) {
  return decodeJson(value || {}, bannerSchema);
}
