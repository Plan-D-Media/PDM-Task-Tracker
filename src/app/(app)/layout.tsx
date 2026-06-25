import { requireProfile } from "@/lib/auth";
import { loadNav } from "@/lib/nav";
import { AppSidebar, type SidebarProfile } from "@/components/app-shell/app-sidebar";

/**
 * Shell for every authenticated page: persistent sidebar + scrollable
 * content area. `requireProfile` redirects to /login if there's no session,
 * and `loadNav` returns ONLY the boards RLS lets this user see (§5/§7).
 */
export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [profile, nav] = await Promise.all([requireProfile(), loadNav()]);

  const sidebarProfile: SidebarProfile = {
    full_name: profile.full_name,
    email: profile.email,
    role: profile.role,
    avatar_url: profile.avatar_url,
    department: profile.department
      ? { name: profile.department.name, color: profile.department.color }
      : null,
  };

  return (
    <div className="flex h-screen overflow-hidden">
      <AppSidebar
        profile={sidebarProfile}
        boards={nav.boards}
        departments={nav.departments}
      />
      <main className="min-w-0 flex-1 overflow-hidden">{children}</main>
    </div>
  );
}
