/**
 * 서버사이드 동행복권 API 호출 유틸
 * Next.js API Route에서만 사용 (CORS 우회)
 */

import { LottoDrawResult } from '@/types/lotto';

const DHLOTTERY_API = 'https://www.dhlottery.co.kr/common.do';

/**
 * 특정 회차의 당첨번호 가져오기
 */
export async function fetchDraw(round: number): Promise<LottoDrawResult | null> {
  try {
    const url = `${DHLOTTERY_API}?method=getLottoNumber&drwNo=${round}`;
    const response = await fetch(url, {
      headers: { 'Accept': 'application/json' },
    });

    if (!response.ok) return null;

    const data = await response.json();
    if (data.returnValue !== 'success') return null;

    return {
      round: data.drwNo,
      drawDate: data.drwNoDate,
      numbers: [
        data.drwtNo1, data.drwtNo2, data.drwtNo3,
        data.drwtNo4, data.drwtNo5, data.drwtNo6,
      ].sort((a: number, b: number) => a - b),
      bonusNumber: data.bnusNo,
    };
  } catch (error) {
    console.error(`Failed to fetch round ${round}:`, error);
    return null;
  }
}

/**
 * 여러 회차 병렬 가져오기 (배치 단위)
 */
export async function fetchDraws(
  startRound: number,
  endRound: number,
): Promise<LottoDrawResult[]> {
  const rounds: number[] = [];
  for (let r = startRound; r <= endRound; r++) rounds.push(r);

  const BATCH_SIZE = 10;
  const results: LottoDrawResult[] = [];

  for (let i = 0; i < rounds.length; i += BATCH_SIZE) {
    const batch = rounds.slice(i, i + BATCH_SIZE);
    const batchResults = await Promise.all(batch.map(r => fetchDraw(r)));
    for (const result of batchResults) {
      if (result) results.push(result);
    }
    if (i + BATCH_SIZE < rounds.length) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  return results;
}

/**
 * 최신 회차 추정
 */
export function estimateLatestRound(): number {
  const firstDrawDate = new Date('2002-12-07');
  const today = new Date();
  const daysDiff = Math.floor(
    (today.getTime() - firstDrawDate.getTime()) / (1000 * 60 * 60 * 24),
  );
  return Math.floor(daysDiff / 7) + 1;
}

/**
 * 최신 회차 확인 (추정 후 검증)
 */
export async function getLatestRound(): Promise<number> {
  const estimated = estimateLatestRound();

  for (let round = estimated; round > estimated - 10; round--) {
    const result = await fetchDraw(round);
    if (result) return round;
  }

  return estimated;
}

/**
 * 최근 N회차 가져오기
 */
export async function fetchRecentDraws(count: number): Promise<LottoDrawResult[]> {
  const latestRound = await getLatestRound();
  const startRound = Math.max(1, latestRound - count + 1);

  const results = await fetchDraws(startRound, latestRound);
  return results.sort((a, b) => b.round - a.round);
}
