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
      // 최근 2주 번호 제외 (주석처리: 제외 로직 비활성화)
      // if (excludedNumbers.has(entry.number)) continue;

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
 * 인덱스 기반으로 배열 slice/spread 없이 생성
 */
function combinations(arr: LottoNumber[], k: number): LottoNumber[][] {
  const n = arr.length;
  if (k === 0) return [[]];
  if (n < k) return [];
  const result: LottoNumber[][] = [];
  const indices = new Array<number>(k);
  for (let i = 0; i < k; i++) indices[i] = i;

  while (true) {
    const combo = new Array<LottoNumber>(k);
    for (let i = 0; i < k; i++) combo[i] = arr[indices[i]];
    result.push(combo);

    let i = k - 1;
    while (i >= 0 && indices[i] === n - k + i) i--;
    if (i < 0) break;
    indices[i]++;
    for (let j = i + 1; j < k; j++) indices[j] = indices[j - 1] + 1;
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
 * 비동기 버전 - sharedCount개의 같은 번호를 공유하는 조합끼리 그룹핑
 * 최적화: sharedCount 4/5는 해시 기반 O(N*C(6,k)), 그 외는 O(N²) + yield 개선
 */
export async function groupBySharedNumbersAsync(
  combos: LottoNumber[][],
  sharedCount: number,
  onProgress?: (progress: number) => void,
  chunkSize: number = 500,
): Promise<CombinationGroup[]> {
  const total = combos.length;
  if (total === 0) return [];

  // sharedCount 4/5: 해시 기반 접근 (O(N²) 제거)
  if (sharedCount === 5 || sharedCount === 4) {
    const subsetMap = new Map<number, number[]>();

    // 1단계: 부분집합 맵 구축 (50%)
    for (let ci = 0; ci < total; ci++) {
      if (ci % chunkSize === 0) {
        await new Promise(r => setTimeout(r, 0));
        onProgress?.(Math.round((ci / total) * 50));
      }
      const c = combos[ci];

      if (sharedCount === 5) {
        // C(6,5)=6: skip 하나씩
        for (let skip = 0; skip < 6; skip++) {
          let key = 0;
          for (let j = 0; j < 6; j++) {
            if (j !== skip) key = key * 46 + c[j];
          }
          const arr = subsetMap.get(key);
          if (arr) arr.push(ci); else subsetMap.set(key, [ci]);
        }
      } else {
        // C(6,4)=15
        for (let a = 0; a < 3; a++) {
          for (let b = a + 1; b < 4; b++) {
            for (let d = b + 1; d < 5; d++) {
              for (let e = d + 1; e < 6; e++) {
                const key = c[a] * 97336 + c[b] * 2116 + c[d] * 46 + c[e];
                const arr = subsetMap.get(key);
                if (arr) arr.push(ci); else subsetMap.set(key, [ci]);
              }
            }
          }
        }
      }
    }

    // 2단계: 크기순 정렬 후 그리디 그룹핑 (50%)
    const entries: [number, number[]][] = [];
    for (const [key, indices] of subsetMap) {
      if (indices.length > 1) entries.push([key, indices]);
    }
    subsetMap.clear();
    entries.sort((a, b) => b[1].length - a[1].length);

    const used = new Set<number>();
    const groups: CombinationGroup[] = [];
    const entriesTotal = entries.length;

    for (let ei = 0; ei < entriesTotal; ei++) {
      if (ei % chunkSize === 0) {
        await new Promise(r => setTimeout(r, 0));
        onProgress?.(50 + Math.round((ei / entriesTotal) * 50));
      }

      const indices = entries[ei][1];
      const available = indices.filter(idx => !used.has(idx));
      if (available.length < 2) continue;

      // 첫 번째 조합 기준으로 sharedCount개 이상 공유하는 조합만 선택
      const baseSet = new Set(combos[available[0]]);
      const groupIndices = [available[0]];

      for (let k = 1; k < available.length; k++) {
        let shared = 0;
        for (const num of combos[available[k]]) {
          if (baseSet.has(num)) shared++;
        }
        if (shared >= sharedCount) groupIndices.push(available[k]);
      }

      if (groupIndices.length < 2) continue;

      const sharedNumbers = combos[groupIndices[0]].filter(num =>
        groupIndices.every(idx => combos[idx].includes(num)),
      ) as LottoNumber[];

      for (const idx of groupIndices) used.add(idx);

      groups.push({
        sharedNumbers: sharedNumbers.sort((a, b) => a - b),
        combinations: groupIndices.map((idx, ci) => ({
          id: `group-${idx}-${ci}`,
          numbers: combos[idx],
          rangeDistribution: getRangeDistribution(combos[idx]),
        })),
        sharedCount,
      });
    }

    onProgress?.(100);
    return groups;
  }

  // 기타 sharedCount: O(N²) + 내부 루프 yield 개선
  const groups: CombinationGroup[] = [];
  const used = new Set<number>();
  let ops = 0;

  for (let i = 0; i < total; i++) {
    if (i % 100 === 0) {
      await new Promise(r => setTimeout(r, 0));
      onProgress?.(Math.round((i / total) * 100));
    }

    if (used.has(i)) continue;
    const group: LottoNumber[][] = [combos[i]];
    const baseSet = new Set(combos[i]);

    for (let j = i + 1; j < total; j++) {
      if (used.has(j)) continue;
      let shared = 0;
      for (const num of combos[j]) {
        if (baseSet.has(num)) { shared++; if (shared >= sharedCount) break; }
      }
      if (shared >= sharedCount) { group.push(combos[j]); used.add(j); }

      // 내부 루프에서도 주기적으로 yield (멈춤 방지)
      ops++;
      if (ops % 5000 === 0) {
        await new Promise(r => setTimeout(r, 0));
      }
    }

    if (group.length > 1) {
      const sharedNumbers = combos[i].filter(num =>
        group.every(combo => combo.includes(num)),
      ) as LottoNumber[];
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

  onProgress?.(100);
  return groups;
}

/**
 * 비동기 버전 - 정확히 exactCount개의 같은 번호를 공유하는 조합끼리 그룹핑
 * 최적화: 숫자 키 사용, 인라인 부분집합 생성, 결과 수 제한
 */
export async function groupByExactSharedCountAsync(
  combos: LottoNumber[][],
  exactCount: number,
  onProgress?: (progress: number) => void,
  chunkSize: number = 500,
  maxGroups: number = 200,
): Promise<CombinationGroup[]> {
  const subsetMap = new Map<number, number[]>();
  const total = combos.length;

  // 숫자 키 인코딩: 3개 번호(1-45)를 하나의 정수로 (n1*10000 + n2*100 + n3)
  // exactCount === 3 전용 최적화 (인라인 3중 루프)
  // 1단계: 부분집합 맵 구축 (60%)
  if (exactCount === 3) {
    for (let ci = 0; ci < total; ci++) {
      if (ci % chunkSize === 0) {
        await new Promise(resolve => setTimeout(resolve, 0));
        onProgress?.(Math.round((ci / total) * 60));
      }
      const c = combos[ci];
      // C(6,3) = 20 subsets, inline generation (combo is already sorted)
      for (let a = 0; a < 4; a++) {
        for (let b = a + 1; b < 5; b++) {
          for (let d = b + 1; d < 6; d++) {
            const key = c[a] * 10000 + c[b] * 100 + c[d];
            const arr = subsetMap.get(key);
            if (arr) {
              arr.push(ci);
            } else {
              subsetMap.set(key, [ci]);
            }
          }
        }
      }
    }
  } else {
    // 일반 exactCount에 대한 폴백
    for (let ci = 0; ci < total; ci++) {
      if (ci % chunkSize === 0) {
        await new Promise(resolve => setTimeout(resolve, 0));
        onProgress?.(Math.round((ci / total) * 60));
      }
      const subs = subsets(combos[ci], exactCount);
      for (const sub of subs) {
        const key = sub.join(',');
        const numKey = hashSubsetKey(key);
        const arr = subsetMap.get(numKey);
        if (arr) {
          arr.push(ci);
        } else {
          subsetMap.set(numKey, [ci]);
        }
      }
    }
  }

  // 2단계: 2개 이상 포함된 엔트리만 필터 후 크기순 정렬 (그룹 생성, 40%)
  const entries: [number, number[]][] = [];
  for (const [key, indices] of subsetMap) {
    if (indices.length > 1) {
      entries.push([key, indices]);
    }
  }
  // 메모리 해제
  subsetMap.clear();

  entries.sort((a, b) => b[1].length - a[1].length);

  const groups: CombinationGroup[] = [];
  const entriesTotal = entries.length;

  for (let i = 0; i < entriesTotal; i++) {
    if (groups.length >= maxGroups) break;

    if (i % chunkSize === 0) {
      await new Promise(resolve => setTimeout(resolve, 0));
      onProgress?.(60 + Math.round((i / entriesTotal) * 40));
    }

    const [numKey, indices] = entries[i];

    // 숫자 키에서 번호 복원
    let sharedNumbers: LottoNumber[];
    if (exactCount === 3) {
      const n3 = (numKey % 100) as LottoNumber;
      const n2 = (Math.floor(numKey / 100) % 100) as LottoNumber;
      const n1 = Math.floor(numKey / 10000) as LottoNumber;
      sharedNumbers = [n1, n2, n3];
    } else {
      // 폴백: 첫 번째 조합에서 공유 번호를 직접 계산
      const firstCombo = combos[indices[0]];
      const commonNums: LottoNumber[] = [];
      for (const num of firstCombo) {
        let inAll = true;
        for (let k = 1; k < Math.min(indices.length, 5); k++) {
          if (!combos[indices[k]].includes(num)) { inAll = false; break; }
        }
        if (inAll) commonNums.push(num);
      }
      sharedNumbers = commonNums.slice(0, exactCount);
    }

    const sharedSet = new Set(sharedNumbers);

    // 1차: 키 번호를 정확히 exactCount개 포함하는 조합만
    const candidatesInGroup: LottoNumber[][] = [];
    for (const idx of indices) {
      const combo = combos[idx];
      let overlap = 0;
      for (const n of combo) {
        if (sharedSet.has(n)) overlap++;
      }
      if (overlap === exactCount) {
        candidatesInGroup.push(combo);
      }
    }

    // 2차: 그룹 내 조합끼리 정확히 exactCount개만 공유 (그리디)
    const validCombos: LottoNumber[][] = [];
    for (const cand of candidatesInGroup) {
      let fits = true;
      for (const sel of validCombos) {
        if (countSharedNumbers(cand, sel) !== exactCount) { fits = false; break; }
      }
      if (fits) validCombos.push(cand);
    }

    if (validCombos.length >= 2) {
      groups.push({
        sharedNumbers,
        combinations: validCombos.map((nums, idx) => ({
          id: `g3-${numKey}-${idx}`,
          numbers: nums,
          rangeDistribution: getRangeDistribution(nums),
        })),
        sharedCount: exactCount,
      });
    }
  }

  onProgress?.(100);
  return groups;
}

/** 문자열 키를 간단한 숫자 해시로 변환 (폴백용) */
function hashSubsetKey(key: string): number {
  let hash = 0;
  for (let i = 0; i < key.length; i++) {
    hash = ((hash << 5) - hash + key.charCodeAt(i)) | 0;
  }
  return hash;
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
 * AC값(산술복잡도) 계산
 * 6개 번호에서 가능한 모든 쌍(15개)의 차이값 중 고유한 값의 수 - 5
 * 실제 당첨번호는 AC 7~10이 대부분
 */
export function calcAC(numbers: LottoNumber[]): number {
  const diffs = new Set<number>();
  for (let i = 0; i < numbers.length; i++) {
    for (let j = i + 1; j < numbers.length; j++) {
      diffs.add(Math.abs(numbers[i] - numbers[j]));
    }
  }
  return diffs.size - (numbers.length - 1); // AC = 고유차이수 - 5
}

/**
 * 조합에 확률 점수를 매기고 상위 조합을 반환
 *
 * 점수 기준 (9개 항목):
 * 1. 빈도 점수 (15%): 각 번호의 출현 빈도 합산
 * 2. 동반출현 (15%): 함께 자주 나오는 번호 쌍 보너스
 * 3. AC값 (15%): 산술복잡도 (번호 간 차이 다양성)
 * 4. 이월번호 (15%): 직전 회차에서 1~2개 포함 시 보너스
 * 5. 범대 균형 (10%): 다양한 범대 분포
 * 6. 합계 범위 (10%): 합계 80~200 범위
 * 7. 홀짝 균형 (10%): 홀짝 차이 완화
 * 8. 연속번호 (5%): 연속 쌍 1~2개 포함 시 보너스
 * 9. 끝수 다양성 (5%): 끝수가 다양할수록 높은 점수
 */
export interface ScoredCombination {
  numbers: LottoNumber[];
  score: number;
  details: {
    frequencyScore: number;
    coOccurrenceScore: number;
    acScore: number;
    carryoverScore: number;
    balanceScore: number;
    sumScore: number;
    oddEvenScore: number;
    consecutiveScore: number;
    lastDigitScore: number;
  };
}

/**
 * 점수 계산 사전 데이터 구조체
 * 빈도, 동반출현, 이월번호 등 사전 계산 결과를 담음
 */
interface ScoringContext {
  freq: Uint16Array;           // freq[n] = 번호 n의 출현 횟수
  invMaxFreq6: number;         // 100 / (maxFreq * 6) - 정규화 계수
  coOcc: Uint16Array;          // coOcc[a*46+b] = 번호쌍 (a,b)의 동반출현 횟수
  invMaxCoOcc15: number;       // 100 / (maxCoOcc * 15) - 정규화 계수
  lastDrawSet: Set<LottoNumber>;
  secondLastDrawSet: Set<LottoNumber>;
}

/** 점수 계산에 필요한 사전 데이터를 한 번만 계산 */
function buildScoringContext(draws: LottoDrawResult[]): ScoringContext {
  // 빈도: Uint16Array(46) - 인덱스 직접 접근 (O(1), 문자열 해시 불필요)
  const freq = new Uint16Array(46);
  for (const draw of draws) {
    for (const num of draw.numbers) freq[num]++;
  }
  let maxFreq = 0;
  for (let i = 1; i <= 45; i++) { if (freq[i] > maxFreq) maxFreq = freq[i]; }

  // 동반출현: Uint16Array(46*46) - coOcc[a*46+b] (a < b)
  // 문자열 키 Map 대신 Typed Array 사용 → GC 부하 제거, 룩업 O(1)
  const coOcc = new Uint16Array(46 * 46);
  for (const draw of draws) {
    const nums = draw.numbers;
    for (let i = 0; i < nums.length; i++) {
      for (let j = i + 1; j < nums.length; j++) {
        const a = nums[i] < nums[j] ? nums[i] : nums[j];
        const b = nums[i] < nums[j] ? nums[j] : nums[i];
        coOcc[a * 46 + b]++;
      }
    }
  }
  let maxCoOcc = 1;
  for (let i = 0; i < coOcc.length; i++) { if (coOcc[i] > maxCoOcc) maxCoOcc = coOcc[i]; }

  return {
    freq,
    invMaxFreq6: 100 / (maxFreq * 6),
    coOcc,
    invMaxCoOcc15: 100 / (maxCoOcc * 15),
    lastDrawSet: draws.length > 0 ? new Set(draws[0].numbers) : new Set<LottoNumber>(),
    secondLastDrawSet: draws.length > 1 ? new Set(draws[1].numbers) : new Set<LottoNumber>(),
  };
}

/** 32비트 정수의 세트 비트 수 (popcount) */
function popcount32(n: number): number {
  n = n - ((n >> 1) & 0x55555555);
  n = (n & 0x33333333) + ((n >> 2) & 0x33333333);
  return (((n + (n >> 4)) & 0x0F0F0F0F) * 0x01010101) >> 24;
}

/** 최소 힙 하향 조정 (top-N 선택용) */
function heapifyDown(heap: ScoredCombination[], i: number): void {
  const n = heap.length;
  while (true) {
    let smallest = i;
    const left = 2 * i + 1;
    const right = 2 * i + 2;
    if (left < n && heap[left].score < heap[smallest].score) smallest = left;
    if (right < n && heap[right].score < heap[smallest].score) smallest = right;
    if (smallest === i) break;
    const tmp = heap[i]; heap[i] = heap[smallest]; heap[smallest] = tmp;
    i = smallest;
  }
}

/**
 * 단일 조합의 점수를 계산 (인라인 최적화)
 * - 비트 연산으로 AC값 계산 (Set 생성 제거)
 * - combo가 정렬된 상태 전제 (불필요한 복사/정렬 제거)
 * - 이월번호: 직전 2회차 고려 (정확도 향상)
 * - AC값: 7단계 세분화 (정확도 향상)
 */
function scoreOneCombo(c: LottoNumber[], ctx: ScoringContext): ScoredCombination | null {
  // 합계 사전 필터 (극단값 조기 제외)
  const sum = c[0] + c[1] + c[2] + c[3] + c[4] + c[5];
  if (sum < 50 || sum > 240) return null;

  // === 1. 빈도 점수 (15%) ===
  const freqSum = ctx.freq[c[0]] + ctx.freq[c[1]] + ctx.freq[c[2]] +
                  ctx.freq[c[3]] + ctx.freq[c[4]] + ctx.freq[c[5]];
  const frequencyScore = freqSum * ctx.invMaxFreq6;

  // === 2. 동반출현 점수 (15%) - Typed Array 직접 룩업 ===
  let coOccSum = 0;
  for (let a = 0; a < 5; a++) {
    const ca46 = c[a] * 46;
    for (let b = a + 1; b < 6; b++) {
      coOccSum += ctx.coOcc[ca46 + c[b]]; // c는 정렬 상태이므로 c[a] < c[b]
    }
  }
  const coOccurrenceScore = coOccSum * ctx.invMaxCoOcc15;

  // === 3. AC값 점수 (15%) - 비트 연산으로 고유 차이값 카운트 ===
  let acBits0 = 0, acBits1 = 0;
  for (let a = 0; a < 5; a++) {
    for (let b = a + 1; b < 6; b++) {
      const diff = c[b] - c[a]; // 정렬 상태이므로 diff > 0
      if (diff < 32) acBits0 |= (1 << diff); else acBits1 |= (1 << (diff - 32));
    }
  }
  const ac = popcount32(acBits0) + popcount32(acBits1) - 5;
  // 세분화된 AC 점수 (실제 당첨번호 AC 분포: 7~10이 85%)
  let acScore: number;
  if (ac >= 9) acScore = 100;
  else if (ac === 8) acScore = 95;
  else if (ac === 7) acScore = 85;
  else if (ac === 6) acScore = 55;
  else if (ac === 5) acScore = 30;
  else acScore = 10;

  // === 4. 이월번호 점수 (15%) - 직전 2회차 고려 ===
  let carry1 = 0, carry2 = 0;
  for (let j = 0; j < 6; j++) {
    if (ctx.lastDrawSet.has(c[j])) carry1++;
    if (ctx.secondLastDrawSet.has(c[j])) carry2++;
  }
  // 이월 패턴: 직전 회차 1개 + 2번째 전 1개가 가장 이상적
  let carryoverScore: number;
  if (carry1 === 1 && carry2 >= 1) carryoverScore = 100;
  else if (carry1 === 1) carryoverScore = 90;
  else if (carry1 === 2 && carry2 === 0) carryoverScore = 75;
  else if (carry1 === 2 && carry2 >= 1) carryoverScore = 70;
  else if (carry1 === 0 && carry2 >= 1) carryoverScore = 60;
  else if (carry1 === 0) carryoverScore = 30;
  else carryoverScore = 15; // 3개 이상

  // === 5. 범대 균형 점수 (10%) - Uint8Array로 분포 계산 ===
  const ranges = new Uint8Array(5);
  for (let j = 0; j < 6; j++) {
    const n = c[j];
    if (n <= 9) ranges[0]++;
    else if (n <= 19) ranges[1]++;
    else if (n <= 29) ranges[2]++;
    else if (n <= 39) ranges[3]++;
    else ranges[4]++;
  }
  let usedRanges = 0, maxInRange = 0;
  for (let j = 0; j < 5; j++) {
    if (ranges[j] > 0) usedRanges++;
    if (ranges[j] > maxInRange) maxInRange = ranges[j];
  }
  // 실제 로또 당첨 패턴: 3~4개 범대 분포가 가장 흔함
  let balanceScore: number;
  if (usedRanges >= 4 && maxInRange <= 2) balanceScore = 100;
  else if (usedRanges >= 3 && maxInRange <= 2) balanceScore = 95;
  else if (usedRanges === 5 && maxInRange <= 3) balanceScore = 85;
  else if (usedRanges >= 4 && maxInRange <= 3) balanceScore = 80;
  else if (usedRanges >= 3 && maxInRange <= 3) balanceScore = 70;
  else if (usedRanges >= 2 && maxInRange <= 3) balanceScore = 50;
  else balanceScore = 20;

  // === 6. 합계 범위 점수 (10%) - 실제 당첨 합계 분포 반영: 100~175 최적 ===
  let sumScore: number;
  if (sum >= 100 && sum <= 175) sumScore = 100;
  else if (sum >= 80 && sum < 100) sumScore = 70 + (sum - 80) * 1.5;
  else if (sum > 175 && sum <= 200) sumScore = 70 + (200 - sum) * 1.2;
  else if (sum < 80) sumScore = Math.max(0, 70 - (80 - sum) * 3);
  else sumScore = Math.max(0, 70 - (sum - 200) * 3);

  // === 7. 홀짝 균형 점수 (10%) ===
  let oddCount = 0;
  for (let j = 0; j < 6; j++) { if (c[j] & 1) oddCount++; }
  const oddEvenScore = oddCount === 3 ? 100 : (oddCount === 2 || oddCount === 4) ? 80 : (oddCount === 1 || oddCount === 5) ? 50 : 20;

  // === 8. 연속번호 보너스 (5%) - 정렬 상태 활용 ===
  let consecPairs = 0;
  for (let j = 0; j < 5; j++) { if (c[j + 1] - c[j] === 1) consecPairs++; }
  const consecutiveScore = consecPairs === 1 ? 100 : consecPairs === 2 ? 80 : consecPairs === 0 ? 40 : 20;

  // === 9. 끝수 다양성 (5%) - 비트 연산 ===
  let digitBits = 0;
  for (let j = 0; j < 6; j++) digitBits |= (1 << (c[j] % 10));
  const lastDigitScore = (popcount32(digitBits) / 6) * 100;

  const score =
    frequencyScore * 0.15 +
    coOccurrenceScore * 0.15 +
    acScore * 0.15 +
    carryoverScore * 0.15 +
    balanceScore * 0.10 +
    sumScore * 0.10 +
    oddEvenScore * 0.10 +
    consecutiveScore * 0.05 +
    lastDigitScore * 0.05;

  return {
    numbers: c,
    score,
    details: {
      frequencyScore, coOccurrenceScore, acScore, carryoverScore,
      balanceScore, sumScore, oddEvenScore, consecutiveScore, lastDigitScore,
    },
  };
}

/**
 * 정렬된 두 번호 배열의 공유 번호 수 (merge 방식, O(6))
 */
function countSharedNumbers(a: LottoNumber[], b: LottoNumber[]): number {
  let shared = 0, i = 0, j = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) { shared++; i++; j++; }
    else if (a[i] < b[j]) i++;
    else j++;
  }
  return shared;
}

/**
 * 다양성 기반 조합 선택
 * 이미 선택된 조합과 maxShared개 초과로 번호가 겹치는 조합은 건너뜀
 * → 결과 조합들이 서로 충분히 다른 번호 구성을 가지도록 보장
 */
function selectDiverse(
  candidates: ScoredCombination[],
  topN: number,
  maxShared: number,
): ScoredCombination[] {
  const selected: ScoredCombination[] = [];

  for (const candidate of candidates) {
    if (selected.length >= topN) break;

    let tooSimilar = false;
    for (const sel of selected) {
      if (countSharedNumbers(candidate.numbers, sel.numbers) > maxShared) {
        tooSimilar = true;
        break;
      }
    }

    if (!tooSimilar) {
      selected.push(candidate);
    }
  }

  // 다양성 조건으로 topN을 못 채운 경우, 고득점 순으로 나머지 채움
  if (selected.length < topN) {
    const selectedSet = new Set(selected);
    for (const candidate of candidates) {
      if (selected.length >= topN) break;
      if (!selectedSet.has(candidate)) {
        selected.push(candidate);
      }
    }
  }

  return selected;
}

/**
 * 비동기 버전 - 조합에 확률 점수를 매기고 상위 조합을 반환
 * 최적화: Typed Array 룩업, 비트 연산 AC, min-heap top-N, 사전 필터, 다양성 보장
 */
export interface ScoreResult {
  top: ScoredCombination[];
  pool: ScoredCombination[];
}

export async function scoreCombinationsAsync(
  combos: LottoNumber[][],
  draws: LottoDrawResult[],
  topN: number = 30,
  onProgress?: (progress: number) => void,
  chunkSize: number = 1000,
): Promise<ScoreResult> {
  const ctx = buildScoringContext(draws);
  const total = combos.length;

  // 후보 풀: topN의 10배를 모아서 다양성 필터링에 사용
  const poolSize = topN * 10;
  const heap: ScoredCombination[] = [];
  let heapMin = -Infinity;

  for (let i = 0; i < total; i++) {
    if (i % chunkSize === 0) {
      await new Promise(r => setTimeout(r, 0));
      onProgress?.(Math.round((i / total) * 100));
    }

    const result = scoreOneCombo(combos[i], ctx);
    if (!result) continue;

    if (heap.length < poolSize) {
      heap.push(result);
      if (heap.length === poolSize) {
        for (let h = Math.floor(poolSize / 2) - 1; h >= 0; h--) heapifyDown(heap, h);
        heapMin = heap[0].score;
      }
    } else if (result.score > heapMin) {
      heap[0] = result;
      heapifyDown(heap, 0);
      heapMin = heap[0].score;
    }
  }

  onProgress?.(100);
  heap.sort((a, b) => b.score - a.score);

  // 다양성 기반 선택: 서로 최대 2개까지만 번호 겹침 허용
  const top = selectDiverse(heap, topN, 2);
  return { top, pool: heap };
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
