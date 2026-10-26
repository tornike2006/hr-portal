import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useT } from "../i18n";
import { useSession } from "../lib/session";
import { useQuery } from "../lib/useQuery";
import { errMsg, must, supabase } from "../lib/supabase";
import type { Channel, ChannelMember, Message } from "../lib/types";
import { Avatar, ConfirmButton, Empty, Field, Modal, useToast } from "../components/ui";
import { Icon } from "../components/Icon";

export function Chat() {
  const { channelId } = useParams();
  const nav = useNavigate();
  const { t } = useT();
  const toast = useToast();
  const { session, employees, empByUser, profiles, isHR } = useSession();
  const uid = session!.user.id;
  const [creating, setCreating] = useState(false);
  const [dmPick, setDmPick] = useState(false);

  const { data, reload } = useQuery(async () => {
    const chans = (await must(supabase.from("channels").select("*").order("created_at"))) as Channel[];
    const dmIds = chans.filter((c) => c.kind === "dm").map((c) => c.id);
    const members = dmIds.length ? ((await must(supabase.from("channel_members").select("*").in("channel_id", dmIds))) as ChannelMember[]) : [];
    return { chans, members };
  }, []);

  const chans = data?.chans ?? [];
  const publics = chans.filter((c) => c.kind === "public");
  const dms = chans.filter((c) => c.kind === "dm");
  const otherOf = (c: Channel) => data?.members.find((m) => m.channel_id === c.id && m.user_id !== uid)?.user_id;
  const nameOfUser = (u?: string | null) => (u ? empByUser(u)?.full_name ?? profiles.find((p) => p.id === u)?.email ?? "?" : "?");
  const title = (c: Channel) => (c.kind === "dm" ? nameOfUser(otherOf(c)) : `# ${c.name}`);

  const active = chans.find((c) => c.id === channelId) ?? (channelId ? undefined : publics[0]);

  const { reload: reloadSession } = useSession();
  const triedDir = useRef(false);
  useEffect(() => {
    if (triedDir.current || !data) return;
    if (data.members.some((m) => m.user_id !== uid && !empByUser(m.user_id) && !profiles.some((p) => p.id === m.user_id))) {
      triedDir.current = true;
      reloadSession();
    }
  }, [data, uid, empByUser, profiles, reloadSession]);

  useEffect(() => {
    if (!channelId && publics[0] && window.matchMedia("(min-width: 821px)").matches) nav(`/chat/${publics[0].id}`, { replace: true });
  }, [channelId, publics, nav]);

  // A newly created DM may not be in the list yet.
  useEffect(() => {
    if (channelId && data && !chans.some((c) => c.id === channelId)) reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channelId]);

  async function startDm(otherUser: string) {
    try {
      const c = await must(supabase.rpc("get_or_create_dm", { p_other: otherUser }));
      setDmPick(false);
      await reload();
      nav(`/chat/${c}`);
    } catch (e) {
      toast(errMsg(e), true);
    }
  }

  return (
    <>
      <section className={"card chat" + (channelId ? " has-active" : "")}>
        <nav className="chat-list" aria-label={t("chat.channels")}>
          <h3>{t("chat.channels")} <button className="btn ghost icon sm" onClick={() => setCreating(true)} aria-label={t("chat.newChannel")}><Icon name="plus" size={15} /></button></h3>
          {publics.map((c) => (
            <button key={c.id} className="ch" aria-current={active?.id === c.id} onClick={() => nav(`/chat/${c.id}`)}>
              <span className="hash">#</span>{c.name}
            </button>
          ))}
          <h3>{t("chat.direct")} <button className="btn ghost icon sm" onClick={() => setDmPick(true)} aria-label={t("chat.newDm")}><Icon name="plus" size={15} /></button></h3>
          {dms.map((c) => {
            const o = otherOf(c);
            return (
              <button key={c.id} className="ch" aria-current={active?.id === c.id} onClick={() => nav(`/chat/${c.id}`)}>
                <Avatar emp={empByUser(o)} name={nameOfUser(o)} size={28} />{nameOfUser(o)}
              </button>
            );
          })}
          {!dms.length && <p className="small faint" style={{ padding: "4px 16px" }}>{t("chat.noDms")}</p>}
        </nav>
        {active ? (
          <Thread key={active.id} channel={active} title={title(active)} nameOfUser={nameOfUser} canDelete={active.kind === "public" && (isHR || active.created_by === uid)} onDeleted={() => { reload(); nav("/chat"); }} />
        ) : (
          <div className="chat-main"><Empty>{t("chat.pick")}</Empty></div>
        )}
      </section>

      {creating && <NewChannel onClose={() => setCreating(false)} onCreated={async (id) => { setCreating(false); await reload(); nav(`/chat/${id}`); }} />}
      {dmPick && (
        <Modal title={t("chat.newDm")} onClose={() => setDmPick(false)}>
          <div className="list">
            {employees.filter((e) => e.user_id && e.user_id !== uid && e.status !== "inactive").map((e) => (
              <button key={e.id} className="item btn ghost" style={{ justifyContent: "flex-start", width: "100%", color: "inherit" }} onClick={() => startDm(e.user_id!)}>
                <Avatar emp={e} size={30} /> <span className="grow" style={{ textAlign: "left" }}><b>{e.full_name}</b><span>{e.position}</span></span>
              </button>
            ))}
          </div>
          <p className="small faint">{t("chat.dmHint")}</p>
        </Modal>
      )}
    </>
  );
}

