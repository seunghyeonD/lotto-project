/**
 * 로또 번호 범위별 타입 정의
 */
export enum NumberRange {
  DAN = '단',      // 단번대 (1-10)
  SIP = '십',      // 십번대 (11-20)
  I = '이',        // 이십번대 (21-30)
  SAM = '삼',      // 삼십번대 (31-40)
  SA = '사',       // 사십번대 (41-45)
}

/**
 * 로또 번호 (1-45)
 */
export type LottoNumber = number;

/**
 * 로또 당첨 번호 세트 (6개 번호 + 보너스)
 */
export interface LottoDrawResult {
  round: number;              // 회차
  drawDate: string;           // 추첨일
  numbers: LottoNumber[];     // 당첨 번호 6개 (정렬됨)
  bonusNumber: LottoNumber;   // 보너스 번호
}

/**
 * 번호 조합
 */
export interface LottoCombination {
  id: string;
  numbers: LottoNumber[];     // 6개 번호 (정렬됨)
  rangeDistribution: RangeDistribution;
}

/**
 * 범위별 번호 분포
 */
export interface RangeDistribution {
  단: number;  // 1-10
  십: number;  // 11-20
  이: number;  // 21-30
  삼: number;  // 31-40
  사: number;  // 41-45
}

/**
 * 번호 통계 정보
 */
export interface NumberStatistics {
  number: LottoNumber;
  count: number;              // 출현 횟수
  range: NumberRange;         // 범위
  lastAppeared: number;       // 마지막 출현 회차
  recentAppearances: number[]; // 최근 출현 회차들
}

/**
 * 조합 필터 옵션
 */
export interface CombinationFilterOptions {
  startRound: number;         // 분석 시작 회차
  endRound: number;           // 분석 종료 회차
  recentRoundsToExclude: number; // 제외할 최근 회차 수
  recentWindowSize: number;   // 최근 데이터 윈도우 크기
  minRangeCount: number;      // 범위별 최소 번호 개수
  maxRangeCount: number;      // 범위별 최대 번호 개수
  excludeRowRange: [number, number]; // 제외할 행 범위 (11-19번행)
  excludeRowWindowSize: number; // 행 제외 윈도우 크기 (10주)
}

/**
 * 조합 생성 결과
 */
export interface CombinationGenerationResult {
  totalCombinations: number;
  filteredCombinations: LottoCombination[];
  match5Combinations: LottoCombination[]; // 5개 일치 조합
  match4Combinations: LottoCombination[]; // 4개 일치 조합
  statistics: {
    beforeFilter: number;
    afterFilter: number;
    excluded: number;
  };
}

/**
 * 조합 검증 결과
 */
export interface CombinationValidationResult {
  isValid: boolean;
  matchCount: number;
  matchedNumbers: LottoNumber[];
  round: number;
}

/**
 * 범위별 번호 풀
 */
export interface RangeNumberPool {
  단: LottoNumber[];  // 1-10
  십: LottoNumber[];  // 11-20
  이: LottoNumber[];  // 21-30
  삼: LottoNumber[];  // 31-40
  사: LottoNumber[];  // 41-45
}
