/**
 * 조합 생성 유틸리티
 * 기획안의 로또 번호 조합 생성 로직을 구현
 */

import {
  LottoNumber,
  LottoDrawResult,
  LottoCombination,
  FrequencyEntry,
  FrequencyRow,
  CombinationGroup,
  NumberRange,
} from '@/types/lotto';

type RangeKey = '단' | '십' | '이' | '삼' | '사';

const RANGE_KEYS: RangeKey[] = ['단', '십', '이', '삼', '사'];

/**
 * 번호의 범대를 반환
 */
export function getNumberRange(num: LottoNumber): RangeKey {
  if (num >= 1 && num <= 9) return '단';
  if (num >= 10 && num <= 19) return '십';
  if (num >= 20 && num <= 29) return '이';
  if (num >= 30 && num <= 39) return '삼';
  if (num >= 40 && num <= 45) return '사';
  return '단';
}

/**
 * 100주 당첨 데이터에서 번호별 출현 빈도를 계산하고
 * 빈도 순으로 정렬, 범대별로 그룹핑한 결과 반환
 */
export function getFrequencyTable(
  draws: LottoDrawResult[],
  rangeSize: number = 100,
): {
  table: FrequencyRow[];
  byRange: Record<RangeKey, FrequencyEntry[]>;
  count45: number;
} {
  const targetDraws = draws.slice(0, rangeSize);

  // 번호별 출현 횟수 계산
  const frequencyMap: Record<number, number> = {};
  for (let i = 1; i <= 45; i++) frequencyMap[i] = 0;

  for (const draw of targetDraws) {
    for (const num of draw.numbers) {
      frequencyMap[num] = (frequencyMap[num] || 0) + 1;
    }
  }

  const count45 = frequencyMap[45] || 0;

  // 범대별로 그룹핑하고 빈도 순으로 정렬
  const byRange: Record<RangeKey, FrequencyEntry[]> = {
    '단': [],
    '십': [],
    '이': [],
    '삼': [],
    '사': [],
  };

  for (let num = 1; num <= 45; num++) {
    const range = getNumberRange(num);
    byRange[range].push({ number: num as LottoNumber, count: frequencyMap[num] });
  }

  // 각 범대 내에서 빈도 순으로 정렬 (내림차순)
  for (const key of RANGE_KEYS) {
    byRange[key].sort((a, b) => b.count - a.count);
  }

  // 표 형태로 변환 (최대 행 수 = 가장 많은 범대의 번호 개수)
  const maxRows = Math.max(...RANGE_KEYS.map((k) => byRange[k].length));
  const table: FrequencyRow[] = [];

  for (let i = 0; i < maxRows; i++) {
    table.push({
      rank: i + 1,
      '단': byRange['단'][i] || null,
      '십': byRange['십'][i] || null,
      '이': byRange['이'][i] || null,
      '삼': byRange['삼'][i] || null,
      '사': byRange['사'][i] || null,
      count45,
    });
  }

  return { table, byRange, count45 };
}

/**
 * 최근 N주 내 출현한 번호 목록 반환
 */
export function getRecentNumbers(
  draws: LottoDrawResult[],
  windowSize: number,
): Set<LottoNumber> {
  const recentDraws = draws.slice(0, windowSize);
  const numbers = new Set<LottoNumber>();

  for (const draw of recentDraws) {
    for (const num of draw.numbers) {
      numbers.add(num);
    }
  }

  return numbers;
}

/**
 * 번호 필터링 로직:
 * 빈도순 정렬된 전체 번호에서 10주 내 미출현 번호 삭제, 최근 2주 번호 제외
 *
 * - 각 범대의 모든 번호를 빈도순으로 순회
 * - 10주 내 나온 번호만 남김
 * - 최근 2주 번호 제외
 */
export function filterCandidateNumbers(
  byRange: Record<RangeKey, FrequencyEntry[]>,
  draws: LottoDrawResult[],
  recentWindowSize: number = 10,
  excludeRecentWeeks: number = 2,
): {
  candidates: Record<RangeKey, LottoNumber[]>;
  allCandidates: LottoNumber[];
  recentNumbers: Set<LottoNumber>;
  excludedNumbers: Set<LottoNumber>;
} {
  const recentNumbers = getRecentNumbers(draws, recentWindowSize);
  const excludedNumbers = getRecentNumbers(draws, excludeRecentWeeks);

  const candidates: Record<RangeKey, LottoNumber[]> = {
    '단': [],
    '십': [],
    '이': [],
    '삼': [],
    '사': [],
  };

  const allCandidates: LottoNumber[] = [];

  for (const key of RANGE_KEYS) {
    const entries = byRange[key];
    for (const entry of entries) {
      // 10주 내에 나온 번호만 포함
      if (!recentNumbers.has(entry.number)) continue;
      // 최근 2주 번호 제외
      if (excludedNumbers.has(entry.number)) continue;

      candidates[key].push(entry.number);
      allCandidates.push(entry.number);
    }
  }

  allCandidates.sort((a, b) => a - b);

  return {
    candidates,
    allCandidates,
    recentNumbers,
    excludedNumbers,
  };
}

