import { useState, useCallback } from "react";

const STORAGE_KEY = "transactionsWalletId";

/**
 * Cartera activa en las vistas de Ingresos/Egresos.
 *
 * Se guarda en localStorage (mismo patrón que ThemeContext) para que la
 * selección sobreviva tanto al cambiar entre Ingresos y Egresos como al
 * recargar la página. No hace falta contexto ni store: las dos vistas son
 * rutas distintas, así que nunca están montadas a la vez.
 *
 * null = "Todas": no se manda wallet_id y el backend devuelve todo, que es
 * justo el comportamiento de la cartera default (implícita).
 */
export function useSelectedWallet() {
  const [walletId, setWalletIdState] = useState<string | null>(() =>
    localStorage.getItem(STORAGE_KEY)
  );

  const setWalletId = useCallback((id: string | null) => {
    if (id) localStorage.setItem(STORAGE_KEY, id);
    else localStorage.removeItem(STORAGE_KEY);
    setWalletIdState(id);
  }, []);

  return [walletId, setWalletId] as const;
}
