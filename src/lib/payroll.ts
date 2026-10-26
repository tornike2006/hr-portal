// Georgian payroll: 20% personal income tax on (gross − pension), 2% employee + 2% employer pension.
export const INCOME_TAX = 0.2;
export const PENSION = 0.02;

const r2 = (n: number) => Math.round(n * 100) / 100;

export interface PayLine {
  base: number;
  paidDays: number;
  workDays: number;
  fromTimesheet: boolean;
  bonus: number;
  gross: number;
  pension: number;
  tax: number;
  net: number;
  employerPension: number;
}

export function calcPay(opts: {
  salary: number;
  pension: boolean;
  bonus: number;
  workDays: number;
  paidDays: number | null; // null = timesheet empty → full month
}): PayLine {
  const { salary, bonus, workDays } = opts;
  const fromTimesheet = opts.paidDays !== null;
  const paidDays = opts.paidDays ?? workDays;
  const ratio = workDays ? Math.min(1, paidDays / workDays) : 1;
  const gross = r2(salary * ratio + bonus);
  const pension = opts.pension ? r2(gross * PENSION) : 0;
  const tax = r2((gross - pension) * INCOME_TAX);
  return { base: salary, paidDays, workDays, fromTimesheet, bonus, gross, pension, tax, net: r2(gross - pension - tax), employerPension: pension };
}

/** Georgian money format "1 234,50 ₾", built by hand since not every browser ships ka-GE number data. */
export function gel(n: number, locale = "ka-GE"): string {
  if (!locale.startsWith("ka")) return n.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " ₾";
  const [int, dec] = Math.abs(n).toFixed(2).split(".");
  return (n < 0 ? "−" : "") + int.replace(/\B(?=(\d{3})+(?!\d))/g, "\u00a0") + "," + dec + "\u00a0₾";
}
