import { useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useT } from "../i18n";
import { useSession } from "../lib/session";
import { useQuery } from "../lib/useQuery";
import { errMsg, must, supabase } from "../lib/supabase";
import { fmt } from "../lib/dates";
import { gel } from "../lib/payroll";
import { paidUsed, statusTone } from "../lib/leave";
import type { EmployeeDocument, EmployeePrivate, LeaveRequest } from "../lib/types";
import { Avatar, Badge, ConfirmButton, Empty, Field, Modal, Person, Spinner, useToast } from "../components/ui";
import { Icon } from "../components/Icon";
import { EmployeeModal } from "../components/EmployeeModal";
import { LeaveModal } from "../components/LeaveModal";

type Tab = "overview" | "timeoff" | "documents" | "private";

export function Profile() {
  const { id = "" } = useParams();
  const { t, df, locale } = useT();
  const toast = useToast();
  const nav = useNavigate();
  const { emp, dept, employees, isHR, me, settings, session } = useSession();
  const e = emp(id);
  const [tab, setTab] = useState<Tab>("overview");
  const [editing, setEditing] = useState(false);
  const [editSelf, setEditSelf] = useState(false);
  const [askLeave, setAskLeave] = useState(false);
  const isMe = me?.id === id;
  const canPrivate = isHR || isMe;

  const { data, reload } = useQuery(async () => {
    if (!id) return null;
    const [leaves, priv, docs] = await Promise.all([
      must(supabase.from("leave_requests").select("*").eq("employee_id", id).order("start_date", { ascending: false })),
      canPrivate ? must(supabase.from("employee_private").select("*").eq("employee_id", id).maybeSingle()) : Promise.resolve(null),
      canPrivate ? must(supabase.from("employee_documents").select("*").eq("employee_id", id).order("created_at", { ascending: false })) : Promise.resolve([]),
    ]);
    return { leaves: leaves as LeaveRequest[], priv: priv as EmployeePrivate | null, docs: docs as EmployeeDocument[] };
  }, [id, canPrivate]);

  if (!e) return employees.length ? <Empty>{t("common.notFound")}</Empty> : <Spinner />;

  const manager = emp(e.manager_id);
  const reports = employees.filter((x) => x.manager_id === e.id && x.status !== "inactive");
  const y = new Date().getFullYear();
  const used = paidUsed(data?.leaves ?? [], e.id, y);
  const tenure = e.start_date ? Math.max(0, Math.floor((Date.now() - new Date(e.start_date).getTime()) / (365.25 * 864e5))) : null;

  async function message() {
    if (!e?.user_id) return;
    try {
      const c = await must(supabase.rpc("get_or_create_dm", { p_other: e.user_id }));
      nav(`/chat/${c}`);
    } catch (err) {
      toast(errMsg(err), true);
    }
  }

  const tabs: [Tab, string][] = [["overview", t("profile.overview")], ["timeoff", t("nav.timeoff")]];
  if (canPrivate) tabs.push(["documents", t("profile.documents")], ["private", t("profile.private")]);

  return (
    <>
      <div><Link to="/people" className="btn ghost sm"><Icon name="back" size={16} /> {t("nav.people")}</Link></div>
      <section className="card">
        <div className="profile-hero">
          <Avatar emp={e} size={88} />
          <div className="grow stack" style={{ gap: 6 }}>
            <div className="row">
              <h1>{e.full_name}</h1>
              {e.status !== "active" && <Badge tone={e.status === "onboarding" ? "info" : "mute"}>{t(`emp.st.${e.status}`)}</Badge>}
            </div>
            <div className="meta">
              {e.position && <span>{e.position}</span>}
              {dept(e.department_id) && <span>{dept(e.department_id)!.name}</span>}
              {e.location && <span>{e.location}</span>}
              {tenure !== null && <span>{t("profile.tenure", { n: tenure })}</span>}
            </div>
          </div>
          <div className="row">
            {e.user_id && e.user_id !== session?.user.id && <button className="btn" onClick={message}><Icon name="chat" size={16} /> {t("profile.message")}</button>}
            {isMe && <button className="btn" onClick={() => setEditSelf(true)}><Icon name="edit" size={16} /> {t("profile.editMine")}</button>}
            {isHR && <button className="btn primary" onClick={() => setEditing(true)}><Icon name="edit" size={16} /> {t("common.edit")}</button>}
          </div>
        </div>
        <div className="tabs" role="tablist" style={{ padding: "0 14px" }}>
          {tabs.map(([k, label]) => <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)}>{label}</button>)}
        </div>
      </section>

      {tab === "overview" && (
        <div className="grid cols-2">
          <section className="card">
            <div className="card-head"><h2>{t("profile.contact")}</h2></div>
            <dl className="kv card-body">
              <dt>{t("emp.email")}</dt><dd>{e.email ? <a href={`mailto:${e.email}`}>{e.email}</a> : "—"}</dd>
              <dt>{t("emp.phone")}</dt><dd>{e.phone ? <a href={`tel:${e.phone}`}>{e.phone}</a> : "—"}</dd>
              <dt>{t("emp.location")}</dt><dd>{e.location || "—"}</dd>
              <dt>{t("emp.birth")}</dt><dd>{e.birth_date ? df(e.birth_date, "dm") : "—"}</dd>
            </dl>
            {e.bio && <p className="card-body" style={{ paddingTop: 0, whiteSpace: "pre-wrap" }}>{e.bio}</p>}
          </section>
          <section className="card">
            <div className="card-head"><h2>{t("profile.job")}</h2></div>
            <dl className="kv card-body">
              <dt>{t("emp.position")}</dt><dd>{e.position || "—"}</dd>
              <dt>{t("emp.department")}</dt><dd>{dept(e.department_id)?.name ?? "—"}</dd>
              <dt>{t("emp.start")}</dt><dd>{fmt(e.start_date)}</dd>
              <dt>{t("emp.manager")}</dt><dd>{manager ? <Person emp={manager} size={28} /> : "—"}</dd>
            </dl>
          </section>
          {reports.length > 0 && (
            <section className="card">
              <div className="card-head"><h2>{t("profile.reports", { n: reports.length })}</h2></div>
              <div className="list">{reports.map((r) => <div className="item" key={r.id}><Person emp={r} size={30} /></div>)}</div>
            </section>
          )}
        </div>
      )}

      {tab === "timeoff" && (
        <section className="card">
          <div className="card-head">
            <h2>{t("profile.leaveBalance", { used, total: settings.annual_leave, y })}</h2>
            {(isMe || isHR) && <button className="btn primary sm" onClick={() => setAskLeave(true)}>{t("leave.request")}</button>}
          </div>
          <div className="list">
            {data?.leaves.length ? data.leaves.map((l) => (
              <div className="item" key={l.id}>
                <div className="grow"><b>{t(`leave.t.${l.type}`)}</b><span>{fmt(l.start_date)} – {fmt(l.end_date)} · {t("leave.daysShort", { n: l.days })}{l.note ? ` · ${l.note}` : ""}</span></div>
                <Badge tone={statusTone(l.status)}>{t(`leave.s.${l.status}`)}</Badge>
              </div>
            )) : <Empty>{t("leave.none")}</Empty>}
          </div>
        </section>
      )}

      {tab === "documents" && canPrivate && <DocumentsTab employeeId={e.id} docs={data?.docs ?? []} onChange={reload} />}

      {tab === "private" && canPrivate && (
        <section className="card">
          <div className="card-head"><h2>{t("profile.private")}</h2><span className="small faint">{t("profile.privateHint")}</span></div>
          <dl className="kv card-body">
            <dt>{t("emp.salary")}</dt><dd>{data?.priv ? gel(Number(data.priv.salary), locale) : "—"}</dd>
            <dt>{t("emp.pension")}</dt><dd>{data?.priv ? (data.priv.pension ? t("common.yes") : t("common.no")) : "—"}</dd>
            <dt>{t("emp.pid")}</dt><dd>{data?.priv?.personal_id || "—"}</dd>
            <dt>{t("emp.address")}</dt><dd>{data?.priv?.address || "—"}</dd>
            <dt>{t("emp.bank")}</dt><dd>{data?.priv?.bank_account || "—"}</dd>
            <dt>{t("emp.emergency")}</dt><dd>{data?.priv?.emergency_contact || "—"}</dd>
          </dl>
        </section>
      )}

      {editing && <EmployeeModal employee={e} onClose={() => setEditing(false)} onSaved={() => reload()} />}
      {editSelf && <EditSelfModal onClose={() => setEditSelf(false)} />}
      {askLeave && <LeaveModal leaves={data?.leaves ?? []} employeeId={e.id} onClose={() => setAskLeave(false)} onSaved={reload} />}
    </>
  );
}

