import { Injectable } from '@nestjs/common';
import {
  LottoCombination,
  CombinationFilterOptions,
  CombinationGenerationResult,
  LottoNumber,
  RangeNumberPool,
  CombinationValidationResult,
} from '../types/lotto.types';
import { LottoDataService } from './lotto-data.service';
import {
  calculateRangeDistribution,
  isValidRangeDistribution,
  countMatches,
  getMatchedNumbers,
  groupNumbersByRange,
  generateRangeBasedCombinations,
  countExcludedRowNumbers,
  generateCombinationId,
} from '../utils/lotto.utils';

/**
 * 로또 번호 조합 생성 및 필터링 서비스
 */
@Injectable()
export class CombinationService {
  constructor(private readonly lottoDataService: LottoDataService) {}

  /**
   * 기획안 규칙에 따른 번호 풀 생성
   */
  private async createNumberPool(options: CombinationFilterOptions): Promise<RangeNumberPool> {
    const recentNumbers = await this.lottoDataService.getNumbersInRecentRounds(
      options.recentWindowSize,
    );

    // 10주 내 나온 번호 (기획안: 10주 내에 없는 숫자는 삭제)
    const stats = await this.lottoDataService.getNumberStatistics(
      Math.max(1, options.endRound - options.excludeRowWindowSize + 1),
      options.endRound,
    );

    const validNumbers = recentNumbers.filter((num) => {
      // 11-19번 행 범위 체크
      if (num >= 11 && num <= 19) {
        // 10주 내에 출현했는지 확인
        const numStats = stats.find((s) => s.number === num);
        return numStats && numStats.count > 0;
      }
      return true;
    });

    // 최근 2주 가지에 나온 번호 제외
    const excludedRecentNumbers =
      await this.lottoDataService.getNumbersInRecentRounds(
        options.recentRoundsToExclude,
      );

    const filteredNumbers = validNumbers.filter(
      (num) => !excludedRecentNumbers.includes(num),
    );

    return groupNumbersByRange(filteredNumbers);
  }

  /**
   * 조합이 과거 당첨 번호와 3개 이상 일치하는지 확인
   */
  private async hasThreeOrMoreMatches(
    combination: LottoNumber[],
    startRound: number,
    endRound: number,
  ): Promise<boolean> {
    const drawResults = await this.lottoDataService.getDrawResultsInRange(
      startRound,
      endRound,
    );

    return drawResults.some((result) => {
      const matches = countMatches(combination, result.numbers);
      return matches >= 3;
    });
  }

  /**
   * 11-19번 행 제약 조건 확인 (0~4개)
   */
  private isValidExcludedRowCount(combination: LottoNumber[]): boolean {
    const count = countExcludedRowNumbers(combination);
    return count >= 0 && count <= 4;
  }

  /**
   * 조합 생성 (기획안 규칙 적용)
   */
  async generateCombinations(
    options: CombinationFilterOptions,
  ): Promise<CombinationGenerationResult> {
    const numberPool = await this.createNumberPool(options);

    const allCombinations: LottoCombination[] = [];
    const filteredCombinations: LottoCombination[] = [];

    let totalCount = 0;
    let filteredCount = 0;

    // 범위별 조합 생성 (각 범위에서 0~2개)
    const combinationGenerator = generateRangeBasedCombinations(
      numberPool,
      options.minRangeCount,
      options.maxRangeCount,
    );

    for (const numbers of combinationGenerator) {
      totalCount++;

      const combination: LottoCombination = {
        id: generateCombinationId(numbers),
        numbers: numbers.sort((a, b) => a - b),
        rangeDistribution: calculateRangeDistribution(numbers),
      };

      allCombinations.push(combination);

      // 필터링 규칙 적용
      const isValid = await this.validateCombination(combination, options);

      if (isValid) {
        filteredCombinations.push(combination);
        filteredCount++;
      }

      // 메모리 관리: 15개 단위로 처리 (기획안: 5,005조합)
      if (totalCount % 15 === 0 && totalCount > 10000) {
        // 너무 많은 조합이 생성되면 중단
        break;
      }
    }

    // 5개, 4개 일치 조합 찾기
    const match5Combinations = await this.findMatchNCombinations(
      filteredCombinations,
      options.startRound,
      options.endRound,
      5,
    );

    const match4Combinations = await this.findMatchNCombinations(
      filteredCombinations,
      options.startRound,
      options.endRound,
      4,
    );

    return {
      totalCombinations: totalCount,
      filteredCombinations,
      match5Combinations,
      match4Combinations,
      statistics: {
        beforeFilter: totalCount,
        afterFilter: filteredCount,
        excluded: totalCount - filteredCount,
      },
    };
  }

