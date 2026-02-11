import { NextRequest, NextResponse } from 'next/server';
import { getDrawsInRange } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const start = parseInt(searchParams.get('start') || '0', 10);
    const end = parseInt(searchParams.get('end') || '0', 10);

    if (!start || !end || start < 1 || end < start) {
      return NextResponse.json(
        { error: 'Invalid start/end parameters' },
        { status: 400 },
      );
    }

    if (end - start + 1 > 1000) {
      return NextResponse.json(
        { error: 'Range too large (max 1000)' },
        { status: 400 },
      );
    }

    const draws = await getDrawsInRange(start, end);
    return NextResponse.json(draws);
  } catch (error) {
    console.error('Error fetching draws in range:', error);
    return NextResponse.json(
      { error: 'Failed to fetch draws' },
      { status: 500 },
    );
  }
}
