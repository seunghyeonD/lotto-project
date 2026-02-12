/**
 * 네비게이션 컴포넌트
 */

"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createBrowserClient } from "@/lib/supabase-auth";

const navItems = [
  { href: "/", label: "대시보드", icon: "📊" },
  { href: "/generate", label: "번호 생성", icon: "🎲" },
  { href: "/statistics", label: "통계 분석", icon: "📈" },
  { href: "/validate", label: "조합 검증", icon: "✓" },
  { href: "/analyze", label: "조합 번호", icon: "🔍" },
  { href: "/admin", label: "데이터 관리", icon: "⚙️" },
];

export const Navigation: React.FC = () => {
  const pathname = usePathname();
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createBrowserClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUserEmail(user?.email ?? null);
    });
  }, []);

  const handleLogout = async () => {
    const supabase = createBrowserClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  };

  if (pathname === "/login") return null;

  return (
    <nav className="bg-white shadow-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center">
            <Link href="/" className="flex items-center gap-2">
              <span className="text-2xl">🎰</span>
              <span className="text-xl font-bold text-gray-800">
                <span className="hidden sm:inline">로또 번호 생성 시스템</span>
                <span className="sm:hidden">로또</span>
              </span>
            </Link>
          </div>

          {/* 모바일 햄버거 버튼 */}
          <button
            className="md:hidden p-2 rounded-lg text-gray-700 hover:bg-gray-100 transition-colors"
            onClick={() => setMenuOpen(!menuOpen)}
            aria-label="메뉴 토글"
          >
            <span className="text-2xl">{menuOpen ? "✕" : "☰"}</span>
          </button>

          {/* 데스크톱 메뉴 */}
          <div className="hidden md:flex items-center gap-1">
            {navItems.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all font-medium ${
                    isActive
                      ? "bg-blue-500 text-white shadow-md"
                      : "text-gray-700 hover:bg-gray-100"
                  }`}
                >
                  <span>{item.icon}</span>
                  <span>{item.label}</span>
                </Link>
              );
            })}
            <div className="ml-2 pl-2 border-l border-gray-200 flex items-center gap-2">
              {userEmail && (
                <span className="text-xs text-gray-500 hidden lg:inline">
                  {userEmail}
                </span>
              )}
              <button
                onClick={handleLogout}
                className="px-3 py-2 text-sm text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all font-medium"
              >
                로그아웃
              </button>
            </div>
          </div>
        </div>

        {/* 모바일 드롭다운 메뉴 */}
        {menuOpen && (
          <div className="md:hidden pb-4">
            <div className="flex flex-col gap-1">
              {navItems.map((item) => {
                const isActive = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMenuOpen(false)}
                    className={`flex items-center gap-2 px-4 py-3 rounded-lg transition-all font-medium ${
                      isActive
                        ? "bg-blue-500 text-white shadow-md"
                        : "text-gray-700 hover:bg-gray-100"
                    }`}
                  >
                    <span>{item.icon}</span>
                    <span>{item.label}</span>
                  </Link>
                );
              })}
              <div className="mt-2 pt-2 border-t border-gray-200">
                {userEmail && (
                  <p className="px-4 py-1 text-xs text-gray-500">{userEmail}</p>
                )}
                <button
                  onClick={handleLogout}
                  className="w-full text-left px-4 py-3 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all font-medium"
                >
                  로그아웃
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </nav>
  );
};
