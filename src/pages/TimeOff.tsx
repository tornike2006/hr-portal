import { useState } from "react";
import { useT } from "../i18n";
import { useSession } from "../lib/session";
import { useQuery } from "../lib/useQuery";
import { errMsg, must, supabase } from "../lib/supabase";
import { daysInMonth, fmt, holidayName, iso, isWeekend, monthKey, shiftMonth, today } from "../lib/dates";
import { cancelLeave, decideLeave, paidUsed, statusTone } from "../lib/leave";
import type { Absence, LeaveRequest } from "../lib/types";
import { Badge, ConfirmButton, Empty, PageHead, Person, Seg, useToast } from "../components/ui";
import { Icon } from "../components/Icon";
import { LeaveModal } from "../components/LeaveModal";

type View = "mine" | "approvals" | "calendar" | "balances";

export function TimeOff() {
  const { t, df, lang } = useT();
  const toast = useToast();
  const { me, isHR, isManager, emp, employees, settings } = useSession();
  const [view, setView] = useState<View>(isHR || isManager ? "approvals" : "mine");
  const [filter, setFilter] = useState<"pending" | "all">("pending");
  const [month, setMonth] = useState(monthKey(new Date()));
  const [asking, setAsking] = useState(false);

  const { data, reload } = useQuery(async () => {
    const [leaves, absences] = await Promise.all([
      must(supabase.from("leave_requests").select("*").order("start_date", { ascending: false })),
      must(supabase.from("absences").select("*").lte("start_date", `${month}-${daysInMonth(month)}`).gte("end_date", `${month}-01`)),
    ]);
    return { leaves: leaves as LeaveRequest[], absences: absences as Absence[] };
  }, [month]);

  const leaves = data?.leaves ?? [];
  const y = new Date().getFullYear();
  const mine = leaves.filter((l) => l.employee_id === me?.id);
  const others = leaves.filter((l) => l.employee_id !== me?.id || isHR);
  const queue = others.filter((l) => (filter === "pending" ? l.status === "pending" : true));

  async function decide(id: string, ok: boolean) {
    const l = leaves.find((x) => x.id === id);
    if (ok && l && l.type === "paid") {
      const left = settings.annual_leave - paidUsed(leaves, l.employee_id, Number(l.start_date.slice(0, 4)));
      if (l.days > left) return toast(t("leave.errBalance", { n: left }), true);
    }
    try {
      await decideLeave(id, ok);
      toast(ok ? t("leave.approved") : t("leave.rejected"));
      reload();
    } catch (e) {
      toast(errMsg(e), true);
    }
  }

  async function cancel(id: string) {
    try {
      await cancelLeave(id);
      toast(t("leave.cancelledMsg"));
      reload();
    } catch (e) {
      toast(errMsg(e), true);
    }
  }

  async function remove(id: string) {
    try {
      await must(supabase.from("leave_requests").delete().eq("id", id));
      reload();
    } catch (e) {
      toast(errMsg(e), true);
    }
  }

  const views: [View, string][] = [];
  if (me) views.push(["mine", t("leave.mine")]);
  if (isHR || isManager) views.push(["approvals", t("leave.approvals")]);
  views.push(["calendar", t("leave.calendar")]);
  if (isHR) views.push(["balances", t("leave.balances")]);

  const row = (l: LeaveRequest, actions: boolean) => (
    <div className="item" key={l.id}>
      <div className="grow">
        {actions ? <Person emp={emp(l.employee_id)} sub={`${t(`leave.t.${l.type}`)} · ${fmt(l.start_date)} – ${fmt(l.end_date)} · ${t("leave.daysShort", { n: l.days })}${l.note ? ` · ${l.note}` : ""}`} />
          : <><b>{t(`leave.t.${l.type}`)}</b><span>{fmt(l.start_date)} – {fmt(l.end_date)} · {t("leave.daysShort", { n: l.days })}{l.note ? ` · ${l.note}` : ""}</span></>}
      </div>
      <Badge tone={statusTone(l.status)}>{t(`leave.s.${l.status}`)}</Badge>
      {actions && l.status === "pending" && l.employee_id !== me?.id && (
        <>
          <button className="btn sm" onClick={() => decide(l.id, true)}>{t("leave.approve")}</button>
          <button className="btn sm danger" onClick={() => decide(l.id, false)}>{t("leave.reject")}</button>
        </>
      )}
      {!actions && l.status === "pending" && <ConfirmButton className="btn sm" onConfirm={() => cancel(l.id)}>{t("leave.cancel")}</ConfirmButton>}
      {actions && isHR && l.status !== "pending" && <ConfirmButton className="btn ghost sm" onConfirm={() => remove(l.id)}>{t("common.delete")}</ConfirmButton>}
    </div>
  );

  return (
    <>
      <PageHead title={t("nav.timeoff")} sub={t("leave.sub", { n: settings.annual_leave })}>
        <button className="btn primary" onClick={() => setAsking(true)}><Icon name="plus" size={16} /> {t("leave.request")}</button>
      </PageHead>
      <Seg value={view} onChange={setView} options={views} />

      {view === "mine" && me && (
        <>
          <div className="stats">
            <div className="stat"><b>{settings.annual_leave - paidUsed(leaves, me.id, y)}</b><span>{t("dash.leaveLeft", { y })}</span></div>
            <div className="stat"><b>{paidUsed(leaves, me.id, y)}</b><span>{t("leave.used")}</span></div>
            <div className="stat"><b>{mine.filter((l) => l.status === "pending").length}</b><span>{t("leave.s.pending")}</span></div>
          </div>
          <section className="card"><div className="list">{mine.length ? mine.map((l) => row(l, false)) : <Empty>{t("leave.none")}</Empty>}</div></section>
        </>
      )}

      {view === "approvals" && (
        <section className="card">
          <div className="card-head">
            <h2>{t("leave.approvals")}</h2>
            <Seg value={filter} onChange={setFilter} options={[["pending", t("leave.s.pending")], ["all", t("common.all")]]} />
          </div>
          <div className="list">{queue.length ? queue.map((l) => row(l, true)) : <Empty>{t("leave.noQueue")}</Empty>}</div>
        </section>
      )}

      {view === "calendar" && (
        <section className="card">
          <div className="card-head">
            <h2>{df(month + "-01", "my")}</h2>
            <div className="row">
              <button className="btn sm" onClick={() => setMonth(shiftMonth(month, -1))} aria-label={t("common.prev")}>←</button>
              <button className="btn sm" onClick={() => setMonth(monthKey(new Date()))}>{t("dash.today")}</button>
              <button className="btn sm" onClick={() => setMonth(shiftMonth(month, 1))} aria-label={t("common.next")}>→</button>
            </div>
          </div>
          <Calendar month={month} absences={data?.absences ?? []} six={settings.six_day_week} lang={lang} />
        </section>
      )}

      {view === "balances" && isHR && (
        <section className="card table-wrap">
          <table>
            <thead><tr><th>{t("common.employee")}</th><th className="r">{t("leave.used")}</th><th className="r">{t("leave.left")}</th></tr></thead>
            <tbody>
              {employees.filter((e) => e.status !== "inactive").map((e) => {
                const u = paidUsed(leaves, e.id, y);
                return <tr key={e.id}><td><Person emp={e} size={28} /></td><td className="r">{u}</td><td className="r"><b>{settings.annual_leave - u}</b></td></tr>;
              })}
            </tbody>
          </table>
        </section>
      )}

      {asking && <LeaveModal leaves={leaves} onClose={() => setAsking(false)} onSaved={reload} />}
    </>
  );
}

