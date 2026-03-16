import AdminGuard from "@/components/AdminGuard";

export const metadata = {
  robots: { index: false, follow: false },
};

export default function AdminLayout({ children }) {
  return <AdminGuard>{children}</AdminGuard>;
}
