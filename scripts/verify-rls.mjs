// ════════════════════════════════════════════════════════════════════
// Phase-1 acceptance test (Brief §10 Phase 1 / §12).
// Signs in as different real users via the ANON client and asserts each
// sees ONLY what the §5 visibility matrix permits — proving access
// control holds at the API, not just in the UI.
//
//   node --env-file=.env.local scripts/verify-rls.mjs
//
// Prerequisite: migrations applied + `node scripts/seed.mjs` run.
// ════════════════════════════════════════════════════════════════════
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const DOMAIN = (process.env.NEXT_PUBLIC_ALLOWED_EMAIL_DOMAIN ?? "pland.in").toLowerCase();
const PW = "PlanDesk#2026";

if (!url || !anon) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY");
  process.exit(1);
}

let failures = 0;
function check(name, cond) {
  console.log(`${cond ? "✓" : "✗"} ${name}`);
  if (!cond) failures++;
}

function clientFor() {
  return createClient(url, anon, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

async function signedInBoards(email) {
  const c = clientFor();
  const { error: authErr } = await c.auth.signInWithPassword({ email, password: PW });
  if (authErr) throw new Error(`login ${email}: ${authErr.message}`);
  const { data, error } = await c.from("boards").select("id, name, department_id, visibility");
  if (error) throw new Error(`select ${email}: ${error.message}`);
  return { client: c, boards: data ?? [] };
}

async function main() {
  // SEO has 2 seeded members: Ishan Ghosh (manager) + Meera Nair (member).
  const seoMember = `meera.nair@${DOMAIN}`;
  const seoHead = `ishan.ghosh@${DOMAIN}`;
  const salesOutsider = `akash.yadav@${DOMAIN}`;
  const adminEmail = `admin@${DOMAIN}`;

  const seo = await signedInBoards(seoMember);
  const sales = await signedInBoards(salesOutsider);
  const admin = await signedInBoards(adminEmail);

  // SEO member sees SEO dept boards (incl. dept-mate's department board).
  const seoDeptIds = new Set(seo.boards.map((b) => b.department_id));
  check(
    "SEO member sees only SEO-department boards",
    seo.boards.length > 0 && seoDeptIds.size === 1,
  );

  // The SEO head's board must be visible to the SEO member (dept-visible)…
  const headBoard = seo.boards.find((b) => b.name.startsWith("Ishan"));
  check("SEO member CAN see dept-mate's department board", !!headBoard);

  // …but NOT to a Sales outsider.
  const salesSeesSeo = sales.boards.some((b) => seoDeptIds.has(b.department_id));
  check("Sales outsider CANNOT see SEO boards", !salesSeesSeo);

  // Direct-by-id fetch of an SEO board as the outsider returns nothing.
  if (headBoard) {
    const { data: direct } = await sales.client
      .from("boards")
      .select("id")
      .eq("id", headBoard.id);
    check("Outsider direct-by-id fetch of SEO board is blocked", (direct ?? []).length === 0);

    // Outsider write attempt must fail (no edit rights / no read).
    const { error: wErr } = await sales.client
      .from("boards")
      .update({ name: "hacked" })
      .eq("id", headBoard.id);
    const { data: after } = await admin.client
      .from("boards")
      .select("name")
      .eq("id", headBoard.id)
      .single();
    check(
      "Outsider cannot rename an SEO board",
      after?.name?.startsWith("Ishan") === true,
    );
    void wErr; // RLS yields 0 rows updated rather than an error; we assert state.
  }

  // Admin sees everything (more boards than any single member).
  check("Admin sees the most boards (all departments)", admin.boards.length >= seo.boards.length);
  check("Admin sees more boards than a single member", admin.boards.length > seo.boards.length);

  void seoHead;

  console.log(failures === 0 ? "\nALL PASS ✓" : `\n${failures} CHECK(S) FAILED ✗`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error("verify-rls error:", e.message);
  process.exit(1);
});
