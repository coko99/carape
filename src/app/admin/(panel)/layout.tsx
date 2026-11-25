import { requireStaff } from "@/server/admin";
import { AdminNav } from "@/components/admin/nav";
import { BrandMark } from "@/components/brand-mark";

export const instant = false;

export default async function Layout({ children }: { children: React.ReactNode }) {
  const { session } = await requireStaff("dashboard");
  return (
    <div className="admin-shell">
      <aside className="admin-side">
        <a className="admin-brand" href="/admin">
          <BrandMark className="h-10 w-auto" />
          <span>Admin</span>
        </a>
        <AdminNav />
        <p className="admin-user">{session.user.email}</p>
      </aside>
      <main className="admin-main">{children}</main>
    </div>
  );
}
