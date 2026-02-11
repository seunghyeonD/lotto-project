import { NextRequest, NextResponse } from 'next/server';
import { getDrawsInRange, getRecentDraws } from '@/lib/supabase';
import { LottoDrawResult, NumberStatistics, NumberRange } from '@/types/lotto';

function getNumberRange(num: number): NumberRange {
  if (num >= 1 && num <= 9) return NumberRange.DAN;
  if (num >= 10 && num <= 19) return NumberRange.SIP;
  if (num >= 20 && num <= 29) return NumberRange.I;
  if (num >= 30 && num <= 39) return NumberRange.SAM;
  return NumberRange.SA;
}

function computeStatistics(draws: LottoDrawResult[]): NumberStatistics[] {
  const stats: NumberStatistics[] = [];

  for (let num = 1; num <= 45; num++) {
    let count = 0;
    let lastAppeared = 0;
    const recentAppearances: number[] = [];

    for (const draw of draws) {
      if (draw.numbers.includes(num)) {
        count++;
        if (draw.round > lastAppeared) lastAppeared = draw.round;
        recentAppearances.push(draw.round);
      }
    }

    stats.push({
      number: num,
      count,
      range: getNumberRange(num),
      lastAppeared,
      recentAppearances: recentAppearances.sort((a, b) => b - a).slice(0, 10),
    });
  }

  return stats;
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const start = searchParams.get('start');
    const end = searchParams.get('end');

    let draws: LottoDrawResult[];

    if (start && end) {
      draws = await getDrawsInRange(parseInt(start, 10), parseInt(end, 10));
    } else {
      draws = await getRecentDraws(100);
    }

    const statistics = computeStatistics(draws);
    return NextResponse.json(statistics);
  } catch (error) {
    console.error('Error computing statistics:', error);
    return NextResponse.json(
      { error: 'Failed to compute statistics' },
      { status: 500 },
    );
  }
}
