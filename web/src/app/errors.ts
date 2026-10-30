import { ApiError } from "./api-client";
import { describeApiError } from "./api-errors";
import { readStoredLocale } from "./locale-context";

/**
 * Returns the user text of a failure in the current locale: the caller's code
 * table first, then the console's code catalog, then a text for the HTTP
 * status. Only explicitly marked local validation messages are safe to show.
 */
export function errorText(
  error: unknown,
  messages: Record<string, string> = {},
): string {
  if (error instanceof DOMException && error.name === "AbortError") return "";
  if (error instanceof ApiError) {
    const own = messages[error.code];
    if (own !== undefined) return own;
    return describeApiError(
      error.code
        ? { code: error.code, message: error.message, details: error.details }
        : undefined,
      error.status,
      readStoredLocale(),
    );
  }
  if (error instanceof UserInputError) return error.userText;
  return describeApiError(undefined, 0, readStoredLocale());
}

/** A local, user-facing validation failure with a separate developer message. */
export class UserInputError extends Error {
  readonly userText: string;
  constructor(userText: string) {
    super("invalid form input");
    this.name = "UserInputError";
    this.userText = userText;
  }
}
