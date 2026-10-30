import { type ComponentProps, useId } from "react";
import { FieldError } from "./field-error";
import { useFieldError } from "./form-errors";

type FormTextareaProps = ComponentProps<"textarea"> & { fieldPath?: string };

export function FormTextarea({ fieldPath, ...props }: FormTextareaProps) {
  const message = useFieldError(fieldPath ?? props.name);
  const errorId = useId();
  return (
    <>
      <textarea
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
