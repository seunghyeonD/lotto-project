import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  Param,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { LottoDataService } from '../services/lotto-data.service';
import { CombinationService } from '../services/combination.service';
import { ScraperService } from '../services/scraper.service';
import type {
  LottoDrawResult,
  CombinationFilterOptions,
  LottoNumber,
} from '../types/lotto.types';

/**
 * 로또 번호 생성 요청 DTO
 */
class GenerateCombinationsDto {
  startRound?: number;
  endRound?: number;
  recentRoundsToExclude?: number = 2;
  recentWindowSize?: number = 10;
  minRangeCount?: number = 0;
  maxRangeCount?: number = 2;
  excludeRowRange?: [number, number] = [11, 19];
  excludeRowWindowSize?: number = 10;
}

/**
 * 조합 검증 요청 DTO
 */
class ValidateCombinationDto {
  numbers: LottoNumber[];
  startRound: number;
  endRound: number;
}

/**
 * 조합 분석 요청 DTO
 */
class AnalyzeCombinationDto {
  numbers: LottoNumber[];
  compareRounds: number[];
}

/**
 * 로또 API 컨트롤러
 */
@Controller('api/lotto')
export class LottoController {
  constructor(
    private readonly lottoDataService: LottoDataService,
    private readonly combinationService: CombinationService,
    private readonly scraperService: ScraperService,
  ) {}

  /**
   * 전체 당첨번호 조회
   */
  @Get('draws')
  async getAllDraws(): Promise<LottoDrawResult[]> {
    return await this.lottoDataService.getAllDrawResults();
  }

  /**
   * 범위 내 당첨번호 조회
   * 주의: 동적 라우트(:round)보다 먼저 선언해야 함
   */
  @Get('draws/range')
  async getDrawsInRange(
    @Query('start') start: string,
    @Query('end') end: string,
  ): Promise<LottoDrawResult[]> {
    const startRound = parseInt(start, 10);
    const endRound = parseInt(end, 10);

    if (isNaN(startRound) || isNaN(endRound)) {
      throw new HttpException(
        'Invalid round numbers',
        HttpStatus.BAD_REQUEST,
      );
    }

    return await this.lottoDataService.getDrawResultsInRange(startRound, endRound);
  }

  /**
   * 최근 N회차 조회
   * 주의: 동적 라우트(:round)보다 먼저 선언해야 함
   */
  @Get('draws/recent/:count')
  async getRecentDraws(@Param('count') count: string): Promise<LottoDrawResult[]> {
    const countNumber = parseInt(count, 10);

    if (isNaN(countNumber) || countNumber <= 0) {
      throw new HttpException('Invalid count', HttpStatus.BAD_REQUEST);
    }

    return await this.lottoDataService.getRecentDrawResults(countNumber);
  }

  /**
   * 특정 회차 당첨번호 조회
   * 주의: 이 동적 라우트는 마지막에 선언해야 함
   */
  @Get('draws/:round')
  async getDrawByRound(@Param('round') round: string): Promise<LottoDrawResult> {
    const roundNumber = parseInt(round, 10);

    if (isNaN(roundNumber)) {
      throw new HttpException('Invalid round number', HttpStatus.BAD_REQUEST);
    }

    const result = await this.lottoDataService.getDrawResult(roundNumber);

    if (!result) {
      throw new HttpException('Draw not found', HttpStatus.NOT_FOUND);
    }

    return result;
  }

  /**
   * 번호 통계 조회
   */
  @Get('statistics')
  async getStatistics(
    @Query('start') start?: string,
    @Query('end') end?: string,
  ) {
    const latestRound = await this.lottoDataService.getLatestRound();
    const startRound = start ? parseInt(start, 10) : Math.max(1, latestRound - 99);
    const endRound = end ? parseInt(end, 10) : latestRound;

    if (isNaN(startRound) || isNaN(endRound)) {
      throw new HttpException(
        'Invalid round numbers',
        HttpStatus.BAD_REQUEST,
      );
    }

    return await this.lottoDataService.getNumberStatistics(startRound, endRound);
  }

