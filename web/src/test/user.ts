import { fireEvent } from "@testing-library/react";
import userEvent, { type UserEvent } from "@testing-library/user-event";

export function setupUser(): UserEvent {
  return userEvent.setup();
}

/**
 * Replaces a field's value the way a user does: picks the option of a select,
 * or clears a text field and types the new text.
 */
export async function replaceText(
  user: UserEvent,
  element: HTMLElement,
  value: string,
): Promise<void> {
  if (element instanceof HTMLInputElement && element.type === "color") {
    // user-event cannot drive the native color picker.
    fireEvent.change(element, { target: { value } });
    return;
  }
  if (element instanceof HTMLSelectElement) {
    await user.selectOptions(element, value);
    return;
  }
  await user.clear(element);
  // user-event reads "{" and "[" as key descriptors; doubling types them.
  if (value) await user.type(element, value.replace(/[{[]/g, "$&$&"));
}
