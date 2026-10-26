import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "./supabase";
import type { Department, Employee, Profile, Settings } from "./types";

const DEFAULT_SETTINGS: Settings = {
  company: "", company_code: "", address: "", city: "თბილისი", director: "", six_day_week: false, annual_leave: 24,
};

interface Ctx {
  session: Session | null;
  loading: boolean;
  profile: Profile | null;
  me: Employee | null;
  isHR: boolean;
  isAdmin: boolean;
  isMember: boolean;
  isManager: boolean;
  settings: Settings;
  employees: Employee[];
  departments: Department[];
  profiles: Profile[];
  emp: (id: string | null | undefined) => Employee | undefined;
  empByUser: (uid: string | null | undefined) => Employee | undefined;
  dept: (id: string | null | undefined) => Department | undefined;
  reload: () => Promise<void>;
  signOut: () => Promise<void>;
}

const SessionCtx = createContext<Ctx | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [dataReady, setDataReady] = useState(false);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setAuthReady(true);
    });
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => data.subscription.unsubscribe();
  }, []);

  const uid = session?.user.id;

  const reload = useCallback(async () => {
    if (!uid) {
      setProfile(null);
      setEmployees([]);
      setDataReady(true);
      return;
    }
    const [p, s, e, d, ps] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", uid).maybeSingle(),
      supabase.from("company_settings").select("*").eq("id", 1).maybeSingle(),
      supabase.from("employees").select("*").order("full_name"),
      supabase.from("departments").select("*").order("name"),
      supabase.from("profiles").select("*"),
    ]);
    setProfile((p.data as Profile) ?? null);
    if (s.data) setSettings({ ...DEFAULT_SETTINGS, ...(s.data as Settings) });
    setEmployees((e.data as Employee[]) ?? []);
    setDepartments((d.data as Department[]) ?? []);
    setProfiles((ps.data as Profile[]) ?? []);
    setDataReady(true);
  }, [uid]);

  useEffect(() => {
    setDataReady(false);
    reload();
  }, [reload]);

  const value = useMemo<Ctx>(() => {
    const byId = new Map(employees.map((e) => [e.id, e]));
    const byUser = new Map(employees.filter((e) => e.user_id).map((e) => [e.user_id as string, e]));
    const deptById = new Map(departments.map((d) => [d.id, d]));
    const me = profile?.employee_id ? byId.get(profile.employee_id) ?? null : null;
    const isHR = profile?.role === "admin" || profile?.role === "hr";
    return {
      session,
      loading: !authReady || (Boolean(uid) && !dataReady),
      profile,
      me,
      isHR,
      isAdmin: profile?.role === "admin",
      isMember: isHR || Boolean(profile?.employee_id),
      isManager: Boolean(me && employees.some((e) => e.manager_id === me.id)),
      settings,
      employees,
      departments,
      profiles,
      emp: (id) => (id ? byId.get(id) : undefined),
      empByUser: (u) => (u ? byUser.get(u) : undefined),
      dept: (id) => (id ? deptById.get(id) : undefined),
      reload,
      signOut: async () => {
        await supabase.auth.signOut();
      },
    };
  }, [session, authReady, uid, dataReady, profile, settings, employees, departments, profiles, reload]);

  return <SessionCtx.Provider value={value}>{children}</SessionCtx.Provider>;
}

export function useSession(): Ctx {
  const c = useContext(SessionCtx);
  if (!c) throw new Error("useSession outside provider");
  return c;
}
