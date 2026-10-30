import { createContext, useContext } from "react";
import { ApiError } from "../app/api-client";
import { errorText } from "../app/errors";

/** Field messages are shared by a form owner and its native/select controls. */
export const FormErrorsContext = createContext<Record<string, string>>({});

export function useFieldError(name: string | undefined): string | undefined {
  const errors = useContext(FormErrorsContext);
  return name ? errors[name] : undefined;
}

/** Maps the validated error field paths through the sole user-message boundary. */
export function formErrors(error: unknown): Record<string, string> {
  if (!(error instanceof ApiError) || error.code !== "invalid_argument")
    return {};
  const fields = error.details.fields;
  if (!Array.isArray(fields)) return {};
  const messages: Record<string, string> = {};
  for (const candidate of fields) {
    const field: unknown = candidate;
    if (
      !field ||
      typeof field !== "object" ||
      !("path" in field) ||
      !("reason" in field)
    )
      continue;
    if (typeof field.path !== "string" || typeof field.reason !== "string")
      continue;
    messages[field.path] = errorText(
      new ApiError("invalid form field", {
        status: error.status,
        code: error.code,
        requestId: error.requestId,
        details: { fields: [{ path: field.path, reason: field.reason }] },
      }),
    );
  }
  return messages;
}
