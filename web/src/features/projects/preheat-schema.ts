import { z } from "zod";
import { decodeJson, objectSchema } from "../../lib/json/decode-json";

const filtersSchema = z.array(
  z.looseObject({ type: z.string().optional(), value: z.string().optional() }),
);
const triggerSchema = z.looseObject({
  type: z.string().optional(),
  trigger_setting: z.looseObject({ cron: z.string().optional() }).optional(),
});

export function preheatFilters(value: unknown) {
  return decodeJson(value ?? [], filtersSchema);
}

export function preheatTrigger(value: unknown) {
  return decodeJson(value ?? {}, triggerSchema);
}

export function preheatExtra(value: unknown) {
  return decodeJson(value ?? {}, objectSchema);
}