/**
 * 범대별 후보에서 0~2개씩 선택하여 총 6개인 조합 생성
 */
export function generateCombinationsFromRanges(
  candidates: Record<RangeKey, LottoNumber[]>,
  minPerRange: number = 0,
  maxPerRange: number = 2,
): LottoNumber[][] {
  const results: LottoNumber[][] = [];

  // 각 범대에서 가능한 선택 조합 생성
  function getCombinations(arr: LottoNumber[], k: number): LottoNumber[][] {
    if (k === 0) return [[]];
    if (arr.length < k) return [];
    const result: LottoNumber[][] = [];
    for (let i = 0; i <= arr.length - k; i++) {
      const rest = getCombinations(arr.slice(i + 1), k - 1);
      for (const combo of rest) {
        result.push([arr[i], ...combo]);
      }
    }
    return result;
  }

  // 각 범대에서 0~2개 선택하는 모든 경우의 수
  function generateRange(rangeIdx: number, current: LottoNumber[], remaining: number): void {
    if (rangeIdx === RANGE_KEYS.length) {
      if (remaining === 0) {
        results.push([...current].sort((a, b) => a - b));
      }
      return;
    }

    const key = RANGE_KEYS[rangeIdx];
    const nums = candidates[key];
    const min = Math.min(minPerRange, nums.length);
    const max = Math.min(maxPerRange, nums.length, remaining);

    for (let pick = min; pick <= max; pick++) {
      if (remaining - pick < 0) continue;
      // 남은 범대에서 최대로 뽑을 수 있는 수
      const remainingRanges = RANGE_KEYS.length - rangeIdx - 1;
      const maxFromRemaining = remainingRanges * maxPerRange;
      if (remaining - pick > maxFromRemaining) continue;

      const combos = getCombinations(nums, pick);
      for (const combo of combos) {
        generateRange(rangeIdx + 1, [...current, ...combo], remaining - pick);
      }
    }
  }

  generateRange(0, [], 6);
  return results;
}

/**
 * 숫자 배열에서 n개를 선택하는 조합 (C(n,k))
 */
function combinations(arr: LottoNumber[], k: number): LottoNumber[][] {
  if (k === 0) return [[]];
  if (arr.length < k) return [];
  const result: LottoNumber[][] = [];
  for (let i = 0; i <= arr.length - k; i++) {
    const rest = combinations(arr.slice(i + 1), k - 1);
    for (const combo of rest) {
      result.push([arr[i], ...combo]);
    }
  }
  return result;
}

/**
 * 15개 단위로 쪼개서 C(15,6) 조합 생성
 */
export function splitAndCombine(
  numbers: LottoNumber[],
  groupSize: number = 15,
): LottoNumber[][] {
  const sorted = [...numbers].sort((a, b) => a - b);
  const allCombinations: LottoNumber[][] = [];

  for (let i = 0; i < sorted.length; i += groupSize) {
    const group = sorted.slice(i, i + groupSize);
    if (group.length < 6) continue;
    const combos = combinations(group, 6);
    allCombinations.push(...combos);
  }

  return allCombinations;
}

/**
 * 과거 100회와 비교하여 matchThreshold개 이상 일치하는 조합 제외
 */
export function filterByHistoricalMatch(
  combos: LottoNumber[][],
  draws: LottoDrawResult[],
  matchThreshold: number = 3,
): {
  filtered: LottoNumber[][];
  excluded: LottoNumber[][];
  beforeCount: number;
  afterCount: number;
} {
  const drawNumberSets = draws.map((d) => new Set(d.numbers));
  const filtered: LottoNumber[][] = [];
  const excluded: LottoNumber[][] = [];

  for (const combo of combos) {
    let shouldExclude = false;
    for (const drawSet of drawNumberSets) {
      let matchCount = 0;
      for (const num of combo) {
        if (drawSet.has(num)) matchCount++;
      }
      if (matchCount >= matchThreshold) {
        shouldExclude = true;
        break;
      }
    }
    if (shouldExclude) {
      excluded.push(combo);
    } else {
      filtered.push(combo);
    }
  }

  return {
    filtered,
    excluded,
    beforeCount: combos.length,
    afterCount: filtered.length,
  };
}

/**
 * sharedCount개의 같은 번호를 공유하는 조합끼리 그룹핑
 */