  /**
   * 조합 생성
   */
  @Post('combinations/generate')
  async generateCombinations(@Body() dto: GenerateCombinationsDto) {
    const latestRound = await this.lottoDataService.getLatestRound();

    const options: CombinationFilterOptions = {
      startRound: dto.startRound || Math.max(1, latestRound - 99),
      endRound: dto.endRound || latestRound,
      recentRoundsToExclude: dto.recentRoundsToExclude || 2,
      recentWindowSize: dto.recentWindowSize || 10,
      minRangeCount: dto.minRangeCount || 0,
      maxRangeCount: dto.maxRangeCount || 2,
      excludeRowRange: dto.excludeRowRange || [11, 19],
      excludeRowWindowSize: dto.excludeRowWindowSize || 10,
    };

    try {
      return await this.combinationService.generateCombinations(options);
    } catch (error) {
      throw new HttpException(
        'Failed to generate combinations: ' + error.message,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * 조합 검증
   */
  @Post('combinations/validate')
  validateCombination(@Body() dto: ValidateCombinationDto) {
    if (!dto.numbers || dto.numbers.length === 0 || dto.numbers.length > 15) {
      throw new HttpException(
        'Invalid numbers: must provide between 1 and 15 numbers',
        HttpStatus.BAD_REQUEST,
      );
    }

    return this.combinationService.validateCombinationAgainstRounds(
      dto.numbers,
      dto.startRound,
      dto.endRound,
    );
  }

  /**
   * 조합 분석
   */
  @Post('combinations/analyze')
  analyzeCombination(@Body() dto: AnalyzeCombinationDto) {
    if (!dto.numbers || dto.numbers.length === 0 || dto.numbers.length > 15) {
      throw new HttpException(
        'Invalid numbers: must provide between 1 and 15 numbers',
        HttpStatus.BAD_REQUEST,
      );
    }

    return this.combinationService.analyzeCombination(
      dto.numbers,
      dto.compareRounds,
    );
  }

  /**
   * 당첨번호 추가 (관리자)
   */
  @Post('draws')
  async addDraw(@Body() drawResult: LottoDrawResult) {
    try {
      await this.lottoDataService.addDrawResult(drawResult);
      return { success: true, round: drawResult.round };
    } catch (error) {
      throw new HttpException(
        'Failed to add draw result: ' + error.message,
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  /**
   * 대량 당첨번호 추가 (관리자)
   */
  @Post('draws/bulk')
  async bulkAddDraws(@Body() draws: LottoDrawResult[]) {
    try {
      await this.lottoDataService.bulkAddDrawResults(draws);
      return { success: true, count: draws.length };
    } catch (error) {
      throw new HttpException(
        'Failed to add draw results: ' + error.message,
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  /**
   * 헬스 체크
   */
  @Get('health')
  async healthCheck() {
    return {
      status: 'ok',
      totalRounds: await this.lottoDataService.getTotalRounds(),
      latestRound: await this.lottoDataService.getLatestRound(),
      isReady: this.lottoDataService.isReady(),
    };
  }

  /**
   * 최신 회차 번호 조회 (스크래핑)
   */
  @Get('scraper/latest-round')
  async getLatestRoundFromScraper() {
    try {
      const latestRound = await this.scraperService.getLatestRound();
      return { success: true, latestRound };
    } catch (error) {
      throw new HttpException(
        'Failed to get latest round: ' + error.message,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * 특정 회차 스크래핑
   */
  @Post('scraper/fetch/:round')
  async scrapeDraw(@Param('round') round: string) {
    const roundNumber = parseInt(round, 10);

    if (isNaN(roundNumber)) {
      throw new HttpException('Invalid round number', HttpStatus.BAD_REQUEST);
    }

    try {
      console.log(
        `[LottoController] Attempting to scrape round ${roundNumber}`,
      );

      // 1. Puppeteer 방식 먼저 시도
      let result =
        await this.scraperService.fetchDrawResultViaPuppeteer(roundNumber);

      // 2. 실패 시 API 방식 시도
      if (!result) {
        console.log(
          `[LottoController] Puppeteer failed, trying API method...`,
        );
        result = await this.scraperService.fetchDrawResultViaApi(roundNumber);
      }

      // 3. 실패 시 HTML 파싱
      if (!result) {
        console.log(
          `[LottoController] API method failed, trying HTML parsing...`,
        );
        result = await this.scraperService.fetchDrawResult(roundNumber);
      }

      if (!result) {
        throw new HttpException(
          `동행복권 사이트에서 ${roundNumber}회 데이터를 가져올 수 없습니다. 동행복권 사이트가 요청을 차단했거나, 해당 회차가 존재하지 않습니다. 수동으로 데이터를 입력해주세요.`,
          HttpStatus.NOT_FOUND,
        );
      }

      // 자동으로 저장
      await this.lottoDataService.addDrawResult(result);
      console.log(`[LottoController] Successfully saved round ${roundNumber}`);

      return { success: true, data: result };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        `스크래핑 실패: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * 여러 회차 스크래핑
   */
  @Post('scraper/fetch-multiple')
  async scrapeMultipleDraws(
    @Body() body: { startRound: number; endRound: number },
  ) {
    const { startRound, endRound } = body;

    if (!startRound || !endRound || startRound > endRound) {
      throw new HttpException(
        'Invalid round range',
        HttpStatus.BAD_REQUEST,
      );
    }

    if (endRound - startRound > 50) {
      throw new HttpException(
        'Maximum 50 rounds per request',
        HttpStatus.BAD_REQUEST,
      );
    }

    try {
      const results = await this.scraperService.fetchMultipleRounds(
        startRound,
        endRound,
      );

      // 자동으로 저장
      if (results.length > 0) {
        await this.lottoDataService.bulkAddDrawResults(results);
      }

      return { success: true, count: results.length, data: results };
    } catch (error) {
      throw new HttpException(
        'Failed to scrape draws: ' + error.message,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
