import { useState } from "react";
import { useT } from "../i18n";
import { useSession } from "../lib/session";
import { useQuery } from "../lib/useQuery";
import { errMsg, must, supabase } from "../lib/supabase";
import type { Announcement } from "../lib/types";
import { Avatar, Badge, ConfirmButton, Empty, Field, Modal, PageHead, useToast } from "../components/ui";
import { Icon } from "../components/Icon";

export function Announcements() {
  const { t, df } = useT();
  const toast = useToast();
  const { isHR, empByUser, profiles } = useSession();
  const [edit, setEdit] = useState<Announcement | "new" | null>(null);
  const { data, reload } = useQuery(
    async () => (await must(supabase.from("announcements").select("*").order("pinned", { ascending: false }).order("created_at", { ascending: false }))) as Announcement[],
    [],
  );

  async function remove(id: string) {
    try {
      await must(supabase.from("announcements").delete().eq("id", id));
      reload();
    } catch (e) {
      toast(errMsg(e), true);
    }
  }

  return (
    <>
      <PageHead title={t("nav.announcements")} sub={t("news.sub")}>
        {isHR && <button className="btn primary" onClick={() => setEdit("new")}><Icon name="plus" size={16} /> {t("news.new")}</button>}
      </PageHead>
      <section className="card">
        <div className="list">
          {data?.length ? data.map((a) => {
            const author = empByUser(a.author_id);
            return (
              <article className="announce" key={a.id}>
                <div className="row between">
                  <h2>{a.title}</h2>
                  <div className="row">
                    {a.pinned && <Badge tone="accent">{t("news.pinned")}</Badge>}
                    {isHR && <button className="btn ghost sm" onClick={() => setEdit(a)}>{t("common.edit")}</button>}
                    {isHR && <ConfirmButton className="btn ghost sm danger" onConfirm={() => remove(a.id)}>{t("common.delete")}</ConfirmButton>}
                  </div>
                </div>
                <p className="txt">{a.body}</p>
                <div className="row small faint">
                  <Avatar emp={author} name={author?.full_name ?? profiles.find((p) => p.id === a.author_id)?.email ?? "HR"} size={22} />
                  {author?.full_name ?? "HR"} · {df(a.created_at, "dmy")}
                </div>
              </article>
            );
          }) : <Empty>{t("news.empty")}</Empty>}
        </div>
      </section>
      {edit && <AnnouncementModal item={edit === "new" ? undefined : edit} onClose={() => setEdit(null)} onSaved={reload} />}
    </>
  );
}

function AnnouncementModal({ item, onClose, onSaved }: { item?: Announcement; onClose: () => void; onSaved: () => void }) {
  const { t } = useT();
  const toast = useToast();
  const [title, setTitle] = useState(item?.title ?? "");
  const [body, setBody] = useState(item?.body ?? "");
  const [pinned, setPinned] = useState(item?.pinned ?? false);
  const [err, setErr] = useState("");

  async function save() {
    if (!title.trim()) return setErr(t("news.errTitle"));
    try {
      const row = { title: title.trim(), body: body.trim(), pinned };
      if (item) await must(supabase.from("announcements").update(row).eq("id", item.id));
      else await must(supabase.from("announcements").insert(row));
      toast(t("news.published"));
      onSaved();
      onClose();
    } catch (e) {
      setErr(errMsg(e));
    }
  }

  return (
    <Modal title={item ? t("common.edit") : t("news.new")} onClose={onClose} footer={<><button className="btn" onClick={onClose}>{t("common.cancel")}</button><button className="btn primary" onClick={save}>{t("news.publish")}</button></>}>
      <Field label={t("news.title")}><input value={title} onChange={(e) => setTitle(e.target.value)} /></Field>
      <Field label={t("news.body")}><textarea rows={8} value={body} onChange={(e) => setBody(e.target.value)} /></Field>
      <label className="check"><input type="checkbox" checked={pinned} onChange={(e) => setPinned(e.target.checked)} /> {t("news.pin")}</label>
      {err && <p className="error">{err}</p>}
    </Modal>
  );
}
