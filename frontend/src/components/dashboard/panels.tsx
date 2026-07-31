import { type ReactNode } from "react";
import { Link } from "react-router-dom";
import { ChevronRight, ArrowUpRight, ArrowDownRight, Target, Wallet as WalletIcon, Receipt, Star } from "lucide-react";
import { formatCurrency } from "../../utils/date";
import { categoryColor } from "../../utils/categoryColor";
import type { GoalProgress, Wallet, Transaction, Category } from "../../types";

const PANEL_TONES = {
  accent: "bg-accent/10 text-accent",
  accent2: "bg-accent2/10 text-accent2",
  neutral: "bg-ink-muted-light/10 text-ink-muted-light dark:bg-ink-muted-dark/10 dark:text-ink-muted-dark",
} as const;

// Fila individual dentro de un panel. `tone` son clases extra (fondo/borde) que
// decide cada panel según un dato real propio (avance de meta, cartera default,
// etc); `bgColor` es lo mismo pero para un color hex arbitrario (ej. el color
// de una categoría, que no es una clase de Tailwind). Sin ninguno de los dos
// la fila solo lleva un borde tenue para verse separada.
// `to` = la fila entera es clickeable y navega a esa ruta.
function ItemRow({
  tone,
  bgColor,
  spacious,
  to,
  children,
}: {
  tone?: string;
  bgColor?: string;
  spacious?: boolean;
  to?: string;
  children: ReactNode;
}) {
  const rowClass = `flex items-center gap-2.5 rounded-lg border border-line-light dark:border-line-dark ${
    spacious ? "px-3.5 py-3" : "px-2.5 py-2"
  } ${tone ?? ""}`;
  const style = bgColor ? { backgroundColor: `color-mix(in srgb, ${bgColor} 16%, transparent)` } : undefined;

  if (to) {
    return (
      <li>
        <Link to={to} style={style} className={`${rowClass} hover:opacity-80 transition-opacity`}>
          {children}
        </Link>
      </li>
    );
  }

  return (
    <li className={rowClass} style={style}>
      {children}
    </li>
  );
}

// Contenedor común de los paneles del dashboard: icono + título (con badge de color propio por panel) + "Ver más" opcional.
function PanelCard({
  title,
  icon,
  tone,
  to,
  children,
}: {
  title: string;
  icon: ReactNode;
  tone: keyof typeof PANEL_TONES;
  to?: string;
  children: ReactNode;
}) {
  return (
    <div className="rounded-xl border border-line-light dark:border-line-dark bg-surface-elevated-light dark:bg-surface-elevated-dark p-5 flex flex-col">
      <div className="flex items-center justify-between gap-2 pb-3.5 mb-4 border-b border-line-light dark:border-line-dark">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${PANEL_TONES[tone]}`}>
            {icon}
          </span>
          <h3 className="text-base font-semibold tracking-tight text-ink-light dark:text-ink-dark truncate">
            {title}
          </h3>
        </div>
        {to && (
          <Link to={to} className="text-sm font-medium text-accent hover:underline flex items-center gap-0.5 shrink-0">
            Ver más <ChevronRight size={15} />
          </Link>
        )}
      </div>
      {children}
    </div>
  );
}

function EmptyRow({ text }: { text: string }) {
  return <p className="text-[15px] text-ink-muted-light dark:text-ink-muted-dark">{text}</p>;
}

// El progreso ya viene calculado por el servidor dentro de cada meta (ver
// list_goals en routes/goals.py), así que este panel ya no encadena un
// getGoalProgress() por meta.
export function GoalsPreview({ goals }: { goals: GoalProgress[] }) {
  const shown = goals.slice(0, 3);

  return (
    <PanelCard title="Metas" icon={<Target size={16} />} tone="accent2" to="/goals">
      {shown.length === 0 ? (
        <EmptyRow text="Sin metas aún." />
      ) : (
        <ul className="flex flex-col gap-3">
          {shown.map((g) => {
            const pct = Math.max(0, Math.min(100, Math.round(g.percentage)));
            const onTrack = g.is_on_track;
            return (
              <ItemRow
                key={g.id}
                spacious
                tone={onTrack ? "bg-accent2/[0.15]" : "bg-negative/[0.15]"}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-[15px] font-medium text-ink-light dark:text-ink-dark">
                      {g.name}
                    </span>
                    <span
                      className={`text-[15px] font-semibold shrink-0 ${onTrack ? "text-accent2" : "text-negative"}`}
                    >
                      {pct}%
                    </span>
                  </div>
                  <div className="mt-2 h-1.5 rounded-full bg-line-light dark:bg-line-dark overflow-hidden">
                    <div
                      className={`h-full rounded-full ${onTrack ? "bg-accent2" : "bg-negative"}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <p className="mt-1 text-xs text-ink-muted-light dark:text-ink-muted-dark">
                    {formatCurrency(g.current_amount)} de {formatCurrency(g.target_amount)}
                  </p>
                </div>
              </ItemRow>
            );
          })}
        </ul>
      )}
    </PanelCard>
  );
}

