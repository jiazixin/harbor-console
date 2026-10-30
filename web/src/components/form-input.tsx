import { type ComponentProps, useId } from "react";
import { FieldError } from "./field-error";
import { useFieldError } from "./form-errors";

type FormInputProps = ComponentProps<"input"> & { fieldPath?: string };

export function FormInput({ fieldPath, ...props }: FormInputProps) {
  const message = useFieldError(fieldPath ?? props.name);
  const errorId = useId();
  return (
    <>
      <input
        {...props}
        aria-invalid={message ? true : props["aria-invalid"]}
        aria-describedby={
          message
            ? [props["aria-describedby"], errorId].filter(Boolean).join(" ")
            : props["aria-describedby"]
        }
      />
      <FieldError id={errorId} message={message} />
    </>
  );
}