function Calendar({ month, absences, six, lang }: { month: string; absences: Absence[]; six: boolean; lang: "ka" | "en" }) {
  const { t } = useT();
  const { emp } = useSession();
  const [y, m] = month.split("-").map(Number);
  const first = new Date(y, m - 1, 1);
  const lead = (first.getDay() + 6) % 7; // Monday-first
  const n = daysInMonth(month);
  const td = today();
  const cells: (Date | null)[] = [...Array(lead).fill(null), ...Array.from({ length: n }, (_, i) => new Date(y, m - 1, i + 1))];
  while (cells.length % 7) cells.push(null);
  const dows = ["dow.mon", "dow.tue", "dow.wed", "dow.thu", "dow.fri", "dow.sat", "dow.sun"] as const;
  return (
    <div className="cal">
      {dows.map((d) => <div key={d} className="dow">{t(d)}</div>)}
      {cells.map((d, i) => {
        if (!d) return <div key={i} className="out" />;
        const ds = iso(d);
        const hol = holidayName(d, lang);
        const evs = absences.filter((a) => a.start_date <= ds && a.end_date >= ds && emp(a.employee_id));
        const cls = [hol ? "hol" : isWeekend(d, six) ? "we" : "", ds === td ? "today" : ""].join(" ");
        return (
          <div key={i} className={cls}>
            <span className="d">{d.getDate()}</span>
            {hol && <span className="hn" title={hol}>{hol}</span>}
            {evs.slice(0, 3).map((a) => <span key={a.id} className="ev" title={emp(a.employee_id)!.full_name}>{emp(a.employee_id)!.full_name}</span>)}
            {evs.length > 3 && <span className="faint small">+{evs.length - 3}</span>}
          </div>
        );
      })}
    </div>
  );
}
