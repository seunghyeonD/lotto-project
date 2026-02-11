import { NextResponse } from 'next/server';
import { getDrawStats } from '@/lib/supabase';

export async function GET() {
  try {
    const { totalRounds, latestRound } = await getDrawStats();

    return NextResponse.json({
      status: 'ok',
      totalRounds,
      latestRound,
    });
  } catch (error) {
    console.error('Health check error:', error);
    return NextResponse.json(
      { status: 'error', error: 'Health check failed' },
      { status: 500 },
    );
  }
}
