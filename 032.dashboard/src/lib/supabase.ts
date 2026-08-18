import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

export const sourceSheetUrl = import.meta.env.VITE_SOURCE_SHEET_URL as string | undefined

export const supabase: SupabaseClient | null =
  supabaseUrl && supabaseAnonKey ? createClient(supabaseUrl, supabaseAnonKey) : null

export function getDashboardLoadErrorMessage(error: unknown) {
  if (error instanceof Error && error.message.startsWith('Supabase env is missing')) {
    return 'Supabase 환경변수가 설정되지 않았습니다.'
  }
  return '대시보드 데이터를 불러오지 못했습니다. 로그인 상태와 접근 권한을 확인해 주세요.'
}
