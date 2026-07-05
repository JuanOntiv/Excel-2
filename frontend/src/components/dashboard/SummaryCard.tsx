import type { ReactNode } from "react";

interface SummaryCardProps {
  label: string;
  value: string;
  icon: ReactNode;
  tone?: "neutral" | "positive" | "negative";
}

const toneStyles = {
  neutral: "text-ink-light dark:text-ink-dark",
  positive: "text-positive",
  negative: "text-negative",
};

export function SummaryCard({ label, value, icon, tone = "neutral" }: SummaryCardProps) {
  return (
    <div className="rounded-xl border border-line-light dark:border-line-dark bg-surface-elevated-light dark:bg-surface-elevated-dark p-5 flex items-start justify-between">
      <div>
        <p className="text-sm text-ink-muted-light dark:text-ink-muted-dark mb-1">{label}</p>
        <p className={`text-2xl font-semibold ${toneStyles[tone]}`}>{value}</p>
      </div>
      <div className="text-ink-muted-light dark:text-ink-muted-dark">{icon}</div>
    </div>
  );
}
