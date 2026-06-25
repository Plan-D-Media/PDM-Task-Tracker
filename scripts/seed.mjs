// ════════════════════════════════════════════════════════════════════
// PlanDesk seed (Brief §9). Idempotent. Uses the SERVICE-ROLE key, so it
// runs server-side only and bypasses RLS to create auth users + data.
//
//   node --env-file=.env.local scripts/seed.mjs
//
// Creates: 10 departments, 1 agency admin + 37 departmental staff (the
// first member of each dept is its manager/head), and a starter
// "<Name> — Priorities" board per member with sample daily/weekly/monthly
// tasks (a few intentionally overdue to exercise the Phase-4 alarm).
// ════════════════════════════════════════════════════════════════════
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const DOMAIN = (process.env.NEXT_PUBLIC_ALLOWED_EMAIL_DOMAIN ?? "pland.in").toLowerCase();
const DEV_PASSWORD = "PlanDesk#2026"; // dev convenience; magic-link is the real path

if (!url || !serviceKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.");
  console.error("Run with:  node --env-file=.env.local scripts/seed.mjs");
  process.exit(1);
}

const db = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// ── Department + people definitions (§9) ─────────────────────────────
const DEPARTMENTS = [
  { name: "Paid Campaign", color: "#ef4444", people: ["Arjun Mehta", "Priya Sharma", "Rohan Das", "Sneha Roy", "Karan Bose", "Ananya Pal", "Vikram Sen"] },
  { name: "SEO", color: "#10b981", people: ["Ishan Ghosh", "Meera Nair"] },
  { name: "Social Media", color: "#8b5cf6", people: ["Tanvi Kapoor", "Aditya Jain", "Riya Banerjee", "Sahil Khan"] },
  { name: "Website", color: "#0ea5e9", people: ["Dev Malhotra", "Pooja Iyer", "Nikhil Rao", "Aisha Verma", "Sourav Dutta"] },
  { name: "Designer", color: "#ec4899", people: ["Maya Chatterjee", "Aryan Gupta", "Neha Singh", "Rahul Mitra"] },
  { name: "Content", color: "#f59e0b", people: ["Kavya Reddy", "Aman Saxena"] },
  { name: "HR", color: "#14b8a6", people: ["Shruti Joshi", "Manish Agarwal"] },
  { name: "YouTube", color: "#f43f5e", people: ["Varun Pillai", "Diya Sarkar", "Harsh Vora"] },
  { name: "Sales", color: "#6366f1", people: ["Akash Yadav", "Ritika Shah", "Gaurav Naik", "Simran Kaur"] },
  { name: "Project Management", color: "#84cc16", people: ["Anjali Desai", "Rajat Kulkarni", "Farah Ansari", "Yash Thakur"] },
];

const slug = (name) =>
  name.toLowerCase().replace(/[^a-z]+/g, ".").replace(/^\.|\.$/g, "");

// ── Helpers ──────────────────────────────────────────────────────────
async function findUserByEmail(email) {
  // listUsers is paginated; scan until found (seed scale is tiny).
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await db.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    const hit = data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
    if (hit) return hit;
    if (data.users.length < 200) break;
  }
  return null;
}

async function ensureUser(email, fullName) {
  const existing = await findUserByEmail(email);
  if (existing) return existing.id;
  const { data, error } = await db.auth.admin.createUser({
    email,
    password: DEV_PASSWORD,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  });
  if (error) throw new Error(`createUser ${email}: ${error.message}`);
  return data.user.id;
}

async function upsertProfile(id, fields) {
  const { error } = await db.from("profiles").update(fields).eq("id", id);
  if (error) throw new Error(`profile ${id}: ${error.message}`);
}

const daysFromNow = (d) => {
  const t = new Date();
  t.setDate(t.getDate() + d);
  return t.toISOString();
};

