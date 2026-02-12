import { NextRequest, NextResponse } from 'next/server';
import { fetchDraw, estimateLatestRound } from '@/lib/lotto-fetcher';
import { getLatestStoredRound, upsertDraws } from '@/lib/supabase';
import { LottoDrawResult } from '@/types/lotto';
import { validateSession } from '@/lib/api-auth';

export async function POST(request: NextRequest) {
  const authError = await validateSession(request);
  if (authError) return authError;

  try {
    const storedLatest = await getLatestStoredRound();
    const estimated = estimateLatestRound();

    // 동행복권에서 실제 최신 회차 찾기
    let actualLatest = estimated;
    for (let round = estimated; round > estimated - 10; round--) {
      const result = await fetchDraw(round);
      if (result) {
        actualLatest = round;
        break;
      }
    }

    const startRound = storedLatest + 1;

    if (startRound > actualLatest) {
      return NextResponse.json({
        message: 'Already up to date',
        storedLatest,
        actualLatest,
        synced: 0,
      });
    }

    // 배치로 가져와서 upsert
    const BATCH_SIZE = 10;
    const allDraws: LottoDrawResult[] = [];

    for (let r = startRound; r <= actualLatest; r += BATCH_SIZE) {
      const batchEnd = Math.min(r + BATCH_SIZE - 1, actualLatest);
      const rounds: number[] = [];
      for (let i = r; i <= batchEnd; i++) rounds.push(i);

      const batchResults = await Promise.all(rounds.map(round => fetchDraw(round)));
      const validResults = batchResults.filter((d): d is LottoDrawResult => d !== null);
      allDraws.push(...validResults);

      // 배치 간 딜레이
      if (batchEnd < actualLatest) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    const synced = await upsertDraws(allDraws);

    return NextResponse.json({
      message: `Synced ${synced} rounds`,
      storedLatest,
      actualLatest,
      synced,
      range: { from: startRound, to: actualLatest },
    });
  } catch (error) {
    console.error('Sync error:', error);
    return NextResponse.json(
      { error: 'Sync failed' },
      { status: 500 },
    );
  }
}
