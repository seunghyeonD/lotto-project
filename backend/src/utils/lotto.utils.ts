import {
  LottoNumber,
  NumberRange,
  RangeDistribution,
  RangeNumberPool,
} from '../types/lotto.types';

/**
 * 번호가 속한 범위를 반환
 */
export function getNumberRange(num: LottoNumber): NumberRange {
  if (num >= 1 && num <= 10) return NumberRange.DAN;
  if (num >= 11 && num <= 20) return NumberRange.SIP;
  if (num >= 21 && num <= 30) return NumberRange.I;
  if (num >= 31 && num <= 40) return NumberRange.SAM;
  if (num >= 41 && num <= 45) return NumberRange.SA;
  throw new Error(`Invalid lotto number: ${num}`);
}

/**
 * 번호 배열의 범위별 분포를 계산
 */
export function calculateRangeDistribution(
  numbers: LottoNumber[],
): RangeDistribution {
  const distribution: RangeDistribution = {
    단: 0,
    십: 0,
    이: 0,
    삼: 0,
    사: 0,
  };

  numbers.forEach((num) => {
    const range = getNumberRange(num);
    distribution[range]++;
  });

  return distribution;
}

/**
 * 범위별 분포가 규칙에 맞는지 검증 (각 범위당 0~2개)
 */
export function isValidRangeDistribution(
  distribution: RangeDistribution,
  minCount = 0,
  maxCount = 2,
): boolean {
  return Object.values(distribution).every(
    (count) => count >= minCount && count <= maxCount,
  );
}

/**
 * 두 번호 배열의 일치 개수 계산
 */
export function countMatches(
  numbers1: LottoNumber[],
  numbers2: LottoNumber[],
): number {
  return numbers1.filter((num) => numbers2.includes(num)).length;
}

/**
 * 일치하는 번호들 반환
 */
export function getMatchedNumbers(
  numbers1: LottoNumber[],
  numbers2: LottoNumber[],
): LottoNumber[] {
  return numbers1.filter((num) => numbers2.includes(num)).sort((a, b) => a - b);
}

/**
 * 번호 배열을 범위별로 분류
 */
export function groupNumbersByRange(
  numbers: LottoNumber[],
): RangeNumberPool {
  const pool: RangeNumberPool = {
    단: [],
    십: [],
    이: [],
    삼: [],
    사: [],
  };

  numbers.forEach((num) => {
    const range = getNumberRange(num);
    pool[range].push(num);
  });

  // 각 범위별로 정렬
  Object.keys(pool).forEach((key) => {
    pool[key as NumberRange].sort((a, b) => a - b);
  });

  return pool;
}

/**
 * 조합 생성 (nCr)
 */
export function* generateCombinations<T>(
  arr: T[],
  r: number,
): Generator<T[]> {
  if (r === 0) {
    yield [];
    return;
  }

  if (r > arr.length) {
    return;
  }

  for (let i = 0; i <= arr.length - r; i++) {
    const head = arr[i];
    const tail = arr.slice(i + 1);

    for (const combination of generateCombinations(tail, r - 1)) {
      yield [head, ...combination];
    }
  }
}

/**
 * 범위별 조합 생성 (각 범위에서 0~2개씩 선택하여 총 6개)
 */
export function* generateRangeBasedCombinations(
  pool: RangeNumberPool,
  minPerRange = 0,
  maxPerRange = 2,
): Generator<LottoNumber[]> {
  const ranges: NumberRange[] = [
    NumberRange.DAN,
    NumberRange.SIP,
    NumberRange.I,
    NumberRange.SAM,
    NumberRange.SA,
  ];

  // 각 범위에서 선택할 개수의 조합 생성
  function* generateCountDistributions(
    remainingRanges: number,
    remainingNumbers: number,
    current: number[],
  ): Generator<number[]> {
    if (remainingRanges === 0) {
      if (remainingNumbers === 0) {
        yield current;
      }
      return;
    }

    const maxForThisRange = Math.min(maxPerRange, remainingNumbers);
    const minForThisRange = Math.max(
      minPerRange,
      remainingNumbers - maxPerRange * (remainingRanges - 1),
    );

    for (
      let count = minForThisRange;
      count <= maxForThisRange && count >= 0;
      count++
    ) {
      yield* generateCountDistributions(
        remainingRanges - 1,
        remainingNumbers - count,
        [...current, count],
      );
    }
  }

  // 각 개수 분포에 대해 실제 번호 조합 생성
  for (const counts of generateCountDistributions(ranges.length, 6, [])) {
    yield* generateCombinationsFromCounts(pool, ranges, counts, 0, []);
  }
}

/**
 * 재귀적으로 범위별 조합 생성 (내부 헬퍼 함수)
 */
function* generateCombinationsFromCounts(
  pool: RangeNumberPool,
  ranges: NumberRange[],
  counts: number[],
  index: number,
  current: LottoNumber[],
): Generator<LottoNumber[]> {
  if (index === ranges.length) {
    yield [...current].sort((a, b) => a - b);
    return;
  }

  const range = ranges[index];
  const count = counts[index];
  const availableNumbers = pool[range];

  if (count === 0) {
    yield* generateCombinationsFromCounts(
      pool,
      ranges,
      counts,
      index + 1,
      current,
    );
  } else {
    for (const combination of generateCombinations(availableNumbers, count)) {
      yield* generateCombinationsFromCounts(
        pool,
        ranges,
        counts,
        index + 1,
        [...current, ...combination],
      );
    }
  }
}

/**
 * 번호가 11-19번 행에 속하는지 확인
 */
export function isInExcludedRowRange(num: LottoNumber): boolean {
  return num >= 11 && num <= 19;
}

/**
 * 조합에서 11-19번 범위 번호 개수 계산
 */
export function countExcludedRowNumbers(numbers: LottoNumber[]): number {
  return numbers.filter(isInExcludedRowRange).length;
}

/**
 * 조합 ID 생성
 */
export function generateCombinationId(numbers: LottoNumber[]): string {
  return numbers.sort((a, b) => a - b).join('-');
}

/**
 * 번호 유효성 검증
 */
export function isValidLottoNumber(num: number): boolean {
  return Number.isInteger(num) && num >= 1 && num <= 45;
}

/**
 * 번호 배열 유효성 검증
 */
export function isValidLottoNumbers(numbers: number[]): boolean {
  if (numbers.length !== 6) return false;
  if (!numbers.every(isValidLottoNumber)) return false;

  // 중복 체크
  const uniqueNumbers = new Set(numbers);
  return uniqueNumbers.size === 6;
}
