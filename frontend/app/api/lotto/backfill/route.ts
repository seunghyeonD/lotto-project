import { NextRequest, NextResponse } from 'next/server';
import { fetchDraws } from '@/lib/lotto-fetcher';
import { upsertDraws, getStoredRounds } from '@/lib/supabase';
import { validateSession } from '@/lib/api-auth';

export async function POST(request: NextRequest) {
  const authError = await validateSession(request);
  if (authError) return authError;

  try {
    const { startRound = 1, endRound = 214 } = await request.json();

    if (startRound < 1 || endRound < startRound || endRound - startRound > 500) {
      return NextResponse.json(
        { error: 'Invalid range (max 500 rounds per request)' },
        { status: 400 },
      );
    }

    // DB에서 이미 저장된 회차 조회
    const storedRounds = await getStoredRounds(startRound, endRound);
    const storedSet = new Set(storedRounds);

    // 누락된 회차만 필터링
    const missingRounds: number[] = [];
    for (let r = startRound; r <= endRound; r++) {
      if (!storedSet.has(r)) missingRounds.push(r);
    }

    if (missingRounds.length === 0) {
      return NextResponse.json({
        message: 'No missing rounds',
        range: { startRound, endRound },
        missing: 0,
        synced: 0,
      });
    }

    // 누락 회차 동행복권 API에서 가져오기
    const draws = await fetchDraws(missingRounds[0], missingRounds[missingRounds.length - 1]);

    if (draws.length > 0) {
      await upsertDraws(draws);
    }

    return NextResponse.json({
      message: `Backfilled ${draws.length} rounds`,
      range: { startRound, endRound },
      missing: missingRounds.length,
      synced: draws.length,
    });
  } catch (error) {
    console.error('Backfill error:', error);
    return NextResponse.json(
      { error: 'Backfill failed' },
      { status: 500 },
    );
  }
}
