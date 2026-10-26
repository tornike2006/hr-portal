import { useMemo, useState } from "react";
import { Field, Modal, useToast } from "./ui";
import { useT } from "../i18n";
import { useSession } from "../lib/session";
import { errMsg, must, supabase } from "../lib/supabase";
import { today, workdaysBetween } from "../lib/dates";
import { LEAVE_TYPES, paidUsed } from "../lib/leave";
import type { LeaveRequest, LeaveType } from "../lib/types";

/** Request time off. HR may pick any employee and approve immediately. */
export function LeaveModal({ leaves, employeeId, onClose, onSaved }: { leaves: LeaveRequest[]; employeeId?: string; onClose: () => void; onSaved: () => void }) {
  const { t } = useT();
  const toast = useToast();
  const { me, isHR, employees, settings } = useSession();
  const active = employees.filter((e) => e.status !== "inactive");
  const [emp, setEmp] = useState(employeeId ?? me?.id ?? active[0]?.id ?? "");
  const [type, setType] = useState<LeaveType>("paid");
  const [from, setFrom] = useState(today());
  const [to, setTo] = useState(today());
  const [note, setNote] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const days = workdaysBetween(from, to, settings.six_day_week);
  const left = useMemo(() => settings.annual_leave - paidUsed(leaves, emp, Number(from.slice(0, 4))), [leaves, emp, from, settings.annual_leave]);

  async function save(approve: boolean) {
    setErr("");
    if (to < from) return setErr(t("leave.errOrder"));
    if (!days) return setErr(t("leave.errNoDays"));
    if (type === "paid" && days > left) return setErr(t("leave.errBalance", { n: left }));
    setBusy(true);
    try {
      const row = await must(
        supabase.from("leave_requests").insert({ employee_id: emp, type, start_date: from, end_date: to, days, note: note.trim() || null }).select().single(),
      );
      if (approve) await must(supabase.rpc("decide_leave", { p_id: (row as LeaveRequest).id, p_approve: true }));
      toast(approve ? t("leave.savedApproved") : t("leave.sent"));
      onSaved();
      onClose();
    } catch (e) {
      setErr(errMsg(e));
    } finally {
      setBusy(false);
    }
  }

  const canApproveNow = isHR && emp !== me?.id;

  return (
    <Modal
      title={t("leave.request")}
      onClose={onClose}
      footer={
        <>
          <button className="btn" onClick={onClose}>{t("common.cancel")}</button>
          <button className={"btn" + (canApproveNow ? "" : " primary")} disabled={busy} onClick={() => save(false)}>{t("leave.submit")}</button>
          {canApproveNow && <button className="btn primary" disabled={busy} onClick={() => save(true)}>{t("leave.submitApprove")}</button>}
        </>
      }
    >
      <div className="form-grid">
        {isHR && !employeeId && (
          <Field label={t("common.employee")} wide>
            <select value={emp} onChange={(e) => setEmp(e.target.value)}>
              {active.map((e) => <option key={e.id} value={e.id}>{e.full_name}</option>)}
            </select>
          </Field>
        )}
        <Field label={t("leave.type")} wide>
          <select value={type} onChange={(e) => setType(e.target.value as LeaveType)}>
            {LEAVE_TYPES.map((k) => <option key={k} value={k}>{t(`leave.t.${k}`)}</option>)}
          </select>
        </Field>
        <Field label={t("leave.from")}><input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></Field>
        <Field label={t("leave.to")}><input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></Field>
        <Field label={t("leave.note")} wide><input value={note} onChange={(e) => setNote(e.target.value)} /></Field>
      </div>
      <p className="muted small">
        {t("leave.daysCount", { n: days })} · {settings.six_day_week ? t("leave.excl6") : t("leave.excl5")}
        {type === "paid" && <> · {t("leave.balanceLeft", { n: left })}</>}
      </p>
      {err && <p className="error">{err}</p>}
    </Modal>
  );
}
