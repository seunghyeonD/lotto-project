import { Injectable, Logger } from '@nestjs/common';
import { LottoDrawResult } from '../types/lotto.types';

/**
 * 동행복권 API 연동 서비스
 */
@Injectable()
export class LottoApiService {
  private readonly logger = new Logger(LottoApiService.name);
  private readonly apiUrl = 'https://www.dhlottery.co.kr/common.do';

  /**
   * 특정 회차의 당첨번호 가져오기
   */
  async fetchDrawResult(round: number): Promise<LottoDrawResult | null> {
    try {
      const response = await fetch(
        `${this.apiUrl}?method=getLottoNumber&drwNo=${round}`,
        {
          headers: {
            'User-Agent':
              'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            Accept: 'application/json, text/plain, */*',
            'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7',
            Referer: 'https://www.dhlottery.co.kr/',
          },
        },
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        throw new Error('Response is not JSON');
      }

      const data = await response.json();

      // API 응답 검증
      if (data.returnValue !== 'success') {
        this.logger.warn(
          `Failed to fetch round ${round}: ${data.returnValue}`,
        );
        return null;
      }

      // 당첨번호 추출
      const numbers = [
        data.drwtNo1,
        data.drwtNo2,
        data.drwtNo3,
        data.drwtNo4,
        data.drwtNo5,
        data.drwtNo6,
      ].sort((a, b) => a - b);

      const result: LottoDrawResult = {
        round: data.drwNo,
        drawDate: data.drwNoDate,
        numbers,
        bonusNumber: data.bnusNo,
      };

      return result;
    } catch (error) {
      this.logger.error(`Error fetching round ${round}:`, error.message);
      return null;
    }
  }

  /**
   * 여러 회차 데이터 가져오기
   */
  async fetchDrawResults(
    startRound: number,
    endRound: number,
  ): Promise<LottoDrawResult[]> {
    const results: LottoDrawResult[] = [];

    for (let round = startRound; round <= endRound; round++) {
      const result = await this.fetchDrawResult(round);
      if (result) {
        results.push(result);
      }

      // API 부하 방지를 위한 딜레이 (100ms)
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    this.logger.log(
      `Fetched ${results.length} rounds from ${startRound} to ${endRound}`,
    );

    return results;
  }

  /**
   * 최신 회차 번호 가져오기
   */
  async getLatestRound(): Promise<number> {
    try {
      // 현재 날짜 기준으로 대략적인 최신 회차 계산
      // 로또 1회: 2002년 12월 7일
      const firstDrawDate = new Date('2002-12-07');
      const today = new Date();
      const daysDiff = Math.floor(
        (today.getTime() - firstDrawDate.getTime()) / (1000 * 60 * 60 * 24),
      );
      const estimatedRound = Math.floor(daysDiff / 7) + 1;

      // 추정 회차부터 역순으로 확인
      for (let round = estimatedRound; round > estimatedRound - 10; round--) {
        const result = await this.fetchDrawResult(round);
        if (result) {
          return round;
        }
      }

      return 1;
    } catch (error) {
      this.logger.error('Error getting latest round:', error.message);
      return 1;
    }
  }

  /**
   * 최근 N회차 가져오기
   */
  async fetchRecentDraws(count: number): Promise<LottoDrawResult[]> {
    const latestRound = await this.getLatestRound();
    const startRound = Math.max(1, latestRound - count + 1);

    return this.fetchDrawResults(startRound, latestRound);
  }
}