  /**
   * 조합 유효성 검증
   */
  private async validateCombination(
    combination: LottoCombination,
    options: CombinationFilterOptions,
  ): Promise<boolean> {
    // 1. 범위별 분포 검증 (각 범위 0~2개)
    if (
      !isValidRangeDistribution(
        combination.rangeDistribution,
        options.minRangeCount,
        options.maxRangeCount,
      )
    ) {
      return false;
    }

    // 2. 11-19번 행 개수 검증 (0~4개)
    if (!this.isValidExcludedRowCount(combination.numbers)) {
      return false;
    }

    // 3. 과거 당첨번호와 3개 이상 일치 제외
    if (
      await this.hasThreeOrMoreMatches(
        combination.numbers,
        options.startRound,
        options.endRound,
      )
    ) {
      return false;
    }

    return true;
  }

  /**
   * N개 일치하는 조합 찾기
   */
  private async findMatchNCombinations(
    combinations: LottoCombination[],
    startRound: number,
    endRound: number,
    matchCount: number,
  ): Promise<LottoCombination[]> {
    const matchedCombinations = new Map<string, LottoCombination>();

    const drawResults = await this.lottoDataService.getDrawResultsInRange(
      startRound,
      endRound,
    );

    combinations.forEach((combination) => {
      drawResults.forEach((result) => {
        const matches = countMatches(combination.numbers, result.numbers);

        if (matches === matchCount) {
          // 같은 N개 숫자 조합 중 1개만 저장
          const matchedNumbers = getMatchedNumbers(
            combination.numbers,
            result.numbers,
          );
          const key = matchedNumbers.join('-');

          if (!matchedCombinations.has(key)) {
            matchedCombinations.set(key, combination);
          }
        }
      });
    });

    return Array.from(matchedCombinations.values());
  }

  /**
   * 조합 검증 (특정 회차 범위와 비교)
   */
  async validateCombinationAgainstRounds(
    numbers: LottoNumber[],
    startRound: number,
    endRound: number,
  ): Promise<CombinationValidationResult[]> {
    const drawResults = await this.lottoDataService.getDrawResultsInRange(
      startRound,
      endRound,
    );

    return drawResults.map((result) => {
      const matchCount = countMatches(numbers, result.numbers);
      const matchedNumbers = getMatchedNumbers(numbers, result.numbers);

      return {
        isValid: matchCount < 3, // 3개 미만 일치만 유효
        matchCount,
        matchedNumbers,
        round: result.round,
      };
    });
  }

  /**
   * 커스텀 번호 풀로 조합 생성
   */
  async generateCustomCombinations(
    customNumbers: LottoNumber[],
    options: Partial<CombinationFilterOptions>,
  ): Promise<LottoCombination[]> {
    const pool = groupNumbersByRange(customNumbers);
    const combinations: LottoCombination[] = [];

    const combinationGenerator = generateRangeBasedCombinations(
      pool,
      options.minRangeCount || 0,
      options.maxRangeCount || 2,
    );

    for (const numbers of combinationGenerator) {
      const combination: LottoCombination = {
        id: generateCombinationId(numbers),
        numbers: numbers.sort((a, b) => a - b),
        rangeDistribution: calculateRangeDistribution(numbers),
      };

      combinations.push(combination);
    }

    return combinations;
  }

  /**
   * 조합 상세 분석
   */
  async analyzeCombination(
    numbers: LottoNumber[],
    compareRounds: number[],
  ): Promise<{
    rangeDistribution: any;
    matches: CombinationValidationResult[];
    excludedRowCount: number;
  }> {
    const drawResults = await this.lottoDataService.getDrawResults(compareRounds);

    const matches = drawResults.map((result) => {
      const matchCount = countMatches(numbers, result.numbers);
      const matchedNumbers = getMatchedNumbers(numbers, result.numbers);

      return {
        isValid: matchCount < 3,
        matchCount,
        matchedNumbers,
        round: result.round,
      };
    });

    return {
      rangeDistribution: calculateRangeDistribution(numbers),
      matches,
      excludedRowCount: countExcludedRowNumbers(numbers),
    };
  }
}