// ── Main ─────────────────────────────────────────────────────────────
async function main() {
  console.log("→ Seeding departments…");
  const deptIdByName = {};
  for (const d of DEPARTMENTS) {
    const { data, error } = await db
      .from("departments")
      .upsert({ name: d.name, color: d.color }, { onConflict: "name" })
      .select("id")
      .single();
    if (error) throw error;
    deptIdByName[d.name] = data.id;
  }

  // Super admin (founder account) + one plain admin for §7 boundary tests.
  console.log("→ Seeding super admin + admin…");
  const adminEmail = `admin@${DOMAIN}`;
  const adminId = await ensureUser(adminEmail, "Plan D Founder");
  await upsertProfile(adminId, {
    full_name: "Plan D Founder",
    email: adminEmail,
    role: "super_admin", // sole leaderboard access (Brief §3/§13)
    department_id: deptIdByName["Project Management"],
    is_active: true,
  });

  const admin2Email = `admin2@${DOMAIN}`;
  const admin2Id = await ensureUser(admin2Email, "Plan D Admin");
  await upsertProfile(admin2Id, {
    full_name: "Plan D Admin",
    email: admin2Email,
    role: "admin", // full data/user mgmt, but NO leaderboard
    department_id: deptIdByName["HR"],
    is_active: true,
  });

  console.log("→ Seeding staff + starter boards…");
  let created = 0;
  for (const d of DEPARTMENTS) {
    const deptId = deptIdByName[d.name];
    for (let i = 0; i < d.people.length; i++) {
      const fullName = d.people[i];
      const email = `${slug(fullName)}@${DOMAIN}`;
      const role = i === 0 ? "manager" : "member"; // first = dept head
      const userId = await ensureUser(email, fullName);
      await upsertProfile(userId, {
        full_name: fullName,
        email,
        role,
        department_id: deptId,
        is_active: true,
      });
      if (i === 0) {
        await db.from("departments").update({ head_user_id: userId }).eq("id", deptId);
      }

      // Starter board (the AFTER-INSERT trigger seeds the 4 columns).
      const boardName = `${fullName.split(" ")[0]} — Priorities`;
      const { data: existingBoard } = await db
        .from("boards")
        .select("id")
        .eq("owner_id", userId)
        .eq("name", boardName)
        .maybeSingle();

      let boardId = existingBoard?.id;
      if (!boardId) {
        const { data: board, error } = await db
          .from("boards")
          .insert({
            name: boardName,
            owner_id: userId,
            created_by: userId,
            department_id: deptId,
            visibility: "department",
            description: `${fullName}'s daily / weekly / monthly priorities.`,
          })
          .select("id")
          .single();
        if (error) throw error;
        boardId = board.id;

        const { data: cols } = await db
          .from("board_columns")
          .select("id, name, is_done_column")
          .eq("board_id", boardId);
        const todo = cols.find((c) => c.name === "To Do");
        const wip = cols.find((c) => c.name === "WIP");

        // Sample tasks: one overdue (alarm bait), one due soon, one done-ish.
        const samples = [
          { title: "Review yesterday's campaign metrics", column_id: todo.id, period: "daily", priority: "high", due_date: daysFromNow(-1), position: 0 },
          { title: "Weekly status report", column_id: wip.id, period: "weekly", priority: "medium", due_date: daysFromNow(2), position: 0 },
          { title: "Monthly retrospective notes", column_id: todo.id, period: "monthly", priority: "low", due_date: daysFromNow(12), position: 1 },
        ];
        for (const s of samples) {
          await db.from("tasks").insert({
            board_id: boardId,
            assignee_id: userId,
            created_by: userId,
            ...s,
          });
        }
      }
      created++;
    }
  }

  console.log(`✓ Seed complete. ${created} staff + super_admin (${adminEmail}) + admin (${admin2Email}).`);
  console.log(`  Dev password for all accounts: ${DEV_PASSWORD}`);
  console.log("  (Production uses magic-link; the password is dev-only.)");
}

main().catch((e) => {
  console.error("✗ Seed failed:", e.message);
  process.exit(1);
});
