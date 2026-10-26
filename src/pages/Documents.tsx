import { useEffect, useMemo, useRef, useState } from "react";
import { useT } from "../i18n";
import { useSession } from "../lib/session";
import { useQuery } from "../lib/useQuery";
import { must, supabase } from "../lib/supabase";
import { parse, today } from "../lib/dates";
import { gel } from "../lib/payroll";
import { paidUsed } from "../lib/leave";
import type { Employee, EmployeePrivate, LeaveRequest, Settings } from "../lib/types";
import { Empty, Field, PageHead, saveFile, useToast } from "../components/ui";
import { Icon } from "../components/Icon";

type Tpl = "contract" | "hire" | "leave" | "fire" | "cert";
const TPLS: Tpl[] = ["contract", "hire", "leave", "fire", "cert"];
const MONTHS = ["იანვარი", "თებერვალი", "მარტი", "აპრილი", "მაისი", "ივნისი", "ივლისი", "აგვისტო", "სექტემბერი", "ოქტომბერი", "ნოემბერი", "დეკემბერი"];
const LEAVE_KA: Record<string, string> = { paid: "ანაზღაურებადი", unpaid: "ანაზღაურების გარეშე", sick: "ავადმყოფობის", maternity: "ორსულობის, მშობიარობისა და ბავშვის მოვლის" };

const esc = (s: unknown) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
const gap = (v: string | null | undefined, ph: string) => (v ? esc(v) : `<span class="gap">${esc(ph)}</span>`);
const long = (s: string | null | undefined) => {
  if (!s) return `<span class="gap">[თარიღი]</span>`;
  const d = parse(s);
  return `${d.getFullYear()} წლის ${d.getDate()} ${MONTHS[d.getMonth()]}`;
};

interface Opts { no: string; date: string; term: string; end: string; basis: string; purpose: string; leave?: LeaveRequest; leftDays: number }

