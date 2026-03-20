import { NextResponse } from 'next/server';
import { getRecentDraws } from '@/lib/supabase';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ count: string }> },
) {
  try {
    const { count: countStr } = await params;
    const count = parseInt(countStr, 10);

    if (isNaN(count) || count < 1 || count > 2000) {
      return NextResponse.json(
        { error: 'count must be between 1 and 2000' },
        { status: 400 },
      );
    }

    const draws = await getRecentDraws(count);
    return NextResponse.json(draws);
  } catch (error) {
    console.error('Error fetching recent draws:', error);
    return NextResponse.json(
      { error: 'Failed to fetch recent draws' },
      { status: 500 },
    );
  }
}
