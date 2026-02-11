import { NextRequest, NextResponse } from 'next/server';
import { getRecentDraws, getDrawsInRange } from '@/lib/supabase';
import {
  GenerateCombinationsRequest,
  CombinationGenerationResult,
} from '@/types/lotto';
import {
  getFrequencyTable,
  filterCandidateNumbers,
  generateCombinationsFromRanges,
  splitAndCombine,
  filterByHistoricalMatch,
  toCombination,
} from '@/lib/combination-generator';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as GenerateCombinationsRequest;

    const {
      startRound,
      endRound,
      recentRoundsToExclude = 2,
      recentWindowSize = 10,
      minRangeCount = 0,
      maxRangeCount = 2,
    } = body;

    // 당첨 데이터 가져오기
    let draws;
    if (startRound && endRound) {
      draws = await getDrawsInRange(startRound, endRound);
    } else {
      draws = await getRecentDraws(100);
    }

    // 최신순 정렬
    draws.sort((a, b) => b.round - a.round);

    // 빈도 테이블 생성
    const { byRange } = getFrequencyTable(draws);

    // 후보 번호 필터링
    const { candidates, allCandidates } = filterCandidateNumbers(
      byRange,
      draws,
      recentWindowSize,
      recentRoundsToExclude,
    );

    // 범대별 조합 생성
    let combos = generateCombinationsFromRanges(
      candidates,
      minRangeCount,
      maxRangeCount,
    );

    // 후보가 부족하면 15개씩 분할 조합
    if (combos.length === 0 && allCandidates.length >= 6) {
      combos = splitAndCombine(allCandidates, 15);
    }

    // 과거 당첨번호와 비교하여 필터링
    const { filtered, beforeCount, afterCount } = filterByHistoricalMatch(
      combos,
      draws,
      3,
    );

    // 결과 변환
    const filteredCombinations = filtered.slice(0, 500).map((nums, i) =>
      toCombination(nums, `gen-${i}`),
    );

    const result: CombinationGenerationResult = {
      totalCombinations: combos.length,
      filteredCombinations,
      match5Combinations: [],
      match4Combinations: [],
      statistics: {
        beforeFilter: beforeCount,
        afterFilter: afterCount,
        excluded: beforeCount - afterCount,
      },
    };

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error generating combinations:', error);
    return NextResponse.json(
      { error: 'Failed to generate combinations' },
      { status: 500 },
    );
  }
}
