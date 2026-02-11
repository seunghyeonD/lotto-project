import { NextResponse } from 'next/server';
import { getDrawByRound } from '@/lib/supabase';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ round: string }> },
) {
  try {
    const { round: roundStr } = await params;
    const round = parseInt(roundStr, 10);

    if (isNaN(round) || round < 1) {
      return NextResponse.json(
        { error: 'Invalid round number' },
        { status: 400 },
      );
    }

    const draw = await getDrawByRound(round);

    if (!draw) {
      return NextResponse.json(
        { error: `Round ${round} not found` },
        { status: 404 },
      );
    }

    return NextResponse.json(draw);
  } catch (error) {
    console.error('Error fetching draw:', error);
    return NextResponse.json(
      { error: 'Failed to fetch draw' },
      { status: 500 },
    );
  }
}
