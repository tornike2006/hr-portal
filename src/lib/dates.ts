// Georgian calendar helpers: public holidays (incl. Orthodox Easter), working days, formatting.

export const pad = (n: number) => String(n).padStart(2, "0");
export const iso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const today = () => iso(new Date());
export const monthKey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;

export function parse(s: string): Date {
  const [y, m, d] = s.slice(0, 10).split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function fmt(s: string | null | undefined): string {
  if (!s) return "—";
  const [y, m, d] = s.slice(0, 10).split("-");
  return `${d}.${m}.${y}`;
}

export function orthodoxEaster(y: number): Date {
  const a = y % 4, b = y % 7, c = y % 19;
  const d = (19 * c + 15) % 30, e = (2 * a + 4 * b - d + 34) % 7;
  const mo = Math.floor((d + e + 114) / 31), da = ((d + e + 114) % 31) + 1;
  const dt = new Date(y, mo - 1, da);
  dt.setDate(dt.getDate() + 13); // Julian → Gregorian (1900–2099)
  return dt;
}

const FIXED: [string, string, string][] = [
  ["01-01", "ახალი წელი", "New Year"],
  ["01-02", "ახალი წელი", "New Year"],
  ["01-07", "შობა", "Orthodox Christmas"],
  ["01-19", "ნათლისღება", "Epiphany"],
  ["03-03", "დედის დღე", "Mother's Day"],
  ["03-08", "ქალთა საერთაშორისო დღე", "Women's Day"],
  ["04-09", "ეროვნული ერთიანობის დღე", "National Unity Day"],
  ["05-09", "გამარჯვების დღე", "Victory Day"],
  ["05-12", "წმ. ანდრია პირველწოდებული", "St. Andrew's Day"],
  ["05-17", "ოჯახის სიწმინდის დღე", "Family Sanctity Day"],
  ["05-26", "დამოუკიდებლობის დღე", "Independence Day"],
  ["08-28", "მარიამობა", "Assumption"],
  ["10-14", "სვეტიცხოვლობა", "Svetitskhovloba"],
  ["11-23", "გიორგობა", "St. George's Day"],
];

const cache = new Map<number, Map<string, [string, string]>>();
export function holidays(y: number): Map<string, [string, string]> {
  const hit = cache.get(y);
  if (hit) return hit;
  const m = new Map<string, [string, string]>(FIXED.map(([k, ka, en]) => [k, [ka, en]]));
  const e = orthodoxEaster(y);
  const easter: [number, string, string][] = [
    [-2, "დიდი პარასკევი", "Good Friday"],
    [-1, "დიდი შაბათი", "Holy Saturday"],
    [0, "აღდგომა", "Easter Sunday"],
    [1, "აღდგომის ორშაბათი", "Easter Monday"],
  ];
  for (const [o, ka, en] of easter) {
    const d = new Date(e);
    d.setDate(d.getDate() + o);
    m.set(`${pad(d.getMonth() + 1)}-${pad(d.getDate())}`, [ka, en]);
  }
  cache.set(y, m);
  return m;
}

export function holidayName(d: Date, lang: "ka" | "en" = "ka"): string | undefined {
  const h = holidays(d.getFullYear()).get(`${pad(d.getMonth() + 1)}-${pad(d.getDate())}`);
  return h ? (lang === "ka" ? h[0] : h[1]) : undefined;
}

export const isWeekend = (d: Date, sixDay: boolean) => d.getDay() === 0 || (d.getDay() === 6 && !sixDay);
export const isWorkday = (d: Date, sixDay: boolean) => !isWeekend(d, sixDay) && !holidayName(d);

export function daysInMonth(mk: string): number {
  const [y, m] = mk.split("-").map(Number);
  return new Date(y, m, 0).getDate();
}

export function workdaysInMonth(mk: string, sixDay: boolean): number {
  const [y, m] = mk.split("-").map(Number);
  let n = 0;
  for (let i = 1; i <= daysInMonth(mk); i++) if (isWorkday(new Date(y, m - 1, i), sixDay)) n++;
  return n;
}

export function workdaysBetween(a: string, b: string, sixDay: boolean): number {
  if (!a || !b || b < a) return 0;
  const d = parse(a), e = parse(b);
  let n = 0;
  while (d <= e) {
    if (isWorkday(d, sixDay)) n++;
    d.setDate(d.getDate() + 1);
  }
  return n;
}

export function shiftMonth(mk: string, o: number): string {
  const [y, m] = mk.split("-").map(Number);
  return monthKey(new Date(y, m - 1 + o, 1));
}

export function nextBirthday(bd: string, from = new Date()): Date {
  const [, m, d] = bd.split("-").map(Number);
  const start = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  let n = new Date(from.getFullYear(), m - 1, d);
  if (n < start) n = new Date(from.getFullYear() + 1, m - 1, d);
  return n;
}

export function ageOn(bd: string, on: Date): number {
  const b = parse(bd);
  let a = on.getFullYear() - b.getFullYear();
  if (on.getMonth() < b.getMonth() || (on.getMonth() === b.getMonth() && on.getDate() < b.getDate())) a--;
  return a;
}

export function overlaps(aStart: string, aEnd: string, bStart: string, bEnd: string) {
  return aStart <= bEnd && bStart <= aEnd;
}
