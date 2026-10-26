import type { LeaveRequest, LeaveType } from "./types";
import { supabase, must } from "./supabase";

export const LEAVE_TYPES: LeaveType[] = ["paid", "unpaid", "sick", "maternity"];
export const LEAVE_CODE: Record<LeaveType, string> = { paid: "შ", unpaid: "უ", sick: "ბ", maternity: "დ" };

export function paidUsed(leaves: LeaveRequest[], employeeId: string, year: number): number {
  return leaves
    .filter((l) => l.employee_id === employeeId && l.status === "approved" && l.type === "paid" && l.start_date.startsWith(String(year)))
    .reduce((s, l) => s + l.days, 0);
}

export async function decideLeave(id: string, approve: boolean) {
  await must(supabase.rpc("decide_leave", { p_id: id, p_approve: approve }));
}

export async function cancelLeave(id: string) {
  await must(supabase.rpc("cancel_leave", { p_id: id }));
}

export const statusTone = (s: string) =>
  s === "approved" ? "ok" : s === "pending" ? "warn" : s === "rejected" ? "bad" : "mute";