export function groupBySharedNumbers(
  combos: LottoNumber[][],
  sharedCount: number,
): CombinationGroup[] {
  const groups: CombinationGroup[] = [];
  const used = new Set<number>();

  for (let i = 0; i < combos.length; i++) {
    if (used.has(i)) continue;

    const group: LottoNumber[][] = [combos[i]];
    const baseSet = new Set(combos[i]);

    for (let j = i + 1; j < combos.length; j++) {
      if (used.has(j)) continue;

      // 현재 그룹의 첫 번째 조합과 sharedCount개 이상 공유하는지 확인
      let shared = 0;
      const sharedNums: LottoNumber[] = [];
      for (const num of combos[j]) {
        if (baseSet.has(num)) {
          shared++;
          sharedNums.push(num);
        }
      }

      if (shared >= sharedCount) {
        group.push(combos[j]);
        used.add(j);
      }
    }

    if (group.length > 1) {
      // 공유 번호 찾기
      const sharedNumbers: LottoNumber[] = combos[i].filter((num) =>
        group.every((combo) => combo.includes(num)),
      );

      used.add(i);
      groups.push({
        sharedNumbers: sharedNumbers.sort((a, b) => a - b),
        combinations: group.map((nums, idx) => ({
          id: `group-${i}-${idx}`,
          numbers: nums,
          rangeDistribution: getRangeDistribution(nums),
        })),
        sharedCount,
      });
    }
  }

  return groups;
}

/**
 * 정확히 exactCount개의 같은 번호를 공유하는 조합끼리 그룹핑
 * 각 조합에서 가능한 모든 exactCount개 부분집합을 키로 사용하여 그룹핑
 */
export function groupByExactSharedCount(
  combos: LottoNumber[][],
  exactCount: number,
): CombinationGroup[] {
  // 각 조합에서 exactCount개짜리 부분집합을 모두 구해서 맵에 저장
  const subsetMap = new Map<string, Set<number>>();

  for (let i = 0; i < combos.length; i++) {
    const subs = subsets(combos[i], exactCount);
    for (const sub of subs) {
      const key = sub.join(',');
      if (!subsetMap.has(key)) {
        subsetMap.set(key, new Set());
      }
      subsetMap.get(key)!.add(i);
    }
  }

  // 2개 이상의 조합이 포함된 부분집합만 그룹으로 변환
  // 단, 그룹 내 조합들이 정확히 exactCount개만 공유하는지 확인 (더 많이 공유하는 쌍은 제외)
  const groups: CombinationGroup[] = [];
  const seen = new Set<string>();

  // 그룹 크기 내림차순으로 정렬
  const entries = Array.from(subsetMap.entries())
    .filter(([, indices]) => indices.size > 1)
    .sort((a, b) => b[1].size - a[1].size);

  for (const [key, indices] of entries) {
    if (seen.has(key)) continue;
    seen.add(key);

    const sharedNumbers = key.split(',').map(Number) as LottoNumber[];
    // 그룹 내 조합들 중 정확히 exactCount개만 공유하는 조합만 필터
    const comboIndices = Array.from(indices);
    const validCombos: LottoNumber[][] = [];

    for (const idx of comboIndices) {
      const combo = combos[idx];
      // 공유 번호가 정확히 exactCount개인지 확인 (sharedNumbers 외 다른 번호는 다름)
      const sharedSet = new Set(sharedNumbers);
      const overlap = combo.filter((n) => sharedSet.has(n)).length;
      if (overlap === exactCount) {
        validCombos.push(combo);
      }
    }

    if (validCombos.length >= 2) {
      groups.push({
        sharedNumbers: sharedNumbers.sort((a, b) => a - b),
        combinations: validCombos.map((nums, idx) => ({
          id: `g3-${key}-${idx}`,
          numbers: nums,
          rangeDistribution: getRangeDistribution(nums),
        })),
        sharedCount: exactCount,
      });
    }
  }

  return groups;
}

/**
 * 배열에서 k개를 선택하는 모든 부분집합 (정렬된 상태)
 */
function subsets(arr: LottoNumber[], k: number): LottoNumber[][] {
  if (k === 0) return [[]];
  if (arr.length < k) return [];
  const result: LottoNumber[][] = [];
  const sorted = [...arr].sort((a, b) => a - b);
  for (let i = 0; i <= sorted.length - k; i++) {
    const rest = subsets(sorted.slice(i + 1), k - 1);
    for (const sub of rest) {
      result.push([sorted[i], ...sub]);
    }
  }
  return result;
}

/**
 * 번호 배열의 범대 분포 반환
 */
function getRangeDistribution(numbers: LottoNumber[]) {
  const dist = { '단': 0, '십': 0, '이': 0, '삼': 0, '사': 0 };
  for (const num of numbers) {
    const range = getNumberRange(num);
    dist[range]++;
  }
  return dist;
}

/**
 * LottoNumber[]를 LottoCombination으로 변환
 */
export function toCombination(numbers: LottoNumber[], id: string): LottoCombination {
  return {
    id,
    numbers: [...numbers].sort((a, b) => a - b),
    rangeDistribution: getRangeDistribution(numbers),
  };
}
