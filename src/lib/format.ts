export const fmtUSD = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(n || 0);

export const fmtCOP = (n: number) =>
  new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(n || 0);

export const fmtPct = (n: number, digits = 1) =>
  `${(n * 100).toFixed(digits)}%`;

export const fmtNum = (n: number, digits = 4) =>
  new Intl.NumberFormat("en-US", { maximumFractionDigits: digits }).format(n || 0);

const LOCALE_BY_CCY: Record<string, string> = {
  USD: "en-US", COP: "es-CO", EUR: "de-DE", MXN: "es-MX", BRL: "pt-BR",
};

export const fmtCurrency = (n: number, code: string) => {
  try {
    return new Intl.NumberFormat(LOCALE_BY_CCY[code] ?? "en-US", {
      style: "currency",
      currency: code,
      maximumFractionDigits: code === "COP" || code === "MXN" ? 0 : 2,
    }).format(n || 0);
  } catch {
    return `${(n || 0).toFixed(2)} ${code}`;
  }
};
