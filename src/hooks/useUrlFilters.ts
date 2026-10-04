/**
 * List filters kept in the page address (ARCHITECTURE §3.3).
 *
 * WHY:  A filtered list can be bookmarked, shared and survives a refresh, and Back
 *       returns to the same filters. Home links straight to a filtered list (Q-59e).
 * HOW:  Reads the named query-string keys; `set` changes one (an empty value removes
 *       it) and `clear` removes them all. Changes replace the history entry, so
 *       typing a filter does not fill the Back stack (Q-56).
 * WHEN: Collections and Distributions lists.
 * SECURITY: Values come from the address bar, so they are untrusted: the pages check
 *       them (statuses against the known list, dates against a pattern) before use.
 */
import { useSearchParams } from "react-router";

export function useUrlFilters(keys: readonly string[]) {
  const [params, setParams] = useSearchParams();

  const values = Object.fromEntries(keys.map((key) => [key, params.get(key) ?? ""]));
  const activeCount = keys.filter((key) => params.get(key)).length;

  function set(key: string, value: string) {
    const next = new URLSearchParams(params);
    if (value === "") {
      next.delete(key);
    } else {
      next.set(key, value);
    }
    setParams(next, { replace: true });
  }

  function clear() {
    const next = new URLSearchParams(params);
    for (const key of keys) {
      next.delete(key);
    }
    setParams(next, { replace: true });
  }

  return { values, activeCount, set, clear };
}
