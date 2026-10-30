import { type Dispatch, type SetStateAction, useState } from "react";

/**
 * Editable local state that starts from `source` and resets whenever `source`
 * changes, for example a search box whose applied value comes from the URL and
 * changes on back/forward navigation.
 *
 * The reset happens during render rather than in an effect, so an edit made
 * right after mounting is never overwritten by a late effect.
 */
export function useResettableState<Value>(
  source: Value,
): [Value, Dispatch<SetStateAction<Value>>] {
  const [value, setValue] = useState(source);
  const [previousSource, setPreviousSource] = useState(source);
  if (!Object.is(previousSource, source)) {
    setPreviousSource(source);
    setValue(source);
  }
  return [value, setValue];
}
