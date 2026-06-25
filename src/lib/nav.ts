import "server-only";
import { createClient } from "@/lib/supabase/server";

export type NavBoard = {
  id: string;
  name: string;
  department_id: string | null;
  visibility: string;
  owner_id: string;
};
export type NavDept = { id: string; name: string; color: string };

/** Sidebar data — boards are RLS-scoped to what the user may see (§7). */
export async function loadNav(): Promise<{
  boards: NavBoard[];
  departments: NavDept[];
}> {
  const supabase = await createClient();
  const [boards, departments] = await Promise.all([
    supabase
      .from("boards")
      .select("id, name, department_id, visibility, owner_id")
      .is("archived_at", null)
      .order("name", { ascending: true }),
    supabase.from("departments").select("id, name, color").order("name"),
  ]);
  return {
    boards: (boards.data ?? []) as NavBoard[],
    departments: (departments.data ?? []) as NavDept[],
  };
}
