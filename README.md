# კადრი — HR პორტალი

ქართული HR პორტალი კომპანიებისთვის: თანამშრომლები, სტრუქტურა, შვებულებები, ტაბელი, ხელფასი (საშემოსავლო 20%, საპენსიო 2%+2%), დოკუმენტების შაბლონები, ჩატი, განცხადებები, შეფასება და მიზნები, რეკრუტინგი და ონბორდინგი. ინტერფეისი ქართულად და ინგლისურად, ღია და მუქი თემით.

**ტექნოლოგია:** React + TypeScript (Vite) ინტერფეისისთვის და [Supabase](https://supabase.com) სერვერისთვის. Supabase უზრუნველყოფს ლოგინს, PostgreSQL ბაზას, ფაილების საცავს და რეალური დროის ჩატს.

---

## გაშვება ინტერნეტში: ნაბიჯ-ნაბიჯ (კოდის ცოდნა არ სჭირდება)

დაგჭირდებათ სამი უფასო ანგარიში: **Supabase**, **GitHub** და **Netlify**. დაახლოებით 20–30 წუთი.

### 1. Supabase: ბაზა და ლოგინი

1. შედით [supabase.com](https://supabase.com)-ზე და დააჭირეთ **Start your project**. დარეგისტრირდით GitHub-ით ან ელ-ფოსტით.
2. **New project**:
   - Name: `kadri`
   - Database Password: მოიფიქრეთ ძლიერი პაროლი და შეინახეთ
   - Region: **Central EU (Frankfurt)**, საქართველოსთან ყველაზე ახლოს
3. როცა პროექტი შეიქმნება (1–2 წუთი), მარცხენა მენიუში გახსენით **SQL Editor** → **New query**.
4. გახსენით ფაილი [`supabase/schema.sql`](supabase/schema.sql), დააკოპირეთ **მთელი** ტექსტი, ჩასვით და დააჭირეთ **Run**. უნდა გამოჩნდეს `Success. No rows returned`.
5. **Authentication → Sign In / Providers → Email**: გამორთეთ **Confirm email** და შეინახეთ.
   > რატომ: Supabase-ის უფასო ფოსტა საათში მხოლოდ რამდენიმე წერილს აგზავნის, ამიტომ თანამშრომლები დადასტურების წერილს ვერ მიიღებენ. უსაფრთხოებას ეს არ ამცირებს: პორტალში შესვლა მხოლოდ იმას შეუძლია, ვისი ელ-ფოსტაც HR-მა თანამშრომლების სიაში დაამატა. დანარჩენი ვერაფერს ხედავს.
6. **Project Settings → API** (ან **Data API**): დააკოპირეთ ორი მნიშვნელობა:
   - **Project URL** (მაგ. `https://abcdxyz.supabase.co`)
   - **anon public** key (გრძელი ტექსტი, იწყება `eyJ...`-ით)

### 2. GitHub: კოდის შენახვა

1. შედით [github.com](https://github.com)-ზე → **New repository** → სახელი `kadri-portal` → **Private** → **Create repository**.
2. **uploading an existing file** → გადმოათრიეთ ამ პროექტის ყველა ფაილი და საქაღალდე (`node_modules`-ისა და `dist`-ის გარდა) → **Commit changes**.

### 3. Netlify: საიტის გამოქვეყნება

1. შედით [netlify.com](https://netlify.com)-ზე GitHub ანგარიშით.
2. **Add new site → Import an existing project → GitHub** → აირჩიეთ `kadri-portal`.
3. Build settings ავტომატურად შეივსება (`npm run build`, `dist`).
4. **Environment variables → Add variable**, დაამატეთ ორი ცვლადი:
   | Key | Value |
   |---|---|
   | `VITE_SUPABASE_URL` | Project URL (ნაბიჯი 1.6) |
   | `VITE_SUPABASE_ANON_KEY` | anon public key (ნაბიჯი 1.6) |
5. **Deploy**. 1–2 წუთში მიიღებთ ბმულს, მაგ. `https://kadri-xyz.netlify.app`. **Site settings → Domain management**-ში შეგიძლიათ საკუთარი დომენი მიაბათ (მაგ. `hr.თქვენი-კომპანია.ge`).
6. დაბრუნდით Supabase-ში: **Authentication → URL Configuration**:
   - **Site URL**: თქვენი ბმული (მაგ. `https://kadri-xyz.netlify.app`)
   - **Redirect URLs**: `https://kadri-xyz.netlify.app/**`

   ეს საჭიროა, რომ პაროლის აღდგენის ბმულმა სწორ გვერდზე გადაიყვანოს.

### 4. პირველი შესვლა

1. გახსენით საიტი → **ანგარიშის შექმნა**. **პირველი დარეგისტრირებული მომხმარებელი ავტომატურად ხდება ადმინისტრატორი.**
2. **პარამეტრები**: შეავსეთ კომპანიის მონაცემები და დაამატეთ დეპარტამენტები.
3. **თანამშრომლები → თანამშრომლის დამატება**: თითოეულს მიუთითეთ **სამსახურის ელ-ფოსტა**.
4. თანამშრომლებს გაუგზავნეთ საიტის ბმული. ისინი დარეგისტრირდებიან **იმავე ელ-ფოსტით** და ავტომატურად დაუკავშირდებიან თავიანთ პროფილს.
5. HR კოლეგებს როლი მიეცით: **პარამეტრები → მომხმარებლები და როლები** → `HR`.

---

## ვინ რას ხედავს

| | თანამშრომელი | ხელმძღვანელი | HR / ადმინი |
|---|---|---|---|
| თანამშრომლების სია, სტრუქტურა, ჩატი, განცხადებები | ✓ | ✓ | ✓ |
| საკუთარი ხელფასი, პირადი ნომერი, დოკუმენტები | ✓ | ✓ | ✓ |
| სხვისი ხელფასი და პირადი მონაცემები | — | — | ✓ |
| შვებულების მოთხოვნა | ✓ | ✓ | ✓ |
| შვებულების დამტკიცება | — | თავისი გუნდის | ყველას |
| გუნდის მიზნები და შეფასება | — | თავისი გუნდის | ყველას |
| ტაბელი, ხელფასის უწყისი, დოკუმენტები, რეკრუტინგი | — | — | ✓ |
| როლების შეცვლა | — | — | მხოლოდ ადმინი |

ეს წესები მოწმდება სერვერზე, ბაზის დონეზე (PostgreSQL Row Level Security). ამიტომ მათ გვერდის ავლით ბრაუზერიდანაც ვერავინ გადალახავს. ხელმძღვანელის შეფასებას თანამშრომელი ციკლის დასრულებამდე ვერ ხედავს.

## ფასი

- **Supabase Free**: 500 MB ბაზა, 1 GB ფაილები, 50 000 მომხმარებელი. პატარა და საშუალო კომპანიისთვის საკმარისია. ⚠️ უფასო პროექტი ჩერდება, თუ 7 დღე არავინ გამოიყენებს (დაჭერით ისევ ირთვება). სერიოზული გამოყენებისთვის რეკომენდებულია **Pro ($25/თვე)**, რომელშიც შედის ყოველდღიური სარეზერვო ასლები.
- **Netlify Free**: საკმარისია. კომერციული გამოყენება დაშვებულია.

## მნიშვნელოვანი შენიშვნები

- ხელშეკრულებებისა და ბრძანებების შაბლონები ზოგადია. ხელმოწერამდე გადაახედეთ იურისტს.
- ხელფასის გამოთვლა მარტივია: 20% საშემოსავლო ითვლება საპენსიოს გამოკლების შემდეგ. საგადასახადო შეღავათები (მაგ. შშმ პირები) გათვალისწინებული არ არის. უწყისი ბუღალტერს გადაამოწმებინეთ.
- უქმე დღეების სია ჩაწერილია ფაილში `src/lib/dates.ts` (აღდგომა ავტომატურად ითვლება). თუ კანონი შეიცვლება, იქ განაახლეთ.

---

## For developers

```bash
npm install
cp .env.example .env.local   # fill in VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY
npm run dev                  # http://localhost:5173
npm run build                # type-check + production build into dist/
```

- `supabase/schema.sql`: the whole database (tables, RLS policies, RPCs, storage buckets, realtime publication). Run it once on a fresh project.
- `supabase/test/`: `stub.sql` (minimal auth/storage stand-ins) + `rls_test.sql` let you check the access rules on plain PostgreSQL:
  `psql -f supabase/test/stub.sql -f supabase/schema.sql -f supabase/test/rls_test.sql`
- Roles: `admin` / `hr` / `employee` in `profiles.role`; "manager" means having direct reports (`employees.manager_id`). The first user to sign up becomes `admin`; a new user is linked to an employee record by matching email (both directions, via triggers).
- i18n: `src/i18n/ka.ts` is the source of keys; `en.ts` must have the same keys (enforced by TypeScript).
