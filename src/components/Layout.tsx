import { useEffect, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { Icon, type IconName } from "./Icon";
import { Avatar } from "./ui";
import { useT, type Key } from "../i18n";
import { useSession } from "../lib/session";
import { supabase } from "../lib/supabase";

type Item = { to: string; icon: IconName; label: Key; hr?: boolean; badge?: number };

function useTheme(): [string, () => void] {
  const [theme, setTheme] = useState<string>(() => {
    try {
      return localStorage.getItem("theme") || "";
    } catch {
      return "";
    }
  });
  useEffect(() => {
    if (theme) document.documentElement.dataset.theme = theme;
    else delete document.documentElement.dataset.theme;
  }, [theme]);
  const dark = theme ? theme === "dark" : window.matchMedia("(prefers-color-scheme: dark)").matches;
  return [
    dark ? "dark" : "light",
    () => {
      const next = dark ? "light" : "dark";
      setTheme(next);
      try {
        localStorage.setItem("theme", next);
      } catch {
        /* storage unavailable */
      }
    },
  ];
}

export function Layout() {
  const { t, lang, setLang } = useT();
  const { isHR, isManager, me, profile, signOut, session } = useSession();
  const [open, setOpen] = useState(false);
  const [theme, toggleTheme] = useTheme();
  const [pending, setPending] = useState(0);
  const [unread, setUnread] = useState(0);
  const [q, setQ] = useState("");
  const loc = useLocation();
  const nav = useNavigate();

  useEffect(() => setOpen(false), [loc.pathname]);

  // Approvals waiting for this person (HR sees all; managers see their reports' — RLS filters).
  useEffect(() => {
    if (!isHR && !isManager) return;
    let q = supabase.from("leave_requests").select("id", { count: "exact", head: true }).eq("status", "pending");
    if (!isHR && me) q = q.neq("employee_id", me.id);
    q.then(({ count }) => setPending(count ?? 0));
  }, [isHR, isManager, me, loc.pathname]);

  // Unread chat badge: count messages from others that arrive while away from the chat page.
  useEffect(() => {
    if (loc.pathname.startsWith("/chat")) setUnread(0);
  }, [loc.pathname]);
  useEffect(() => {
    const uid = session?.user.id;
    if (!uid) return;
    const ch = supabase
      .channel("layout-unread")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, (p) => {
        const m = p.new as { sender_id: string };
        if (m.sender_id !== uid && !window.location.pathname.startsWith("/chat")) setUnread((n) => n + 1);
      })
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [session?.user.id]);

  const groups: { label: Key; items: Item[] }[] = [
    {
      label: "nav.g.workspace",
      items: [
        { to: "/", icon: "home", label: "nav.dashboard" },
        { to: "/chat", icon: "chat", label: "nav.chat", badge: unread },
        { to: "/announcements", icon: "megaphone", label: "nav.announcements" },
      ],
    },
    {
      label: "nav.g.people",
      items: [
        { to: "/people", icon: "users", label: "nav.people" },
        { to: "/org", icon: "org", label: "nav.org" },
        { to: "/time-off", icon: "plane", label: "nav.timeoff", badge: pending },
        { to: "/performance", icon: "target", label: "nav.performance" },
        { to: "/onboarding", icon: "rocket", label: "nav.onboarding" },
        ...(isHR ? [] : [{ to: "/recruiting", icon: "briefcase", label: "rec.openings" } as Item]),
      ],
    },
    {
      label: "nav.g.hr",
      items: [
        { to: "/recruiting", icon: "briefcase", label: "nav.recruiting", hr: true },
        { to: "/timesheet", icon: "grid", label: "nav.timesheet", hr: true },
        { to: "/payroll", icon: "money", label: "nav.payroll", hr: true },
        { to: "/documents", icon: "file", label: "nav.documents", hr: true },
        { to: "/settings", icon: "settings", label: "nav.settings", hr: true },
      ],
    },
  ];

  const name = me?.full_name ?? profile?.email ?? "";

  return (
    <div className="shell">
      {open && <div className="scrim" onClick={() => setOpen(false)} />}
      <aside className={"side" + (open ? " open" : "")} aria-label={t("nav.main")}>
        <div className="brand">
          <span className="brand-mark">კ</span>
          <span>
            <b>{t("app.name")}</b>
            <small>{t("app.tagline")}</small>
          </span>
        </div>
        {groups.map((g) => {
          const items = g.items.filter((i) => !i.hr || isHR);
          if (!items.length) return null;
          return (
            <div key={g.label}>
              <div className="side-group">{t(g.label)}</div>
              {items.map((i) => (
                <NavLink key={i.to} to={i.to} end={i.to === "/"}>
                  <Icon name={i.icon} />
                  {t(i.label)}
                  {!!i.badge && <span className="badge-count">{i.badge}</span>}
                </NavLink>
              ))}
            </div>
          );
        })}
        <div className="side-foot">
          <NavLink to={me ? `/people/${me.id}` : "/"} className="">
            <Avatar emp={me} name={name} size={28} />
            <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{name}</span>
          </NavLink>
        </div>
      </aside>

      <div className="main">
        <header className="topbar">
          <button className="btn ghost icon menu-btn" onClick={() => setOpen(true)} aria-label={t("nav.menu")}>
            <Icon name="menu" />
          </button>
          <form
            className="search"
            role="search"
            onSubmit={(e) => {
              e.preventDefault();
              nav(`/people?q=${encodeURIComponent(q)}`);
            }}
          >
            <Icon name="search" size={16} />
            <input type="search" placeholder={t("top.search")} value={q} onChange={(e) => setQ(e.target.value)} aria-label={t("top.search")} />
          </form>
          <span className="spacer" />
          <button className="btn ghost sm" onClick={() => setLang(lang === "ka" ? "en" : "ka")} aria-label={t("top.lang")}>
            <Icon name="globe" size={16} /> {lang === "ka" ? "EN" : "ქარ"}
          </button>
          <button className="btn ghost icon" onClick={toggleTheme} aria-label={t("top.theme")}>
            <Icon name={theme === "dark" ? "sun" : "moon"} />
          </button>
          <button className="btn ghost icon" onClick={signOut} aria-label={t("auth.signout")} title={t("auth.signout")}>
            <Icon name="logout" />
          </button>
        </header>
        <main className="content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