function render(tpl: Tpl, e: Employee, p: EmployeePrivate | undefined, c: Settings, o: Opts, position: string, deptName: string): string {
  const co = gap(c.company, "[კომპანიის სახელი]"), code = gap(c.company_code, "[ს/კ]"), addr = gap(c.address, "[მისამართი]"), dir = gap(c.director, "[დირექტორი]");
  const nm = esc(e.full_name), pid = gap(p?.personal_id, "[პირადი ნომერი]"), pos = gap(position, "[თანამდებობა]");
  const salary = gel(Number(p?.salary ?? 0));
  const no = gap(o.no, "___");
  const meta = `<div class="meta"><span>ქ. ${esc(c.city || "თბილისი")}</span><span>${long(o.date)}</span></div>`;
  const sig = `<table class="sig"><tr><td>დირექტორი<br>${dir}</td><td style="text-align:right">ხელმოწერა: ______________</td></tr></table>`;
  const ack = `<p style="margin-top:20px">ბრძანებას გავეცანი: ${nm} ______________ &nbsp; „___“ __________ 20__ წ.</p>`;
  const law = `საქართველოს ორგანული კანონის „საქართველოს შრომის კოდექსი“`;
  switch (tpl) {
    case "contract": {
      const week = c.six_day_week ? "ორშაბათიდან შაბათის ჩათვლით (6-დღიანი სამუშაო კვირა)" : "ორშაბათიდან პარასკევის ჩათვლით (5-დღიანი სამუშაო კვირა); შაბათი და კვირა დასვენების დღეებია";
      return `<h3>შრომითი ხელშეკრულება № ${no}</h3>${meta}
<p>${co} (საიდენტიფიკაციო კოდი ${code}, მისამართი: ${addr}), წარმოდგენილი დირექტორის სახით (დირექტორი: ${dir}) (შემდგომში „დამსაქმებელი“), ერთი მხრივ, და ${nm} (პირადი № ${pid}) (შემდგომში „დასაქმებული“), მეორე მხრივ, ვდებთ წინამდებარე ხელშეკრულებას შემდეგზე:</p>
<h4>1. ხელშეკრულების საგანი</h4>
<p>1.1. დასაქმებული იღებს ვალდებულებას, შეასრულოს სამუშაო თანამდებობაზე „${pos}“${deptName ? ` (${esc(deptName)})` : ""}, ხოლო დამსაქმებელი — გადაუხადოს შრომის ანაზღაურება.</p>
<p>1.2. სამუშაოს დაწყების თარიღი: ${long(e.start_date)}.</p>
<p>1.3. ${o.term ? `ხელშეკრულება იდება განსაზღვრული ვადით. ვადის ამოწურვის თარიღი: ${long(o.term)}.` : "ხელშეკრულება იდება განუსაზღვრელი ვადით."}</p>
<h4>2. სამუშაო დრო</h4>
<p>2.1. სამუშაო კვირა: ${week}.</p>
<p>2.2. სამუშაო დროის ხანგრძლივობა არ აღემატება კვირაში 40 საათს. ზეგანაკვეთური სამუშაო ანაზღაურდება კანონმდებლობით დადგენილი წესით.</p>
<h4>3. შრომის ანაზღაურება</h4>
<p>3.1. ყოველთვიური ხელფასი: ${salary} (დარიცხული, გადასახადების ჩათვლით).</p>
<p>3.2. ხელფასი გაიცემა თვეში ერთხელ, არაუგვიანეს მომდევნო თვის 10 რიცხვისა, უნაღდო ანგარიშსწორებით.</p>
<p>3.3. დამსაქმებელი ხელფასიდან აკავებს საშემოსავლო გადასახადს${p?.pension !== false ? " და საპენსიო შენატანს" : ""} მოქმედი კანონმდებლობის შესაბამისად.</p>
<h4>4. შვებულება</h4>
<p>4.1. დასაქმებულს უფლება აქვს, ისარგებლოს ანაზღაურებადი შვებულებით წელიწადში ${c.annual_leave} სამუშაო დღით.</p>
<p>4.2. ანაზღაურების გარეშე, ავადმყოფობის, ორსულობისა და მშობიარობის შვებულებები გაიცემა კანონმდებლობით დადგენილი წესით.</p>
<h4>5. მხარეთა უფლება-მოვალეობები</h4>
<p>5.1. დასაქმებული ვალდებულია, კეთილსინდისიერად შეასრულოს სამუშაო, დაიცვას შინაგანაწესი და არ გაამჟღავნოს კონფიდენციალური ინფორმაცია.</p>
<p>5.2. დამსაქმებელი ვალდებულია, უზრუნველყოს უსაფრთხო სამუშაო გარემო და დროულად გადაუხადოს ხელფასი.</p>
<h4>6. ხელშეკრულების შეწყვეტა</h4>
<p>6.1. ხელშეკრულება შეიძლება შეწყდეს ${law} დადგენილი საფუძვლებითა და წესით.</p>
<h4>7. დასკვნითი დებულებები</h4>
<p>7.1. ხელშეკრულებით გაუთვალისწინებელი საკითხები რეგულირდება საქართველოს კანონმდებლობით.</p>
<p>7.2. ხელშეკრულება შედგენილია ორ თანაბარი იურიდიული ძალის მქონე ეგზემპლარად.</p>
<table class="sig"><tr><td><b>დამსაქმებელი</b><br>${co}<br>ს/კ ${code}<br>${dir}<br><br>______________</td><td><b>დასაქმებული</b><br>${nm}<br>პ/ნ ${pid}<br>${esc(p?.address ?? "")}<br><br>______________</td></tr></table>`;
    }
    case "hire":
      return `<h3>${co}</h3><p class="c">ბრძანება № ${no}</p>${meta}<p class="c"><b>სამსახურში მიღების შესახებ</b></p>
<p>${law} და მხარეთა შორის დადებული შრომითი ხელშეკრულების საფუძველზე,</p><p class="c"><b>ვბრძანებ:</b></p>
<p>1. ${nm} (პირადი № ${pid}) მიღებულ იქნას სამსახურში თანამდებობაზე „${pos}“${deptName ? ` (${esc(deptName)})` : ""}, ყოველთვიური ხელფასით ${salary} (დარიცხული). სამსახურში მიღების თარიღი: ${long(e.start_date)}.</p>
<p>2. ბუღალტერიას დაევალოს ხელფასის დარიცხვა ამ ბრძანების შესაბამისად.</p>
<p>3. ბრძანება ძალაშია ხელმოწერისთანავე.</p>${sig}${ack}`;
    case "leave": {
      const l = o.leave;
      if (!l) return `<p class="c">ამ თანამშრომელს დამტკიცებული შვებულება არ აქვს.</p>`;
      return `<h3>${co}</h3><p class="c">ბრძანება № ${no}</p>${meta}<p class="c"><b>შვებულების მიცემის შესახებ</b></p>
<p>${law} და დასაქმებულის განცხადების საფუძველზე,</p><p class="c"><b>ვბრძანებ:</b></p>
<p>1. თანამშრომელს ${nm} (პირადი № ${pid}), თანამდებობა „${pos}“, მიეცეს ${LEAVE_KA[l.type]} შვებულება ${l.days} სამუშაო დღით. შვებულების პერიოდი: ${long(l.start_date)} – ${long(l.end_date)} (ჩათვლით).</p>
${l.type === "paid" ? `<p>2. ბუღალტერიას დაევალოს შვებულების ანაზღაურება კანონმდებლობით დადგენილი წესით.</p><p>3. ბრძანება ძალაშია ხელმოწერისთანავე.</p>` : `<p>2. ბრძანება ძალაშია ხელმოწერისთანავე.</p>`}${sig}${ack}`;
    }
    case "fire":
      return `<h3>${co}</h3><p class="c">ბრძანება № ${no}</p>${meta}<p class="c"><b>სამსახურიდან გათავისუფლების შესახებ</b></p>
<p>${law} შესაბამისად, საფუძველი: ${gap(o.basis, "[საფუძველი]")},</p><p class="c"><b>ვბრძანებ:</b></p>
<p>1. თანამშრომელი ${nm} (პირადი № ${pid}) გათავისუფლდეს დაკავებული თანამდებობიდან („${pos}“). გათავისუფლების თარიღი: ${long(o.end)}.</p>
<p>2. ბუღალტერიას დაევალოს საბოლოო ანგარიშსწორება, მათ შორის გამოუყენებელი შვებულების (${o.leftDays} სამუშაო დღე) კომპენსაცია.</p>
<p>3. ბრძანება ძალაშია ხელმოწერისთანავე.</p>${sig}${ack}`;
    case "cert":
      return `<h3>${co}</h3><p class="c">ს/კ ${code} · ${addr}</p><p class="c" style="margin-top:20px"><b>ცნობა № ${no}</b></p>${meta}
<p>ეს ცნობა გაცემულია იმის დასტურად, რომ ${nm} (პირადი № ${pid}) ${e.status === "inactive" ? "მუშაობდა" : "მუშაობს"} ${co}-ში, თანამდებობაზე „${pos}“. სამსახურში მიღების თარიღი: ${long(e.start_date)}.</p>
<p>ყოველთვიური ხელფასი (დარიცხული): ${salary}.</p>
<p>ცნობა გაიცა წარსადგენად ${gap(o.purpose, "მოთხოვნისამებრ")}.</p>${sig}<p class="small" style="margin-top:20px">ბ.ა.</p>`;
  }
}

