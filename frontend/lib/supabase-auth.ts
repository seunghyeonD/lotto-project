import { createBrowserClient as createBrowser } from '@supabase/ssr';

/**
 * 클라이언트 컴포넌트용 Supabase 클라이언트
 * 로그인/로그아웃 등 브라우저에서 사용
 */
export function createBrowserClient() {
  return createBrowser(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
