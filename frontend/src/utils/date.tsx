export function getCurrentMonthRange(): { start_date: string; end_date: string } {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);

  return {
    start_date: formatDate(start),
    end_date: formatDate(end),
  };
}

function formatDate(d: Date): string {
  return d.toISOString().split("T")[0]; // YYYY-MM-DD
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN", // ajusta si tu moneda es otra
  }).format(amount);
}
