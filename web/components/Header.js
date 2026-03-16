"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import NotificationBell from "./NotificationBell";
import { SPORT_CONFIGS } from "@/lib/sport-config";

export default function Header() {
  const router = useRouter();
  const [user, setUser] = useState(undefined);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    fetchUser();
  }, []);

  async function fetchUser() {
    try {
      const res = await fetch("/api/auth");
      const data = await res.json();
      setUser(data.user || null);
    } catch {
      setUser(null);
    }
  }

  async function handleLogout() {
    try {
      await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "logout" }),
      });
      setUser(null);
      setMenuOpen(false);
      router.push("/");
      router.refresh();
    } catch {}
  }

  const pathname = usePathname();
  const isLoggedIn = user !== undefined && user !== null;
  const isAdmin = user?.role === "admin";

  // SPORT_CONFIGSからナビリンク生成
  const sportNavLinks = SPORT_CONFIGS
    .filter((s) => s.enabled)
    .sort((a, b) => a.order - b.order)
    .map((s) => ({
      href: `/${s.slug}`,
      label: s.shortLabel || s.label,
      key: s.key,
    }));

  return (
    <header className="bg-white border-b border-gray-100 sticky top-0 z-50">
      {/* メインヘッダー */}
      <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
        {/* 左: ロゴ */}
        <Link href="/" className="flex items-center gap-2 shrink-0 group">
          <span className="text-2xl font-extrabold text-blue-700 tracking-tight group-hover:text-blue-800 transition-colors">
            大会ナビ
          </span>
          <span className="text-[10px] hidden md:inline border-l border-gray-200 pl-2 ml-0.5 leading-tight" style={{ color: "#333333" }}>
            全国のスポーツ大会を探す
          </span>
        </Link>

        {/* 中央: カテゴリナビ（PC） — SPORT_CONFIGSから動的生成 */}
        <nav className="hidden lg:flex items-center gap-1" aria-label="メインナビゲーション">
          {sportNavLinks.map((link) => (
            <NavLink
              key={link.key}
              href={link.href}
              label={link.label}
              active={pathname.startsWith(link.href)}
            />
          ))}
          <NavLink href="/next-race" label="次の大会" active={pathname === "/next-race"} />
          <NavLink href="/popular" label="人気" active={pathname === "/popular"} />
          <NavLink href="/features/beginner-friendly-marathons" label="特集" active={pathname.startsWith("/features")} />
        </nav>

        {/* 右: ユーザー導線（PC） */}
        <div className="hidden sm:flex items-center gap-2 text-sm">
          {/* Phase62: Runner Dashboard（ログイン不要） */}
          <HeaderIconLink href="/runner" label="Runner Dashboard">
            <svg className="w-4.5 h-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 0 1 6 3.75h2.25A2.25 2.25 0 0 1 10.5 6v2.25a2.25 2.25 0 0 1-2.25 2.25H6a2.25 2.25 0 0 1-2.25-2.25V6ZM3.75 15.75A2.25 2.25 0 0 1 6 13.5h2.25a2.25 2.25 0 0 1 2.25 2.25V18a2.25 2.25 0 0 1-2.25 2.25H6A2.25 2.25 0 0 1 3.75 18v-2.25ZM13.5 6a2.25 2.25 0 0 1 2.25-2.25H18A2.25 2.25 0 0 1 20.25 6v2.25A2.25 2.25 0 0 1 18 10.5h-2.25a2.25 2.25 0 0 1-2.25-2.25V6ZM13.5 15.75a2.25 2.25 0 0 1 2.25-2.25H18a2.25 2.25 0 0 1 2.25 2.25V18A2.25 2.25 0 0 1 18 20.25h-2.25A2.25 2.25 0 0 1 13.5 18v-2.25Z" />
            </svg>
          </HeaderIconLink>
          {/* 検討中の大会（ログイン不要） */}
          <HeaderIconLink href="/my-events" label="検討中の大会">
            <svg className="w-4.5 h-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 0 0 2.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 0 0-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 0 0 .75-.75 2.25 2.25 0 0 0-.1-.664m-5.8 0A2.251 2.251 0 0 1 13.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25Z" />
            </svg>
          </HeaderIconLink>
          {isLoggedIn && (
            <>
              <HeaderIconLink href="/favorites" label="お気に入り">
                <svg className="w-4.5 h-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />
                </svg>
              </HeaderIconLink>
              <HeaderIconLink href="/saved-searches" label="保存検索">
                <svg className="w-4.5 h-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17.593 3.322c1.1.128 1.907 1.077 1.907 2.185V21L12 17.25 4.5 21V5.507c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0111.186 0z" />
                </svg>
              </HeaderIconLink>
              <NotificationBell />
            </>
          )}
          {isAdmin && (
            <Link href="/admin/jobs" className="text-orange-600 hover:text-orange-700 transition-colors font-medium text-xs border border-orange-300 rounded px-2 py-0.5">
              管理
            </Link>
          )}
          <div className="flex items-center gap-2 ml-1 pl-3 border-l border-gray-200">
            {user === undefined ? null : isLoggedIn ? (
              <>
                <span className="text-xs hidden md:inline" style={{ color: "#333333" }}>
                  {user.name || user.email}
                </span>
                <button onClick={handleLogout} className="text-xs hover:text-red-500 transition-colors" style={{ color: "#333333" }}>
                  ログアウト
                </button>
              </>
            ) : (
              <>
                <Link href="/login" className="hover:text-blue-600 transition-colors font-medium text-sm" style={{ color: "#333333" }}>
                  ログイン
                </Link>
                <Link href="/signup" className="px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium text-xs shadow-sm">
                  会員登録
                </Link>
              </>
            )}
          </div>
        </div>

        {/* モバイルボタン群 */}
        <div className="flex sm:hidden items-center gap-2">
          {sportNavLinks.slice(0, 1).map((link) => (
            <Link key={link.key} href={link.href} className="hover:text-blue-600 text-xs font-medium" style={{ color: "#333333" }}>
              {link.label}
            </Link>
          ))}
          {isLoggedIn && <NotificationBell />}
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="p-1.5 text-gray-500 hover:text-gray-700"
            aria-label="メニュー"
          >
            {menuOpen ? (
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
                <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
              </svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
                <path fillRule="evenodd" d="M2 4.75A.75.75 0 0 1 2.75 4h14.5a.75.75 0 0 1 0 1.5H2.75A.75.75 0 0 1 2 4.75Zm0 10.5a.75.75 0 0 1 .75-.75h14.5a.75.75 0 0 1 0 1.5H2.75a.75.75 0 0 1-.75-.75ZM2 10a.75.75 0 0 1 .75-.75h14.5a.75.75 0 0 1 0 1.5H2.75A.75.75 0 0 1 2 10Z" clipRule="evenodd" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* モバイルメニュー */}
      {menuOpen && (
        <div className="sm:hidden border-t border-gray-100 bg-white px-4 py-3 space-y-1">
          {sportNavLinks.map((link) => (
            <MobileNavLink key={link.key} href={link.href} label={`${link.label}大会を探す`} onClick={() => setMenuOpen(false)} />
          ))}
          <MobileNavLink href="/next-race" label="次の大会を探す" onClick={() => setMenuOpen(false)} />
          <MobileNavLink href="/popular" label="人気の大会" onClick={() => setMenuOpen(false)} />
          <MobileNavLink href="/features/beginner-friendly-marathons" label="特集" onClick={() => setMenuOpen(false)} />
          <MobileNavLink href="/runner" label="Runner Dashboard" onClick={() => setMenuOpen(false)} />
          <MobileNavLink href="/my-events" label="検討中の大会" onClick={() => setMenuOpen(false)} />
          <div className="my-2 border-t border-gray-100" />
          {isLoggedIn ? (
            <>
              <MobileNavLink href="/favorites" label="お気に入り" onClick={() => setMenuOpen(false)} />
              <MobileNavLink href="/saved-searches" label="保存検索" onClick={() => setMenuOpen(false)} />
              <MobileNavLink href="/notifications" label="通知一覧" onClick={() => setMenuOpen(false)} />
              <MobileNavLink href="/notification-settings" label="通知設定" onClick={() => setMenuOpen(false)} />
              {isAdmin && (
                <MobileNavLink href="/admin/jobs" label="管理画面" onClick={() => setMenuOpen(false)} className="text-orange-600" />
              )}
              <div className="pt-2 border-t border-gray-100 flex items-center justify-between">
                <span className="text-xs text-gray-400">{user.name || user.email}</span>
                <button onClick={handleLogout} className="text-xs text-red-500 hover:text-red-600">
                  ログアウト
                </button>
              </div>
            </>
          ) : user === undefined ? null : (
            <div className="flex items-center gap-3 py-2">
              <Link href="/login" onClick={() => setMenuOpen(false)} className="text-sm text-gray-600 hover:text-blue-600 font-medium">
                ログイン
              </Link>
              <Link href="/signup" onClick={() => setMenuOpen(false)} className="px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-xs font-medium">
                会員登録
              </Link>
            </div>
          )}
        </div>
      )}
    </header>
  );
}

function NavLink({ href, label, active }) {
  return (
    <Link
      href={href}
      className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
        active
          ? "text-blue-700 bg-blue-50"
          : "hover:text-blue-600 hover:bg-gray-50"
      }`}
      style={active ? undefined : { color: "#333333" }}
    >
      {label}
    </Link>
  );
}

function HeaderIconLink({ href, label, children }) {
  return (
    <Link
      href={href}
      className="p-2 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
      style={{ color: "#333333" }}
      title={label}
      aria-label={label}
    >
      {children}
    </Link>
  );
}

function MobileNavLink({ href, label, onClick, className = "" }) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className={`block py-2 text-sm hover:text-blue-600 ${className}`}
      style={{ color: "#333333" }}
    >
      {label}
    </Link>
  );
}
