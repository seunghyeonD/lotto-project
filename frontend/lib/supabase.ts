import { createClient } from '@supabase/supabase-js';
import { LottoDrawResult } from '@/types/lotto';

// Supabase 테이블 Row 타입
export interface LottoDrawRow {
  round: number;
  draw_date: string;
  numbers: number[];
  bonus_number: number;
  created_at?: string;
}

function getSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error('Missing Supabase environment variables');
  }

  return createClient(url, key);
}

// Row → LottoDrawResult 변환
function toDrawResult(row: LottoDrawRow): LottoDrawResult {
  return {
    round: row.round,
    drawDate: row.draw_date,
    numbers: [...row.numbers].sort((a, b) => a - b),
    bonusNumber: row.bonus_number,
  };
}

// LottoDrawResult → Row 변환
export function toDrawRow(draw: LottoDrawResult): LottoDrawRow {
  return {
    round: draw.round,
    draw_date: draw.drawDate,
    numbers: [...draw.numbers].sort((a, b) => a - b),
    bonus_number: draw.bonusNumber,
  };
}

/**
 * 최근 N회차 가져오기
 */
export async function getRecentDraws(count: number): Promise<LottoDrawResult[]> {
  const supabase = getSupabaseClient();

  if (count <= 1000) {
    const { data, error } = await supabase
      .from('lotto_draws')
      .select('*')
      .order('round', { ascending: false })
      .limit(count);

    if (error) throw new Error(`Supabase error: ${error.message}`);
    return (data as LottoDrawRow[]).map(toDrawResult);
  }

  // 1000개 초과 시: 최신 회차 기준 범위 조회
  const { data: latest, error: latestErr } = await supabase
    .from('lotto_draws')
    .select('round')
    .order('round', { ascending: false })
    .limit(1)
    .single();

  if (latestErr) throw new Error(`Supabase error: ${latestErr.message}`);
  const latestRound = latest.round;
  const startRound = Math.max(1, latestRound - count + 1);

  return getDrawsInRange(startRound, latestRound);
}

/**
 * 범위 조회
 */
export async function getDrawsInRange(start: number, end: number): Promise<LottoDrawResult[]> {
  const supabase = getSupabaseClient();
  const allResults: LottoDrawRow[] = [];
  const BATCH_SIZE = 1000;

  // Supabase 기본 1000행 제한 우회: 배치로 나눠서 가져오기
  for (let from = start; from <= end; from += BATCH_SIZE) {
    const to = Math.min(from + BATCH_SIZE - 1, end);
    const { data, error } = await supabase
      .from('lotto_draws')
      .select('*')
      .gte('round', from)
      .lte('round', to)
      .order('round', { ascending: true });

    if (error) throw new Error(`Supabase error: ${error.message}`);
    if (data) allResults.push(...(data as LottoDrawRow[]));
  }

  return allResults.map(toDrawResult);
}

/**
 * 특정 회차 조회
 */
export async function getDrawByRound(round: number): Promise<LottoDrawResult | null> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('lotto_draws')
    .select('*')
    .eq('round', round)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null; // not found
    throw new Error(`Supabase error: ${error.message}`);
  }
  return toDrawResult(data as LottoDrawRow);
}

/**
 * 전체 통계 (총 회차 수, 최신 회차)
 */
export async function getDrawStats(): Promise<{ totalRounds: number; latestRound: number }> {
  const supabase = getSupabaseClient();
  const { count, error: countError } = await supabase
    .from('lotto_draws')
    .select('*', { count: 'exact', head: true });

  if (countError) throw new Error(`Supabase error: ${countError.message}`);

  const { data, error: maxError } = await supabase
    .from('lotto_draws')
    .select('round')
    .order('round', { ascending: false })
    .limit(1)
    .single();

  if (maxError && maxError.code !== 'PGRST116') {
    throw new Error(`Supabase error: ${maxError.message}`);
  }

  return {
    totalRounds: count ?? 0,
    latestRound: data?.round ?? 0,
  };
}

/**
 * 여러 회차 upsert
 */
export async function upsertDraws(draws: LottoDrawResult[]): Promise<number> {
  if (draws.length === 0) return 0;

  const supabase = getSupabaseClient();
  const rows = draws.map(toDrawRow);

  const { error } = await supabase
    .from('lotto_draws')
    .upsert(rows, { onConflict: 'round' });

  if (error) throw new Error(`Supabase upsert error: ${error.message}`);
  return draws.length;
}

/**
 * 최신 저장 회차 조회
 */
export async function getLatestStoredRound(): Promise<number> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('lotto_draws')
    .select('round')
    .order('round', { ascending: false })
    .limit(1)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return 0; // no rows
    throw new Error(`Supabase error: ${error.message}`);
  }
  return data.round;
}

/**
 * 특정 범위 내 저장된 회차 목록 조회
 */
export async function getStoredRounds(startRound: number, endRound: number): Promise<number[]> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('lotto_draws')
    .select('round')
    .gte('round', startRound)
    .lte('round', endRound)
    .order('round', { ascending: true });

  if (error) throw new Error(`Supabase error: ${error.message}`);
  return (data || []).map(row => row.round);
}
