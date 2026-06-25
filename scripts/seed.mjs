// ════════════════════════════════════════════════════════════════════
// PlanDesk seed (Brief §9). Idempotent + self-healing. Uses the
// SERVICE-ROLE key, so it runs server-side only and bypasses RLS to
// create auth users + data.
//
//   npm run seed            (= node --env-file=.env.local scripts/seed.mjs)
//
// Creates: 10 departments, 1 super_admin + 1 admin + 37 departmental staff
// (the first member of each dept is its manager/head), and a starter
// "<Name> — Priorities" board per member with sample daily/weekly/monthly
// tasks — exactly one per board is deliberately overdue, to exercise the
// Phase-4 deadline alarm.
//
// Re-runnable: every entity is get-or-create / upsert (departments by name,
// auth users by email, profiles by id, boards by owner+name, sample tasks
// only when the board has none). Running it twice yields the same state
// with no duplicate-key errors.
//
// IMPORTANT: starter columns are resolved by their SEMANTIC FLAGS
// (is_done_column / position), never by display name — the canonical names
// changed between migrations (WIP→"Work in Progress", Complete→"Completed"),
// and matching on the literal string is exactly what crashed the old seed.
// ════════════════════════════════════════════════════════════════════
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const DOMAIN = (process.env.NEXT_PUBLIC_ALLOWED_EMAIL_DOMAIN ?? "pland.in").toLowerCase();
const DEV_PASSWORD = "PlanDesk#2026"; // dev convenience; magic-link is the real path

if (!url || !serviceKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.");
  console.error("Run with:  npm run seed");
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
  name.toLowerCase().trim().replace(/[^a-z]+/g, ".").replace(/^\.|\.$/g, "");

// ── Helpers ──────────────────────────────────────────────────────────
async function findUserByEmail(email) {
  // listUsers is paginated; scan until found (seed scale is tiny).
  const needle = email.toLowerCase();
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await db.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw new Error(`listUsers (page ${page}): ${error.message}`);
    const hit = data.users.find((u) => u.email?.toLowerCase() === needle);
    if (hit) return hit;
    if (data.users.length < 200) break;
  }
  return null;
}

/** Get-or-create the auth user, returning its id. Idempotent by email. */
async function ensureUser(email, fullName) {
  const existing = await findUserByEmail(email);
  if (existing) return existing.id;

  const { data, error } = await db.auth.admin.createUser({
    email,
    password: DEV_PASSWORD,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  });
  if (error) throw new Error(`createUser '${email}': ${error.message}`);
  if (!data?.user?.id) {
    throw new Error(`createUser '${email}': no user returned (cannot read id).`);
  }
  return data.user.id;
}

/**
 * Upsert the profile row. The handle_new_user trigger creates a bare profile
 * when the auth user is inserted; we upsert (onConflict id) so this both
 * fills in that row and self-heals if the trigger ever failed to fire.
 */
async function upsertProfile(id, fields) {
  const { data, error } = await db
    .from("profiles")
    .upsert({ id, ...fields }, { onConflict: "id" })
    .select("id")
    .single();
  if (error) throw new Error(`profile '${fields.email ?? id}': ${error.message}`);
  if (!data) throw new Error(`profile '${fields.email ?? id}': no row returned after upsert.`);
  return data.id;
}

/** Resolve a department id by name with a clear, named failure. */
function requireDeptId(deptIdByName, name, who) {
  const id = deptIdByName[(name ?? "").trim()];
  if (!id) {
    throw new Error(
      `${who} references unknown department '${name}'. ` +
        `Known departments: ${Object.keys(deptIdByName).join(", ")}.`,
    );
  }
  return id;
}

/**
 * Pick the starter columns by FLAG/position, not by display name. Works
 * under every migration's naming (To Do/WIP/Complete/Remarks OR
 * To Do/Work in Progress/Completed/Cancelled).
 *   todo = first non-done column by position
 *   wip  = second non-done column by position (falls back to todo)
 */
function pickStarterColumns(cols, boardName) {
  if (!cols || cols.length === 0) {
    throw new Error(
      `Board '${boardName}': no columns found — the seed_default_columns ` +
        `trigger did not run. Are migrations applied?`,
    );
  }
  const active = cols
    .filter((c) => !c.is_done_column)
    .sort((a, b) => a.position - b.position);
  const todo = active[0];
  if (!todo) {
    throw new Error(`Board '${boardName}': could not resolve a 'To Do' column.`);
  }
  const wip = active[1] ?? todo;
  return { todo, wip };
}

