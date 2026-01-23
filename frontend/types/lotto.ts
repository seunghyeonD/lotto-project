/**
 * 프론트엔드 로또 타입 정의
 */

export type LottoNumber = number;

export enum NumberRange {
  DAN = '단',
  SIP = '십',
  I = '이',
  SAM = '삼',
  SA = '사',
}

export interface LottoDrawResult {
  round: number;
  drawDate: string;
  numbers: LottoNumber[];
  bonusNumber: LottoNumber;
}

export interface LottoCombination {
  id: string;
  numbers: LottoNumber[];
  rangeDistribution: RangeDistribution;
}

export interface RangeDistribution {
  단: number;
  십: number;
  이: number;
  삼: number;
  사: number;
}

export interface NumberStatistics {
  number: LottoNumber;
  count: number;
  range: NumberRange;
  lastAppeared: number;
  recentAppearances: number[];
}

export interface CombinationGenerationResult {
  totalCombinations: number;
  filteredCombinations: LottoCombination[];
  match5Combinations: LottoCombination[];
  match4Combinations: LottoCombination[];
  statistics: {
    beforeFilter: number;
    afterFilter: number;
    excluded: number;
  };
}

export interface CombinationValidationResult {
  isValid: boolean;
  matchCount: number;
  matchedNumbers: LottoNumber[];
  round: number;
}

export interface GenerateCombinationsRequest {
  startRound?: number;
  endRound?: number;
  recentRoundsToExclude?: number;
  recentWindowSize?: number;
  minRangeCount?: number;
  maxRangeCount?: number;
}

export interface ValidateCombinationRequest {
  numbers: LottoNumber[];
  startRound: number;
  endRound: number;
}

export interface AnalyzeCombinationRequest {
  numbers: LottoNumber[];
  compareRounds: number[];
}