export function Documents() {
  const { t } = useT();
  const toast = useToast();
  const { employees, settings, dept } = useSession();
  const sorted = useMemo(() => [...employees].sort((a, b) => a.full_name.localeCompare(b.full_name, "ka")), [employees]);
  const [tpl, setTpl] = useState<Tpl>("contract");
  const [empId, setEmpId] = useState(sorted[0]?.id ?? "");
  const [o, setO] = useState<Omit<Opts, "leave" | "leftDays">>({ no: "", date: today(), term: "", end: today(), basis: "დასაქმებულის პირადი განცხადება", purpose: "" });
  const [leaveId, setLeaveId] = useState("");
  const paper = useRef<HTMLDivElement>(null);

  useEffect(() => { if (!empId && sorted[0]) setEmpId(sorted[0].id); }, [sorted, empId]);

  const { data } = useQuery(async () => {
    if (!empId) return null;
    const [p, l] = await Promise.all([
      must(supabase.from("employee_private").select("*").eq("employee_id", empId).maybeSingle()),
      must(supabase.from("leave_requests").select("*").eq("employee_id", empId).order("start_date", { ascending: false })),
    ]);
    return { priv: (p as EmployeePrivate | null) ?? undefined, leaves: l as LeaveRequest[] };
  }, [empId]);

  const e = employees.find((x) => x.id === empId);
  const approved = (data?.leaves ?? []).filter((l) => l.status === "approved");
  const leave = approved.find((l) => l.id === leaveId) ?? approved[0];
  const leftDays = Math.max(0, settings.annual_leave - paidUsed(data?.leaves ?? [], empId, Number(o.end.slice(0, 4))));
  const html = e ? render(tpl, e, data?.priv, settings, { ...o, leave, leftDays }, e.position ?? "", dept(e.department_id)?.name ?? "") : "";

  function word() {
    const body = html.replace(/<div class="meta"><span>(.*?)<\/span><span>(.*?)<\/span><\/div>/, '<table style="width:100%"><tr><td>$1</td><td style="text-align:right">$2</td></tr></table>');
    const doc = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word"><head><meta charset="utf-8"><style>body{font-family:Sylfaen,"Noto Serif Georgian",serif;font-size:12pt;line-height:1.5}h3,.c{text-align:center}h3{font-size:14pt;margin:0}h4{font-size:12pt;margin:12pt 0 4pt}.gap{background:yellow}table{width:100%}td{vertical-align:top}</style></head><body>${body}</body></html>`;
    saveFile(`${t(`tpl.${tpl}`)} - ${e?.full_name ?? ""}.doc`, "﻿" + doc, "application/msword");
  }

  async function copy() {
    const text = paper.current?.innerText ?? "";
    try {
      await navigator.clipboard.writeText(text);
      toast(t("docs.copied"));
    } catch {
      toast(t("docs.copyFailed"), true);
    }
  }

  const set = (k: keyof typeof o) => (ev: React.ChangeEvent<HTMLInputElement>) => setO((x) => ({ ...x, [k]: ev.target.value }));

  return (
    <>
      <PageHead title={t("nav.documents")} sub={t("docs.sub")}>
        <button className="btn" onClick={copy} disabled={!e}><Icon name="copy" size={16} /> {t("docs.copy")}</button>
        <button className="btn primary" onClick={word} disabled={!e}><Icon name="download" size={16} /> {t("docs.word")}</button>
      </PageHead>
      {!e ? <div className="card"><Empty>{t("people.empty")}</Empty></div> : (
        <div className="docs">
          <div className="stack">
            {TPLS.map((k) => (
              <button key={k} className="tpl-btn" aria-pressed={tpl === k} onClick={() => setTpl(k)}>
                <b>{t(`tpl.${k}`)}</b><span>{t(`tpl.${k}.d`)}</span>
              </button>
            ))}
            <div className="card card-body stack">
              <Field label={t("common.employee")}>
                <select value={empId} onChange={(ev) => setEmpId(ev.target.value)}>{sorted.map((x) => <option key={x.id} value={x.id}>{x.full_name}</option>)}</select>
              </Field>
              <div className="form-grid">
                <Field label={t("docs.number")}><input value={o.no} onChange={set("no")} placeholder="15" /></Field>
                <Field label={t("docs.date")}><input type="date" value={o.date} onChange={set("date")} /></Field>
              </div>
              {tpl === "contract" && <Field label={t("docs.term")} hint={t("docs.termHint")}><input type="date" value={o.term} onChange={set("term")} /></Field>}
              {tpl === "leave" && (
                <Field label={t("nav.timeoff")}>
                  <select value={leave?.id ?? ""} onChange={(ev) => setLeaveId(ev.target.value)}>
                    {approved.length ? approved.map((l) => <option key={l.id} value={l.id}>{l.start_date} – {l.end_date} · {t(`leave.t.${l.type}`)}</option>) : <option value="">{t("docs.noLeave")}</option>}
                  </select>
                </Field>
              )}
              {tpl === "fire" && <>
                <Field label={t("docs.endDate")}><input type="date" value={o.end} onChange={set("end")} /></Field>
                <Field label={t("docs.basis")}><input value={o.basis} onChange={set("basis")} /></Field>
              </>}
              {tpl === "cert" && <Field label={t("docs.purpose")}><input value={o.purpose} onChange={set("purpose")} placeholder="ბანკში" /></Field>}
              <p className="small faint">{t("docs.disclaimer")}</p>
            </div>
          </div>
          <div className="paper" ref={paper} dangerouslySetInnerHTML={{ __html: html }} />
        </div>
      )}
    </>
  );
}
