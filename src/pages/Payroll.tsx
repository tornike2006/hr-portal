import { useState } from "react";
import { useT } from "../i18n";
import { useSession } from "../lib/session";
import { useQuery } from "../lib/useQuery";
import { errMsg, must, supabase } from "../lib/supabase";
import { monthKey, shiftMonth, workdaysInMonth } from "../lib/dates";
import { calcPay, gel, INCOME_TAX, PENSION, type PayLine } from "../lib/payroll";
import { loadMonth, monthTotals } from "../lib/timesheet";
import type { EmployeePrivate } from "../lib/types";
import { Empty, PageHead, saveFile, useToast } from "../components/ui";
import { Icon } from "../components/Icon";

export function Payroll() {
  const { t, df, locale } = useT();
  const toast = useToast();
  const { employees, settings } = useSession();
  const six = settings.six_day_week;
  const [month, setMonth] = useState(monthKey(new Date()));
  const [bonusDraft, setBonusDraft] = useState<Record<string, string>>({});

  const { data, reload } = useQuery(async () => {
    const [ts, priv, adj] = await Promise.all([
      loadMonth(month),
      must(supabase.from("employee_private").select("*")),
      must(supabase.from("payroll_adjustments").select("*").eq("month", month)),
    ]);
    return {
      ts,
      priv: new Map((priv as EmployeePrivate[]).map((p) => [p.employee_id, p])),
      bonus: new Map((adj as { employee_id: string; bonus: number }[]).map((a) => [a.employee_id, Number(a.bonus)])),
    };
  }, [month]);

  const active = employees.filter((e) => e.status !== "inactive");
  const wd = workdaysInMonth(month, six);
  const rows: { e: (typeof active)[number]; c: PayLine; pid: string }[] = data
    ? active.map((e) => {
        const p = data.priv.get(e.id);
        const tot = monthTotals(data.ts.att, data.ts.leaves, e.id, month, six);
        return { e, pid: p?.personal_id ?? "", c: calcPay({ salary: Number(p?.salary ?? 0), pension: p?.pension ?? true, bonus: data.bonus.get(e.id) ?? 0, workDays: wd, paidDays: tot.any ? tot.paid : null }) };
      })
    : [];
  const sum = (k: keyof PayLine) => rows.reduce((s, r) => s + (r.c[k] as number), 0);
  const money = (n: number) => gel(n, locale);

  async function saveBonus(empId: string) {
    const raw = bonusDraft[empId];
    if (raw === undefined) return;
    const n = Math.max(0, Number(raw) || 0);
    try {
      if (n) await must(supabase.from("payroll_adjustments").upsert({ employee_id: empId, month, bonus: n }));
      else await must(supabase.from("payroll_adjustments").delete().eq("employee_id", empId).eq("month", month));
      setBonusDraft((d) => { const x = { ...d }; delete x[empId]; return x; });
      reload();
    } catch (e) {
      toast(errMsg(e), true);
    }
  }

  function exportCsv() {
    const q = (s: unknown) => `"${String(s).replace(/"/g, '""')}"`;
    const head = [t("common.employee"), t("emp.pid"), t("emp.position"), t("pay.base"), t("pay.days"), t("pay.bonus"), t("pay.gross"), t("pay.pension"), t("pay.tax"), t("pay.net"), t("pay.employer")];
    const lines = [head.map(q).join(","), ...rows.map(({ e, c, pid }) => [e.full_name, pid, e.position ?? "", c.base, `${c.paidDays}/${c.workDays}`, c.bonus, c.gross, c.pension, c.tax, c.net, c.employerPension].map(q).join(","))];
    saveFile(`payroll-${month}.csv`, "﻿" + lines.join("\r\n"), "text/csv;charset=utf-8");
  }

  const [y, m] = month.split("-").map(Number);
  return (
    <>
      <PageHead title={t("nav.payroll")} sub={t("pay.sub", { tax: INCOME_TAX * 100, p: PENSION * 100 })}>
        <button className="btn sm" onClick={() => setMonth(shiftMonth(month, -1))} aria-label={t("common.prev")}>←</button>
        <b style={{ minWidth: 140, textAlign: "center" }}>{df(new Date(y, m - 1, 1), "my")}</b>
        <button className="btn sm" onClick={() => setMonth(shiftMonth(month, 1))} aria-label={t("common.next")}>→</button>
        <button className="btn primary" onClick={exportCsv} disabled={!rows.length}><Icon name="download" size={16} /> {t("pay.export")}</button>
      </PageHead>
      <div className="stats">
        <div className="stat"><b>{money(sum("gross"))}</b><span>{t("pay.gross")}</span></div>
        <div className="stat"><b>{money(sum("net"))}</b><span>{t("pay.net")}</span></div>
        <div className="stat"><b>{money(sum("tax"))}</b><span>{t("pay.tax")}</span></div>
        <div className="stat"><b>{money(sum("pension") + sum("employerPension"))}</b><span>{t("pay.pensionTotal")}</span></div>
      </div>
      <section className="card">
        {!active.length ? <Empty>{t("people.empty")}</Empty> : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>{t("common.employee")}</th><th className="r">{t("pay.base")}</th><th className="r">{t("pay.days")}</th><th className="r">{t("pay.bonus")}</th><th className="r">{t("pay.gross")}</th><th className="r">{t("pay.pension")}</th><th className="r">{t("pay.tax")}</th><th className="r">{t("pay.net")}</th><th className="r">{t("pay.employer")}</th></tr>
              </thead>
              <tbody>
                {rows.map(({ e, c }) => (
                  <tr key={e.id}>
                    <td><b>{e.full_name}</b><div className="small muted">{e.position}</div></td>
                    <td className="r">{money(c.base)}</td>
                    <td className="r" title={c.fromTimesheet ? t("pay.fromTs") : t("pay.fullMonth")}>{c.paidDays} / {c.workDays}{c.fromTimesheet ? "" : " *"}</td>
                    <td className="r">
                      <input className="inline-num" type="number" min="0" step="0.01" placeholder="0" aria-label={`${t("pay.bonus")}: ${e.full_name}`}
                        value={bonusDraft[e.id] ?? (c.bonus || "")}
                        onChange={(ev) => setBonusDraft((d) => ({ ...d, [e.id]: ev.target.value }))}
                        onBlur={() => saveBonus(e.id)}
                        onKeyDown={(ev) => ev.key === "Enter" && (ev.target as HTMLInputElement).blur()} />
                    </td>
                    <td className="r">{money(c.gross)}</td><td className="r">{money(c.pension)}</td><td className="r">{money(c.tax)}</td>
                    <td className="r"><b>{money(c.net)}</b></td><td className="r">{money(c.employerPension)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr><td>{t("pay.total")}</td><td className="r">{money(sum("base"))}</td><td /><td className="r">{money(sum("bonus"))}</td><td className="r">{money(sum("gross"))}</td><td className="r">{money(sum("pension"))}</td><td className="r">{money(sum("tax"))}</td><td className="r">{money(sum("net"))}</td><td className="r">{money(sum("employerPension"))}</td></tr>
              </tfoot>
            </table>
          </div>
        )}
      </section>
      <p className="small muted">{t("pay.note")}</p>
    </>
  );
}
