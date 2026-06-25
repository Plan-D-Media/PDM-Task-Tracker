import Link from "next/link";
import { Layers, ListTodo } from "lucide-react";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

/**
 * Dashboard: the trackers this user can see (RLS-scoped) as cards. Phase 5
 * layers global "My Work" / department analytics on top of this shell.
 */
export default async function DashboardPage() {
  const profile = await requireProfile();
  const supabase = await createClient();

  const { data: boardRows } = await supabase
    .from("boards")
    .select("id, name, description, visibility, department:departments(name, color)")
    .is("archived_at", null)
    .order("created_at", { ascending: false });
  const boards = (boardRows ?? []) as unknown as {
    id: string;
    name: string;
    description: string | null;
    visibility: string;
    department: { name: string; color: string } | null;
  }[];

  const { count: taskCount } = await supabase
    .from("tasks")
    .select("id", { count: "exact", head: true })
    .is("archived_at", null);

  return (
    <div className="h-full overflow-y-auto px-8 py-8">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold">
          Welcome, {profile.full_name || profile.email}
        </h1>
        <p className="mt-1 flex items-center gap-3 text-sm text-[var(--muted-foreground)]">
          <span className="inline-flex items-center gap-1.5">
            <Layers className="size-4" /> {boards.length} trackers
          </span>
          <span className="inline-flex items-center gap-1.5">
            <ListTodo className="size-4" /> {taskCount ?? 0} open tasks
          </span>
        </p>
      </header>

      {boards.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[var(--border)] py-16 text-center">
          <p className="text-sm text-[var(--muted-foreground)]">
            No trackers yet. Create one from the sidebar to get started.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {boards.map((b) => (
            <Link
              key={b.id}
              href={`/board/${b.id}`}
              className="group rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 shadow-sm transition-shadow hover:shadow-md"
            >
              <div className="flex items-center gap-2">
                <span
                  className="size-2.5 rounded-full"
                  style={{ backgroundColor: b.department?.color ?? "#94a3b8" }}
                />
                <h2 className="truncate font-medium group-hover:text-[var(--primary)]">
                  {b.name}
                </h2>
              </div>
              {b.description && (
                <p className="mt-2 line-clamp-2 text-sm text-[var(--muted-foreground)]">
                  {b.description}
                </p>
              )}
              <div className="mt-3 flex items-center gap-2 text-xs text-[var(--muted-foreground)]">
                <span className="rounded bg-[var(--muted)] px-2 py-0.5 capitalize">
                  {b.visibility}
                </span>
                {b.department?.name && <span>{b.department.name}</span>}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
