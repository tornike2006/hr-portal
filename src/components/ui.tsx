import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { Icon } from "./Icon";
import { useT } from "../i18n";
import type { Employee } from "../lib/types";
import { useSession } from "../lib/session";

/* ---------- toasts ---------- */
type Toast = { id: number; text: string; err?: boolean };
const ToastCtx = createContext<(text: string, err?: boolean) => void>(() => {});
export const useToast = () => useContext(ToastCtx);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<Toast[]>([]);
  const push = useCallback((text: string, err?: boolean) => {
    const id = Date.now() + Math.random();
    setItems((xs) => [...xs, { id, text, err }]);
    setTimeout(() => setItems((xs) => xs.filter((x) => x.id !== id)), err ? 5000 : 2800);
  }, []);
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="toasts" role="status" aria-live="polite">
        {items.map((t) => (
          <div key={t.id} className={"toast" + (t.err ? " err" : "")}>{t.text}</div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

/* ---------- modal ---------- */
export function Modal({ title, onClose, children, footer, wide }: { title: string; onClose: () => void; children: ReactNode; footer?: ReactNode; wide?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const { t } = useT();
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    const first = ref.current?.querySelector<HTMLElement>("input, select, textarea, button:not(.modal-x)");
    first?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      prev?.focus?.();
    };
  }, [onClose]);
  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={"modal" + (wide ? " wide" : "")} role="dialog" aria-modal="true" aria-label={title} ref={ref}>
        <div className="modal-head">
          <h2>{title}</h2>
          <button className="btn ghost icon modal-x" onClick={onClose} aria-label={t("common.close")}>
            <Icon name="x" />
          </button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>
  );
}

/* ---------- small pieces ---------- */
export function Field({ label, hint, children, wide }: { label: string; hint?: string; children: ReactNode; wide?: boolean }) {
  return (
    <label className={"field" + (wide ? " wide" : "")}>
      <span>{label}</span>
      {children}
      {hint && <small className="hint">{hint}</small>}
    </label>
  );
}

export function Empty({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="empty">
      <p>{children}</p>
      {action}
    </div>
  );
}

export function Spinner() {
  return (
    <div className="center">
      <div className="spinner" aria-label="loading" />
    </div>
  );
}

export function Badge({ tone = "mute", children }: { tone?: "ok" | "warn" | "bad" | "info" | "mute" | "accent"; children: ReactNode }) {
  return <span className={`badge b-${tone}`}>{children}</span>;
}

/** Two-step destructive button: first click arms, second confirms. */
export function ConfirmButton({ onConfirm, children, confirmText, className = "btn danger", disabled }: { onConfirm: () => void | Promise<void>; children: ReactNode; confirmText?: string; className?: string; disabled?: boolean }) {
  const [armed, setArmed] = useState(false);
  const { t } = useT();
  useEffect(() => {
    if (!armed) return;
    const id = setTimeout(() => setArmed(false), 3500);
    return () => clearTimeout(id);
  }, [armed]);
  return (
    <button
      type="button"
      className={className + (armed ? " armed" : "")}
      disabled={disabled}
      onClick={() => {
        if (!armed) return setArmed(true);
        setArmed(false);
        onConfirm();
      }}
    >
      {armed ? confirmText ?? t("common.confirm") : children}
    </button>
  );
}

const initials = (name: string) =>
  name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]).join("").toUpperCase();

export function Avatar({ emp, name, size = 36 }: { emp?: Employee | null; name?: string; size?: number }) {
  const n = emp?.full_name ?? name ?? "?";
  return (
    <span className="avatar" style={{ width: size, height: size, fontSize: Math.round(size * 0.38) }}>
      {emp?.avatar_url ? <img src={emp.avatar_url} alt="" /> : initials(n)}
    </span>
  );
}

export function Person({ emp, sub, size = 36, link = true }: { emp?: Employee | null; sub?: ReactNode; size?: number; link?: boolean }) {
  const { dept } = useSession();
  if (!emp) return <span className="muted">—</span>;
  const inner = (
    <span className="person">
      <Avatar emp={emp} size={size} />
      <span style={{ minWidth: 0 }}>
        <span className="nm">{emp.full_name}</span>
        <span className="ps">{sub ?? [emp.position, dept(emp.department_id)?.name].filter(Boolean).join(" · ")}</span>
      </span>
    </span>
  );
  return link ? <Link to={`/people/${emp.id}`} style={{ color: "inherit", textDecoration: "none" }}>{inner}</Link> : inner;
}

export function Seg<T extends string>({ value, options, onChange }: { value: T; options: [T, string][]; onChange: (v: T) => void }) {
  return (
    <div className="seg" role="group">
      {options.map(([v, label]) => (
        <button key={v} type="button" aria-pressed={v === value} onClick={() => onChange(v)}>{label}</button>
      ))}
    </div>
  );
}

export function PageHead({ title, sub, children }: { title: string; sub?: ReactNode; children?: ReactNode }) {
  return (
    <div className="page-head">
      <div>
        <h1>{title}</h1>
        {sub && <p className="sub">{sub}</p>}
      </div>
      {children && <div className="row">{children}</div>}
    </div>
  );
}

export function Stars({ n }: { n: number | null | undefined }) {
  if (!n) return <span className="faint">—</span>;
  return <span className="stars" aria-label={`${n}/5`}>{"★".repeat(n)}{"☆".repeat(5 - n)}</span>;
}

const GEO_LATIN: Record<string, string> = {
  ა: "a", ბ: "b", გ: "g", დ: "d", ე: "e", ვ: "v", ზ: "z", თ: "t", ი: "i", კ: "k", ლ: "l", მ: "m", ნ: "n", ო: "o", პ: "p", ჟ: "zh", რ: "r",
  ს: "s", ტ: "t", უ: "u", ფ: "p", ქ: "k", ღ: "gh", ყ: "q", შ: "sh", ჩ: "ch", ც: "ts", ძ: "dz", წ: "ts", ჭ: "ch", ხ: "kh", ჯ: "j", ჰ: "h",
};

/** Browsers differ on non-ASCII download names, so file names are romanized (national system). */
export function asciiFileName(name: string): string {
  return [...name].map((c) => GEO_LATIN[c] ?? c).join("").replace(/[^\w.\- ]+/g, "").replace(/\s+/g, "-").replace(/-+/g, "-");
}

/** Saves a generated file in the browser. */
export function saveFile(name: string, data: BlobPart, type: string) {
  const url = URL.createObjectURL(new Blob([data], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = asciiFileName(name);
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
