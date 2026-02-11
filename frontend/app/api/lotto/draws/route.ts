import { NextRequest, NextResponse } from 'next/server';
import { upsertDraws } from '@/lib/supabase';
import { LottoDrawResult } from '@/types/lotto';

export async function POST(request: NextRequest) {
  try {
    const draw = await request.json() as LottoDrawResult;

    if (!draw.round || !draw.drawDate || !draw.numbers || !draw.bonusNumber) {
      return NextResponse.json(
        { error: 'Invalid draw data' },
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