function DocumentsTab({ employeeId, docs, onChange }: { employeeId: string; docs: EmployeeDocument[]; onChange: () => void }) {
  const { t } = useT();
  const toast = useToast();
  const { isHR } = useSession();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  async function upload(file: File) {
    setBusy(true);
    try {
      const path = `${employeeId}/${Date.now()}-${file.name.replace(/[^\w.\-]+/g, "_")}`;
      const { error } = await supabase.storage.from("documents").upload(path, file);
      if (error) throw error;
      await must(supabase.from("employee_documents").insert({ employee_id: employeeId, name: file.name, storage_path: path }));
      toast(t("docs.uploaded"));
      onChange();
    } catch (e) {
      toast(errMsg(e), true);
    } finally {
      setBusy(false);
    }
  }

  async function open(d: EmployeeDocument) {
    const { data, error } = await supabase.storage.from("documents").createSignedUrl(d.storage_path, 60);
    if (error || !data) return toast(errMsg(error), true);
    window.open(data.signedUrl, "_blank", "noopener");
  }

  async function remove(d: EmployeeDocument) {
    try {
      await supabase.storage.from("documents").remove([d.storage_path]);
      await must(supabase.from("employee_documents").delete().eq("id", d.id));
      onChange();
    } catch (e) {
      toast(errMsg(e), true);
    }
  }

  return (
    <section className="card">
      <div className="card-head">
        <h2>{t("profile.documents")}</h2>
        {isHR && (
          <>
            <input ref={input} type="file" hidden onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
            <button className="btn sm" disabled={busy} onClick={() => input.current?.click()}><Icon name="upload" size={15} /> {t("docs.upload")}</button>
          </>
        )}
      </div>
      <div className="list">
        {docs.length ? docs.map((d) => (
          <div className="item" key={d.id}>
            <Icon name="file" />
            <div className="grow"><b>{d.name}</b><span>{fmt(d.created_at)}</span></div>
            <button className="btn sm" onClick={() => open(d)}><Icon name="download" size={15} /> {t("docs.open")}</button>
            {isHR && <ConfirmButton className="btn sm danger" onConfirm={() => remove(d)}>{t("common.delete")}</ConfirmButton>}
          </div>
        )) : <Empty>{t("docs.none")}</Empty>}
      </div>
    </section>
  );
}

