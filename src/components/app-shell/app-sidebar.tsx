"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Layers, LayoutDashboard, LogOut } from "lucide-react";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
  initials,
} from "@/components/ui/avatar";
import { signOut } from "@/lib/actions/auth";
import { ROLE_LABEL, type Role } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { CreateBoardDialog } from "./create-board-dialog";
import type { NavBoard, NavDept } from "@/lib/nav";

export type SidebarProfile = {
  full_name: string;
  email: string;
  role: Role;
  avatar_url: string | null;
  department: { name: string; color: string } | null;
};

export function AppSidebar({
  profile,
  boards,
  departments,
}: {
  profile: SidebarProfile;
  boards: NavBoard[];
  departments: NavDept[];
}) {
  const pathname = usePathname();
  const deptColor = new Map(departments.map((d) => [d.id, d.color]));
  const name = profile.full_name || profile.email;

  return (
    <aside className="flex h-screen w-64 shrink-0 flex-col border-r border-[var(--border)] bg-[var(--card)]">
      <div className="flex items-center gap-2 px-4 py-4">
        <div className="grid size-8 place-items-center rounded-lg bg-[var(--primary)] text-[var(--primary-foreground)]">
          <Layers className="size-4" />
        </div>
        <div className="leading-tight">
          <div className="text-sm font-semibold">PlanDesk</div>
          <div className="text-[11px] text-[var(--muted-foreground)]">
            Plan D Media
          </div>
        </div>
      </div>

      <nav className="px-2">
        <SidebarLink
          href="/"
          active={pathname === "/"}
          icon={<LayoutDashboard className="size-4" />}
          label="Dashboard"
        />
      </nav>

      <div className="px-4 pb-2 pt-4 text-[11px] font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">
        Trackers
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-2">
        {boards.length === 0 ? (
          <p className="px-2 py-2 text-xs text-[var(--muted-foreground)]">
            No trackers yet.
          </p>
        ) : (
          <ul className="space-y-0.5">
            {boards.map((b) => {
              const href = `/board/${b.id}`;
              return (
                <li key={b.id}>
                  <SidebarLink
                    href={href}
                    active={pathname === href}
                    icon={
                      <span
                        className="size-2.5 shrink-0 rounded-full"
                        style={{
                          backgroundColor:
                            deptColor.get(b.department_id ?? "") ?? "#94a3b8",
                        }}
                      />
                    }
                    label={b.name}
                  />
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className="p-2">
        <CreateBoardDialog />
      </div>

      <div className="flex items-center gap-2 border-t border-[var(--border)] p-3">
        <Avatar className="size-8">
          {profile.avatar_url ? (
            <AvatarImage src={profile.avatar_url} alt={name} />
          ) : null}
          <AvatarFallback>{initials(name)}</AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1 leading-tight">
          <div className="truncate text-sm font-medium">{name}</div>
          <div className="truncate text-[11px] text-[var(--muted-foreground)]">
            {ROLE_LABEL[profile.role]}
            {profile.department ? ` · ${profile.department.name}` : ""}
          </div>
        </div>
        <form action={signOut}>
          <button
            type="submit"
            title="Sign out"
            className="rounded-md p-1.5 text-[var(--muted-foreground)] transition-colors hover:bg-[var(--muted)] hover:text-[var(--foreground)]"
          >
            <LogOut className="size-4" />
          </button>
        </form>
      </div>
    </aside>
  );
}

function SidebarLink({
  href,
  active,
  icon,
  label,
}: {
  href: string;
  active: boolean;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm transition-colors",
        active
          ? "bg-[var(--accent)] font-medium text-[var(--accent-foreground)]"
          : "text-[var(--foreground)] hover:bg-[var(--muted)]",
      )}
    >
      {icon}
      <span className="truncate">{label}</span>
    </Link>
  );
}
