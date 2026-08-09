import { useMemo } from "react";
import { useRecurringStore } from "../store/recurringStore";
import { pendingConfirmation } from "../store/selectors";

// Lee directo de la cache en memoria (ver store/recurringStore). Las
// pendientes de confirmación se derivan de la misma lista en vez de pedirlas
// aparte a /pending-confirmation/list.
export function useRecurring() {
  const items = useRecurringStore((s) => s.items);
  const status = useRecurringStore((s) => s.status);
  const error = useRecurringStore((s) => s.error);

  const pending = useMemo(() => pendingConfirmation(items), [items]);

  return { items, pending, isLoading: status === "idle" || status === "loading", error };
}