const daysFromNow = (d) => {
  const t = new Date();
  t.setDate(t.getDate() + d);
  return t.toISOString();
};

/** Get-or-create a starter board for an owner. */
async function getOrCreateBoard(userId, deptId, fullName) {
  const boardName = `${fullName.split(" ")[0]} — Priorities`;

  const { data: existing, error: selErr } = await db
    .from("boards")
    .select("id")
    .eq("owner_id", userId)
    .eq("name", boardName)
    .maybeSingle();
  if (selErr) throw new Error(`board lookup '${boardName}': ${selErr.message}`);
  if (existing) return { boardId: existing.id, boardName };

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
  if (error) throw new Error(`create board '${boardName}': ${error.message}`);
  if (!board) throw new Error(`create board '${boardName}': no row returned.`);
  return { boardId: board.id, boardName };
}

/** Insert the sample tasks for a board, but only if it has none yet. */
async function seedSampleTasks(boardId, boardName, userId) {
  const { count, error: cntErr } = await db
    .from("tasks")
    .select("id", { count: "exact", head: true })
    .eq("board_id", boardId);
  if (cntErr) throw new Error(`task count for '${boardName}': ${cntErr.message}`);
  if ((count ?? 0) > 0) return 0; // already seeded → leave as-is (idempotent)

  const { data: cols, error: colErr } = await db
    .from("board_columns")
    .select("id, name, position, is_done_column")
    .eq("board_id", boardId);
  if (colErr) throw new Error(`columns for '${boardName}': ${colErr.message}`);

  const { todo, wip } = pickStarterColumns(cols, boardName);

  // Exactly one overdue task per board (alarm bait); the rest are future.
  const samples = [
    { title: "Review yesterday's campaign metrics", column_id: todo.id, period: "daily", priority: "high", due_date: daysFromNow(-1), position: 0 },
    { title: "Weekly status report", column_id: wip.id, period: "weekly", priority: "medium", due_date: daysFromNow(2), position: 0 },
    { title: "Monthly retrospective notes", column_id: todo.id, period: "monthly", priority: "low", due_date: daysFromNow(12), position: 1 },
  ];

  const { error } = await db.from("tasks").insert(
    samples.map((s) => ({
      board_id: boardId,
      assignee_id: userId,
      created_by: userId,
      ...s,
    })),
  );
  if (error) throw new Error(`sample tasks for '${boardName}': ${error.message}`);
  return samples.length;
}

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
    if (error) throw new Error(`department '${d.name}': ${error.message}`);
    if (!data) throw new Error(`department '${d.name}': no row returned after upsert.`);
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
    department_id: requireDeptId(deptIdByName, "Project Management", "Super admin"),
    is_active: true,
  });

  const admin2Email = `admin2@${DOMAIN}`;
  const admin2Id = await ensureUser(admin2Email, "Plan D Admin");
  await upsertProfile(admin2Id, {
    full_name: "Plan D Admin",
    email: admin2Email,
    role: "admin", // full data/user mgmt, but NO leaderboard
    department_id: requireDeptId(deptIdByName, "HR", "Admin"),
    is_active: true,
  });

  console.log("→ Seeding staff + starter boards…");
  let staff = 0;
  let boardsWithTasks = 0;
  for (const d of DEPARTMENTS) {
    const deptId = requireDeptId(deptIdByName, d.name, `Department '${d.name}'`);
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
        const { error } = await db
          .from("departments")
          .update({ head_user_id: userId })
          .eq("id", deptId);
        if (error) throw new Error(`set head for '${d.name}': ${error.message}`);
      }

      // Starter board (the AFTER-INSERT trigger seeds the 4 columns).
      const { boardId, boardName } = await getOrCreateBoard(userId, deptId, fullName);
      const inserted = await seedSampleTasks(boardId, boardName, userId);
      if (inserted > 0) boardsWithTasks++;

      staff++;
    }
  }

  console.log(
    `✓ Seed complete. ${staff} staff + super_admin (${adminEmail}) + admin (${admin2Email}).`,
  );
  console.log(`  ${boardsWithTasks} starter board(s) had sample tasks created this run.`);
  console.log(`  Dev password for all accounts: ${DEV_PASSWORD}`);
  console.log("  (Production uses magic-link; the password is dev-only.)");
}

main().catch((e) => {
  console.error("✗ Seed failed:", e.message);
  process.exit(1);
});