export function WalletsPreview({ wallets }: { wallets: Wallet[] }) {
  const shown = wallets.slice(0, 3);

  return (
    <PanelCard title="Carteras" icon={<WalletIcon size={16} />} tone="accent" to="/wallets">
      {shown.length === 0 ? (
        <EmptyRow text="Sin carteras aún." />
      ) : (
        <ul className="flex flex-col gap-3">
          {shown.map((w) => (
            <ItemRow
              key={w.id}
              spacious
              to={`/wallets/${w.id}`}
              tone={w.is_default ? "bg-accent-soft dark:bg-accent/20 border-l-4 border-l-accent" : undefined}
            >
              <div className="min-w-0 flex-1 flex items-center gap-1.5">
                {w.is_default && <Star size={14} className="text-accent shrink-0" fill="currentColor" />}
                <div className="min-w-0">
                  <p className="truncate text-[15px] font-medium text-ink-light dark:text-ink-dark">{w.name}</p>
                  {w.description && (
                    <p className="truncate text-sm text-ink-muted-light dark:text-ink-muted-dark">{w.description}</p>
                  )}
                </div>
              </div>
            </ItemRow>
          ))}
        </ul>
      )}
    </PanelCard>
  );
}

export function RecentTransactionsPreview({
  transactions,
  categories,
  walletTo,
}: {
  transactions: Transaction[];
  categories: Category[];
  /** Ruta a la cartera principal, para el enlace "Ver más". undefined = no se muestra. */
  walletTo?: string;
}) {
  const recent = [...transactions].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5);

  function category(id: string) {
    return categories.find((c) => c.id === id);
  }

  return (
    <PanelCard title="Transacciones recientes" icon={<Receipt size={16} />} tone="neutral" to={walletTo}>
      {recent.length === 0 ? (
        <EmptyRow text="Sin transacciones aún." />
      ) : (
        <ul className="flex flex-col gap-1.5">
          {recent.map((t) => {
            const isIncome = t.type === "income";
            const cat = category(t.category_id);
            return (
              <ItemRow key={t.id} bgColor={categoryColor(t.category_id, cat?.color)}>
                <div className="min-w-0 flex-1 flex items-center gap-1.5">
                  {isIncome ? (
                    <ArrowUpRight size={14} className="text-positive shrink-0" />
                  ) : (
                    <ArrowDownRight size={14} className="text-negative shrink-0" />
                  )}
                  <div className="min-w-0">
                    <p className="truncate text-[15px] font-medium text-ink-light dark:text-ink-dark">{t.name}</p>
                    <p className="truncate text-sm text-ink-muted-light dark:text-ink-muted-dark">
                      {cat?.name ?? "Sin categoría"} ·{" "}
                      {new Date(t.date).toLocaleDateString("es-MX", { day: "numeric", month: "short" })}
                    </p>
                  </div>
                </div>
                <span
                  className={`text-[15px] font-semibold shrink-0 ${isIncome ? "text-positive" : "text-negative"}`}
                >
                  {isIncome ? "+" : "−"}
                  {formatCurrency(t.amount)}
                </span>
              </ItemRow>
            );
          })}
        </ul>
      )}
    </PanelCard>
  );
}
