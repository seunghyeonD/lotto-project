import { NextRequest, NextResponse } from 'next/server';
import { upsertDraws } from '@/lib/supabase';
import { LottoDrawResult } from '@/types/lotto';
import { validateSession } from '@/lib/api-auth';

function validateDrawData(draw: any): string | null {
  if (!draw.round || typeof draw.round !== 'number' || draw.round < 1) {
    return '회차 번호는 1 이상의 숫자여야 합니다.';
  }

  if (!draw.drawDate || typeof draw.drawDate !== 'string') {
    return '추첨일이 필요합니다.';
  }

  if (!Array.isArray(draw.numbers) || draw.numbers.length !== 6) {
    return '당첨 번호는 정확히 6개여야 합니다.';
  }

  if (!draw.numbers.every((n: any) => typeof n === 'number' && n >= 1 && n <= 45)) {
    return '당첨 번호는 1~45 사이의 숫자여야 합니다.';
  }

  const uniqueNumbers = new Set(draw.numbers);
  if (uniqueNumbers.size !== 6) {
    return '당첨 번호에 중복이 있습니다.';
  }

  if (typeof draw.bonusNumber !== 'number' || draw.bonusNumber < 1 || draw.bonusNumber > 45) {
    return '보너스 번호는 1~45 사이의 숫자여야 합니다.';
  }

  if (draw.numbers.includes(draw.bonusNumber)) {
    return '보너스 번호는 당첨 번호와 중복될 수 없습니다.';
  }

  return null;
}

export async function POST(request: NextRequest) {
  const authError = await validateSession(request);
  if (authError) return authError;

  try {
    const draw = await request.json() as LottoDrawResult;

    const validationError = validateDrawData(draw);
    if (validationError) {
      return NextResponse.json(
        { error: validationError },
        { status: 400 },
      );
    }

    await upsertDraws([draw]);
    return NextResponse.json({ success: true, round: draw.round });
  } catch (error) {
    console.error('Error adding draw:', error);
    return NextResponse.json(
      { error: 'Failed to add draw' },
      { status: 500 },
    );
  }
}