function EditSelfModal({ onClose }: { onClose: () => void }) {
  const { t } = useT();
  const toast = useToast();
  const { me, reload } = useSession();
  const [phone, setPhone] = useState(me?.phone ?? "");
  const [bio, setBio] = useState(me?.bio ?? "");
  const [location, setLocation] = useState(me?.location ?? "");
  const [avatar, setAvatar] = useState(me?.avatar_url ?? "");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function pickPhoto(file: File) {
    if (!me) return;
    if (file.size > 3 * 1024 * 1024) return setErr(t("profile.photoTooBig"));
    setBusy(true);
    try {
      const path = `${me.id}/${Date.now()}.${file.name.split(".").pop() || "jpg"}`;
      const { error } = await supabase.storage.from("avatars").upload(path, file, { upsert: true });
      if (error) throw error;
      setAvatar(supabase.storage.from("avatars").getPublicUrl(path).data.publicUrl);
    } catch (e) {
      setErr(errMsg(e));
    } finally {
      setBusy(false);
    }
  }

  async function save() {
    setBusy(true);
    try {
      await must(supabase.rpc("update_my_profile", { p_phone: phone || null, p_bio: bio || null, p_location: location || null, p_avatar_url: avatar || null }));
      await reload();
      toast(t("common.saved"));
      onClose();
    } catch (e) {
      setErr(errMsg(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title={t("profile.editMine")} onClose={onClose} footer={<><button className="btn" onClick={onClose}>{t("common.cancel")}</button><button className="btn primary" disabled={busy} onClick={save}>{t("common.save")}</button></>}>
      <div className="row">
        <Avatar emp={me ? { ...me, avatar_url: avatar || null } : null} size={64} />
        <label className="btn sm">
          <Icon name="upload" size={15} /> {t("profile.photo")}
          <input type="file" accept="image/*" hidden onChange={(e) => e.target.files?.[0] && pickPhoto(e.target.files[0])} />
        </label>
      </div>
      <Field label={t("emp.phone")}><input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} /></Field>
      <Field label={t("emp.location")}><input value={location} onChange={(e) => setLocation(e.target.value)} /></Field>
      <Field label={t("profile.bio")}><textarea value={bio} onChange={(e) => setBio(e.target.value)} /></Field>
      {err && <p className="error">{err}</p>}
    </Modal>
  );
}
