import { useState } from "react";
import { useT } from "../i18n";
import { useSession } from "../lib/session";
import { useQuery } from "../lib/useQuery";
import { errMsg, must, supabase } from "../lib/supabase";
import { daysInMonth, holidayName, iso, isWeekend, isWorkday, monthKey, shiftMonth, workdaysInMonth } from "../lib/dates";
import { CODES, CODE_CLASS, cellCode, loadMonth, monthTotals, type Att } from "../lib/timesheet";
import { Empty, PageHead, useToast } from "../components/ui";

const DOW = ["dow.sun", "dow.mon", "dow.tue", "dow.wed", "dow.thu", "dow.fri", "dow.sat"] as const;

export function Timesheet() {
  const { t, df, lang } = useT();
  const toast = useToast();
  const { employees, settings } = useSession();
  const six = settings.six_day_week;
  const [month, setMonth] = useState(monthKey(new Date()));
  const { data, setData, reload } = useQuery(() => loadMonth(month), [month]);
  const active = employees.filter((e) => e.status !== "inactive");
  const [y, m] = month.split("-").map(Number);
  const days = Array.from({ length: daysInMonth(month) }, (_, i) => new Date(y, m - 1, i + 1));

  function patch(fn: (a: Att) => void) {
    if (!data) return;
    const att = new Map(data.att);
    fn(att);
    setData({ ...data, att });
  }

  async function cycle(empId: string, d: Date) {
    if (!data) return;
    const cur = cellCode(data.att, data.leaves, empId, d, six);
    const next = CODES[(CODES.indexOf(cur.auto ? "" : cur.v) + 1) % CODES.length];
    const key = `${empId}|${iso(d)}`;
    patch((a) => (next ? a.set(key, next) : a.delete(key)));
    try {
      if (next) await must(supabase.from("attendance").upsert({ employee_id: empId, day: iso(d), code: next }));
      else await must(supabase.from("attendance").delete().eq("employee_id", empId).eq("day", iso(d)));
    } catch (e) {
      toast(errMsg(e), true);
      reload();
    }
  }

  async function fill() {
    if (!data) return;
    const rows: { employee_id: string; day: string; code: string }[] = [];
    for (const e of active)
      for (const d of days)
        if (isWorkday(d, six) && !cellCode(data.att, data.leaves, e.id, d, six).v) rows.push({ employee_id: e.id, day: iso(d), code: "8" });
    if (!rows.length) return toast(t("ts.alreadyFull"));
    try {
      await must(supabase.from("attendance").upsert(rows));
      toast(t("ts.filled"));
      reload();
    } catch (e) {
      toast(errMsg(e), true);
    }
  }

  return (
    <>
      <PageHead title={t("nav.timesheet")} sub={t("ts.sub", { n: workdaysInMonth(month, six), w: six ? 6 : 5 })}>
        <button className="btn sm" onClick={() => setMonth(shiftMonth(month, -1))} aria-label={t("common.prev")}>←</button>
        <b style={{ minWidth: 140, textAlign: "center" }}>{df(new Date(y, m - 1, 1), "my")}</b>
        <button className="btn sm" onClick={() => setMonth(shiftMonth(month, 1))} aria-label={t("common.next")}>→</button>
        <button className="btn primary" onClick={fill} disabled={!active.length}>{t("ts.fill")}</button>
      </PageHead>
      <div className="legend">
        <span><b>8</b> {t("ts.hours")}</span><span><b className="c-sh">შ</b> {t("leave.t.paid")}</span><span><b className="c-b">ბ</b> {t("leave.t.sick")}</span>
        <span><b className="c-g">გ</b> {t("ts.absent")}</span><span><b className="c-u">უ</b> {t("leave.t.unpaid")}</span><span><i>{t("ts.italic")}</i></span>
      </div>
      <section className="card">
        {!active.length ? <Empty>{t("people.empty")}</Empty> : (
          <div className="table-wrap">
            <table className="tabel">
              <thead>
                <tr>
                  <th className="name">{t("common.employee")}</th>
                  {days.map((d) => {
                    const h = holidayName(d, lang);
                    return <th key={d.getDate()} className={h ? "hol" : isWeekend(d, six) ? "we" : ""} title={h}>{d.getDate()}<br />{t(DOW[d.getDay()])}</th>;
                  })}
                  <th>{t("ts.days")}</th><th>{t("ts.hrs")}</th>
                </tr>
              </thead>
              <tbody>
                {active.map((e) => {
                  const tot = data ? monthTotals(data.att, data.leaves, e.id, month, six) : { paid: 0, hours: 0 };
                  return (
                    <tr key={e.id}>
                      <td className="name">{e.full_name}</td>
                      {days.map((d) => {
                        const c = data ? cellCode(data.att, data.leaves, e.id, d, six) : { v: "", auto: false };
                        const h = holidayName(d);
                        return (
                          <td key={d.getDate()} className={h ? "hol" : isWeekend(d, six) ? "we" : ""}>
                            <button className={`cell ${c.auto ? "auto" : ""} ${CODE_CLASS[c.v] ?? ""}`} onClick={() => cycle(e.id, d)} aria-label={`${e.full_name}, ${d.getDate()}: ${c.v || "—"}`}>{c.v}</button>
                          </td>
                        );
                      })}
                      <td className="tot">{tot.paid}</td><td className="tot">{tot.hours}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
