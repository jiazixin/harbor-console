import { errorText } from "./errors";

/** Retains a partial response's failure so the page can display it beside available data. */
export async function optionalData<T>(
  request: Promise<T>,
): Promise<{ data?: T; error: string }> {
  try {
    return { data: await request, error: "" };
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError")
      throw error;
    return { error: errorText(error) };
  }
}
