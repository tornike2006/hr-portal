import { daysInMonth, iso, isWorkday } from "./dates";
import { LEAVE_CODE } from "./leave";
import { must, supabase } from "./supabase";
import type { LeaveRequest } from "./types";

export const CODES = ["", "8", "შ", "ბ", "გ", "უ"]; // empty, hours, leave, sick, absent, unpaid
export const CODE_CLASS: Record<string, string> = { "შ": "c-sh", "ბ": "c-b", "გ": "c-g", "უ": "c-u", "დ": "c-u" };

export type Att = Map<string, string>; // key `${employeeId}|${yyyy-mm-dd}` → code

export async function loadMonth(month: string) {
  const end = `${month}-${daysInMonth(month)}`;
  const [att, leaves] = await Promise.all([
    must(supabase.from("attendance").select("*").gte("day", `${month}-01`).lte("day", end)),
    must(supabase.from("leave_requests").select("*").eq("status", "approved").lte("start_date", end).gte("end_date", `${month}-01`)),
  ]);
  const map: Att = new Map((att as { employee_id: string; day: string; code: string }[]).map((r) => [`${r.employee_id}|${r.day}`, r.code]));
  return { att: map, leaves: leaves as LeaveRequest[] };
}

/** Code shown in a cell: an explicit entry, else an approved leave on a workday (shown as "auto"). */
export function cellCode(att: Att, leaves: LeaveRequest[], employeeId: string, d: Date, six: boolean): { v: string; auto: boolean } {
  const ds = iso(d);
  const v = att.get(`${employeeId}|${ds}`);
  if (v) return { v, auto: false };
  if (!isWorkday(d, six)) return { v: "", auto: false };
  const l = leaves.find((x) => x.employee_id === employeeId && x.start_date <= ds && x.end_date >= ds);
  return l ? { v: LEAVE_CODE[l.type], auto: true } : { v: "", auto: false };
}

export function monthTotals(att: Att, leaves: LeaveRequest[], employeeId: string, month: string, six: boolean) {
  const [y, m] = month.split("-").map(Number);
  let hours = 0, paid = 0, any = false;
  for (let i = 1; i <= daysInMonth(month); i++) {
    const { v } = cellCode(att, leaves, employeeId, new Date(y, m - 1, i), six);
    if (!v) continue;
    any = true;
    const h = Number(v);
    if (h > 0) { hours += h; paid++; } else if (v === "შ") paid++;
  }
  return { hours, paid, any };
}
