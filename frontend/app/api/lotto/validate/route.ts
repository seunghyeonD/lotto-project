import { NextRequest, NextResponse } from 'next/server';
import { getDrawsInRange } from '@/lib/supabase';
import {
  LottoNumber,
  CombinationValidationResult,
} from '@/types/lotto';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { numbers, startRound, endRound } = body as {
      numbers: LottoNumber[];
      startRound: number;
      endRound: number;
    };

    if (!numbers || numbers.length !== 6 || !startRound || !endRound) {
      return NextResponse.json(
        { error: 'Invalid request: need numbers (6), startRound, endRound' },
        { status: 400 },
      );
    }

    const draws = await getDrawsInRange(startRound, endRound);

    const results: CombinationValidationResult[] = draws.map(draw => {
      const matchedNumbers = numbers.filter(n => draw.numbers.includes(n));
      return {
        isValid: true,
        matchCount: matchedNumbers.length,
        matchedNumbers,
        round: draw.round,
      };
    });

    return NextResponse.json(results);
  } catch (error) {
    console.error('Error validating combination:', error);
    return NextResponse.json(
      { error: 'Failed to validate combination' },
      { status: 500 },
    );
  }
}