function Thread({ channel, title, nameOfUser, canDelete, onDeleted }: { channel: Channel; title: string; nameOfUser: (u: string) => string; canDelete: boolean; onDeleted: () => void }) {
  const { t, df, locale } = useT();
  const toast = useToast();
  const nav = useNavigate();
  const { session, empByUser, profiles, reload } = useSession();
  const uid = session!.user.id;
  const [msgs, setMsgs] = useState<Message[]>([]);
  const triedReload = useRef(new Set<string>());
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const stick = useRef(true);

  useEffect(() => {
    let alive = true;
    supabase.from("messages").select("*").eq("channel_id", channel.id).order("created_at", { ascending: false }).limit(200).then(({ data }) => {
      if (alive) setMsgs(((data as Message[]) ?? []).reverse());
    });
    const sub = supabase
      .channel(`room-${channel.id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages", filter: `channel_id=eq.${channel.id}` }, (p) => {
        const m = p.new as Message;
        setMsgs((xs) => (xs.some((x) => x.id === m.id) ? xs : [...xs, m]));
      })
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "messages" }, (p) => {
        const id = (p.old as { id: string }).id;
        setMsgs((xs) => xs.filter((x) => x.id !== id));
      })
      .subscribe();
    if (channel.kind === "dm") supabase.from("channel_members").update({ last_read_at: new Date().toISOString() }).eq("channel_id", channel.id).eq("user_id", uid).then(() => {});
    return () => {
      alive = false;
      supabase.removeChannel(sub);
    };
  }, [channel.id, channel.kind, uid]);

  useEffect(() => {
    const el = box.current;
    if (el && stick.current) el.scrollTop = el.scrollHeight;
  }, [msgs]);

  // A colleague who signed up after this page loaded isn't in the cached directory yet: refresh it once.
  useEffect(() => {
    const unknown = msgs.map((m) => m.sender_id).filter((s) => !empByUser(s) && !profiles.some((p) => p.id === s) && !triedReload.current.has(s));
    if (!unknown.length) return;
    unknown.forEach((s) => triedReload.current.add(s));
    reload();
  }, [msgs, empByUser, profiles, reload]);

  async function send() {
    const body = text.trim();
    if (!body || sending) return;
    setSending(true);
    try {
      const m = await must(supabase.from("messages").insert({ channel_id: channel.id, body }).select().single());
      setMsgs((xs) => (xs.some((x) => x.id === (m as Message).id) ? xs : [...xs, m as Message]));
      setText("");
      stick.current = true;
    } catch (e) {
      toast(errMsg(e), true);
    } finally {
      setSending(false);
    }
  }

  async function del(id: string) {
    const { error } = await supabase.from("messages").delete().eq("id", id);
    if (error) toast(errMsg(error), true);
    else setMsgs((xs) => xs.filter((x) => x.id !== id));
  }

  async function deleteChannel() {
    const { error } = await supabase.from("channels").delete().eq("id", channel.id);
    if (error) toast(errMsg(error), true);
    else onDeleted();
  }

  const groups = useMemo(() => {
    const out: { m: Message; cont: boolean; day?: string }[] = [];
    let prev: Message | undefined;
    for (const m of msgs) {
      const day = new Date(m.created_at).toDateString();
      const newDay = !prev || new Date(prev.created_at).toDateString() !== day;
      const cont = !!prev && !newDay && prev.sender_id === m.sender_id && +new Date(m.created_at) - +new Date(prev.created_at) < 5 * 60e3;
      out.push({ m, cont, day: newDay ? df(m.created_at, "wdm") : undefined });
      prev = m;
    }
    return out;
  }, [msgs, locale]);

  return (
    <div className="chat-main">
      <div className="chat-head">
        <button className="btn ghost icon menu-btn" onClick={() => nav("/chat")} aria-label={t("common.back")}><Icon name="back" /></button>
        <h2 className="grow">{title}</h2>
        {canDelete && <ConfirmButton className="btn ghost sm danger" onConfirm={deleteChannel}>{t("chat.deleteChannel")}</ConfirmButton>}
      </div>
      <div className="msgs" ref={box} onScroll={(e) => { const el = e.currentTarget; stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80; }}>
        {!msgs.length && <Empty>{t("chat.first")}</Empty>}
        {groups.map(({ m, cont, day }) => (
          <div key={m.id}>
            {day && <div className="day-sep">{day}</div>}
            <div className={"msg" + (cont ? " cont" : "")}>
              <span className="avatar-slot" style={{ width: 36, flex: "none" }}>{!cont && <Avatar emp={empByUser(m.sender_id)} name={nameOfUser(m.sender_id)} size={36} />}</span>
              <div className="body grow">
                {!cont && <div className="who">{nameOfUser(m.sender_id)}<span className="when">{df(m.created_at, "time")}</span></div>}
                <div className="txt">{m.body}</div>
              </div>
              {m.sender_id === uid && <button className="btn ghost icon sm" onClick={() => del(m.id)} aria-label={t("common.delete")} title={t("common.delete")}><Icon name="trash" size={14} /></button>}
            </div>
          </div>
        ))}
      </div>
      <form className="composer" onSubmit={(e) => { e.preventDefault(); send(); }}>
        <textarea
          rows={1}
          value={text}
          placeholder={t("chat.placeholder", { name: title })}
          aria-label={t("chat.placeholder", { name: title })}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); send(); } }}
        />
        <button className="btn primary" disabled={!text.trim() || sending} aria-label={t("chat.send")}><Icon name="send" size={16} /></button>
      </form>
    </div>
  );
}

function NewChannel({ onClose, onCreated }: { onClose: () => void; onCreated: (id: string) => void }) {
  const { t } = useT();
  const [name, setName] = useState("");
  const [err, setErr] = useState("");
  async function create() {
    const n = name.trim().replace(/^#/, "");
    if (!n) return;
    try {
      const c = await must(supabase.from("channels").insert({ name: n, kind: "public" }).select().single());
      onCreated((c as Channel).id);
    } catch (e) {
      setErr(errMsg(e));
    }
  }
  return (
    <Modal title={t("chat.newChannel")} onClose={onClose} footer={<><button className="btn" onClick={onClose}>{t("common.cancel")}</button><button className="btn primary" onClick={create}>{t("common.create")}</button></>}>
      <Field label={t("chat.channelName")}><input value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && create()} placeholder={t("chat.channelPh")} /></Field>
      {err && <p className="error">{err}</p>}
    </Modal>
  );
}
