import { iso } from "./dates";
import { must, supabase } from "./supabase";

// Default checklist for a new hire; offsets are days from the start date.
export const DEFAULT_TASKS: { ka: string; en: string; category: string; offset: number }[] = [
  { ka: "შრომითი ხელშეკრულების ხელმოწერა", en: "Sign the employment contract", category: "docs", offset: -1 },
  { ka: "პირადობის მოწმობის ასლი და საბანკო რეკვიზიტები", en: "ID copy and bank details", category: "docs", offset: 0 },
  { ka: "საპენსიო სქემაში რეგისტრაცია", en: "Pension scheme enrolment", category: "docs", offset: 3 },
  { ka: "სამუშაო ადგილისა და ტექნიკის მომზადება", en: "Prepare workstation and equipment", category: "it", offset: -1 },
  { ka: "ელ-ფოსტისა და სისტემების წვდომის შექმნა", en: "Create email and system accounts", category: "it", offset: 0 },
  { ka: "გაცნობა გუნდთან", en: "Meet the team", category: "team", offset: 0 },
  { ka: "შინაგანაწესის გაცნობა", en: "Read the internal regulations", category: "team", offset: 2 },
  { ka: "შეხვედრა ხელმძღვანელთან: პირველი თვის მიზნები", en: "1:1 with manager: first-month goals", category: "team", offset: 5 },
  { ka: "გამოსაცდელი ვადის შეფასება", en: "Probation review", category: "review", offset: 30 },
];

export async function createDefaultChecklist(employeeId: string, startDate: string | null, lang: "ka" | "en") {
  const base = startDate ? new Date(startDate) : new Date();
  const rows = DEFAULT_TASKS.map((x, i) => {
    const d = new Date(base);
    d.setDate(d.getDate() + x.offset);
    return { employee_id: employeeId, title: lang === "ka" ? x.ka : x.en, category: x.category, due_date: iso(d), sort: i };
  });
  await must(supabase.from("onboarding_tasks").insert(rows));
}
