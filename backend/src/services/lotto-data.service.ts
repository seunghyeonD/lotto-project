import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import {
  LottoDrawResult,
  LottoNumber,
  NumberStatistics,
} from '../types/lotto.types';
import {
  getNumberRange,
  isValidLottoNumbers,
} from '../utils/lotto.utils';
import { LottoDrawEntity } from '../entities/lotto-draw.entity';

/**
 * 로또 당첨 번호 데이터 관리 서비스 (PostgreSQL 기반)
 */
@Injectable()
export class LottoDataService implements OnModuleInit {
  private readonly logger = new Logger(LottoDataService.name);
  private isInitialized = false;

  constructor(
    @InjectRepository(LottoDrawEntity)
    private readonly lottoDrawRepository: Repository<LottoDrawEntity>,
  ) {}

  /**
   * 모듈 초기화
   */
  async onModuleInit() {
    this.logger.log('Initializing lotto data service...');
    const count = await this.lottoDrawRepository.count();
    this.logger.log(`Database has ${count} rounds`);
    this.isInitialized = true;
  }

  /**
   * 초기화 완료 여부 확인
   */
  isReady(): boolean {
    return this.isInitialized;
  }

  /**
   * 특정 회차의 당첨 번호 조회
   */
  async getDrawResult(round: number): Promise<LottoDrawResult | null> {
    const entity = await this.lottoDrawRepository.findOne({
      where: { round },
    });

    if (!entity) {
      return null;
    }

    return this.entityToDto(entity);
  }

  /**
   * 여러 회차의 당첨 번호 조회
   */
  async getDrawResults(rounds: number[]): Promise<LottoDrawResult[]> {
    const entities = await this.lottoDrawRepository
      .createQueryBuilder('draw')
      .where('draw.round IN (:...rounds)', { rounds })
      .orderBy('draw.round', 'ASC')
      .getMany();

    return entities.map((entity) => this.entityToDto(entity));
  }

  /**
   * 범위 내 모든 회차 조회
   */
  async getDrawResultsInRange(
    startRound: number,
    endRound: number,
  ): Promise<LottoDrawResult[]> {
    const entities = await this.lottoDrawRepository.find({
      where: {
        round: Between(startRound, endRound),
      },
      order: {
        round: 'ASC',
      },
    });

    return entities.map((entity) => this.entityToDto(entity));
  }

  /**
   * 최근 N회차 조회
   */
  async getRecentDrawResults(count: number): Promise<LottoDrawResult[]> {
    const entities = await this.lottoDrawRepository.find({
      order: {
        round: 'DESC',
      },
      take: count,
    });

    return entities.reverse().map((entity) => this.entityToDto(entity));
  }

  /**
   * 전체 회차 수 조회
   */
  async getTotalRounds(): Promise<number> {
    return await this.lottoDrawRepository.count();
  }

  /**
   * 최신 회차 번호 조회
   */
  async getLatestRound(): Promise<number> {
    const entity = await this.lottoDrawRepository
      .createQueryBuilder('draw')
      .orderBy('draw.round', 'DESC')
      .limit(1)
      .getOne();

    return entity?.round || 0;
  }

  /**
   * 당첨 번호 추가 (관리자 기능)
   */
  async addDrawResult(result: LottoDrawResult): Promise<void> {
    if (!isValidLottoNumbers(result.numbers)) {
      throw new Error('Invalid lotto numbers');
    }

    const entity = this.lottoDrawRepository.create({
      round: result.round,
      drawDate: result.drawDate,
      numbers: result.numbers,
      bonusNumber: result.bonusNumber,
    });

    await this.lottoDrawRepository.save(entity);
    this.logger.log(`Added draw result for round ${result.round}`);
  }

  /**
   * 특정 범위에서 번호별 출현 횟수 통계
   */
  async getNumberStatistics(
    startRound: number,
    endRound: number,
  ): Promise<NumberStatistics[]> {
    const drawResults = await this.getDrawResultsInRange(startRound, endRound);

    // 각 번호별 출현 정보 수집
    const numberMap = new Map<
      LottoNumber,
      {
        count: number;
        rounds: number[];
      }
    >();

    drawResults.forEach((result) => {
      result.numbers.forEach((num) => {
        const info = numberMap.get(num) || { count: 0, rounds: [] };
        info.count++;
        info.rounds.push(result.round);
        numberMap.set(num, info);
      });
    });

    // 통계 객체 생성
    const statistics: NumberStatistics[] = [];

    for (let num = 1; num <= 45; num++) {
      const info = numberMap.get(num) || { count: 0, rounds: [] };
      statistics.push({
        number: num,
        count: info.count,
        range: getNumberRange(num),
        lastAppeared: info.rounds.length > 0 ? Math.max(...info.rounds) : 0,
        recentAppearances: info.rounds.sort((a, b) => b - a).slice(0, 10),
      });
    }

    // 출현 횟수로 정렬 (많은 순)
    return statistics.sort((a, b) => b.count - a.count);
  }

  /**
   * 최근 N회차 내에 출현한 번호들 조회
   */
  async getNumbersInRecentRounds(roundCount: number): Promise<LottoNumber[]> {
    const recentResults = await this.getRecentDrawResults(roundCount);
    const numbers = new Set<LottoNumber>();

    recentResults.forEach((result) => {
      result.numbers.forEach((num) => numbers.add(num));
    });

    return Array.from(numbers).sort((a, b) => a - b);
  }

  /**
   * 특정 번호들이 최근 N회차 내에 출현했는지 확인
   */
  async hasAppearedInRecentRounds(
    numbers: LottoNumber[],
    roundCount: number,
  ): Promise<boolean> {
    const recentNumbers = await this.getNumbersInRecentRounds(roundCount);
    return numbers.some((num) => recentNumbers.includes(num));
  }

  /**
   * 모든 당첨 번호 데이터 조회 (관리용)
   */
  async getAllDrawResults(): Promise<LottoDrawResult[]> {
    const entities = await this.lottoDrawRepository.find({
      order: {
        round: 'ASC',
      },
    });

    return entities.map((entity) => this.entityToDto(entity));
  }

  /**
   * 대량 데이터 추가
   */
  async bulkAddDrawResults(results: LottoDrawResult[]): Promise<void> {
    const entities = results.map((result) => {
      if (!isValidLottoNumbers(result.numbers)) {
        throw new Error(`Invalid lotto numbers for round ${result.round}`);
      }

      return this.lottoDrawRepository.create({
        round: result.round,
        drawDate: result.drawDate,
        numbers: result.numbers,
        bonusNumber: result.bonusNumber,
      });
    });

    // upsert (insert or update)
    await this.lottoDrawRepository.save(entities);
    this.logger.log(`Bulk added ${results.length} draw results`);
  }

  /**
   * Entity를 DTO로 변환
   */
  private entityToDto(entity: LottoDrawEntity): LottoDrawResult {
    return {
      round: entity.round,
      drawDate: entity.drawDate,
      numbers: entity.numbers,
      bonusNumber: entity.bonusNumber,
    };
  }

  /**
   * 데이터 초기화 (테스트용)
   */
  async clear(): Promise<void> {
    await this.lottoDrawRepository.clear();
  }
}
