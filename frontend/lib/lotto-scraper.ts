/**
 * 동행복권 웹사이트에서 데이터 스크래핑
 */

import { LottoDrawResult } from '@/types/lotto';

export class LottoScraper {
  private readonly baseUrl = 'https://www.dhlottery.co.kr/gameResult.do';

  /**
   * 특정 회차의 당첨번호 가져오기 (iframe 방식)
   */
  async fetchDrawResult(round: number): Promise<LottoDrawResult | null> {
    try {
      const url = `${this.baseUrl}?method=byWin&drwNo=${round}`;

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'ko-KR,ko;q=0.9',
        },
        credentials: 'omit',
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const html = await response.text();

      // HTML 파싱
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');

      // 당첨번호 추출
      const numbers: number[] = [];
      for (let i = 1; i <= 6; i++) {
        const numElement = doc.querySelector(`.num.win .ball_645.lrg.ball${i}`);
        if (numElement) {
          const num = parseInt(numElement.textContent?.trim() || '0');
          if (num > 0) numbers.push(num);
        }
      }

      // 보너스 번호 추출
      const bonusElement = doc.querySelector('.num.bonus .ball_645.lrg');
      const bonusNumber = bonusElement
        ? parseInt(bonusElement.textContent?.trim() || '0')
        : 0;

      // 추첨일 추출
      const dateElement = doc.querySelector('.desc');
      let drawDate = '';
      if (dateElement) {
        const dateText = dateElement.textContent || '';
        const dateMatch = dateText.match(/\((\d{4}\.\d{2}\.\d{2})\)/);
        if (dateMatch) {
          drawDate = dateMatch[1].replace(/\./g, '-');
        }
      }

      if (numbers.length !== 6 || bonusNumber === 0) {
        return null;
      }

      return {
        round,
        drawDate,
        numbers: numbers.sort((a, b) => a - b),
        bonusNumber,
      };
    } catch (error) {
      console.error(`Error fetching round ${round}:`, error);
      return null;
    }
  }

  /**
   * JSONP 방식으로 데이터 가져오기 (API 방식)
   */
  async fetchDrawResultViaApi(round: number): Promise<LottoDrawResult | null> {
    try {
      const url = `https://www.dhlottery.co.kr/common.do?method=getLottoNumber&drwNo=${round}`;

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      if (data.returnValue !== 'success') {
        return null;
      }

      const numbers = [
        data.drwtNo1,
        data.drwtNo2,
        data.drwtNo3,
        data.drwtNo4,
        data.drwtNo5,
        data.drwtNo6,
      ].sort((a, b) => a - b);

      return {
        round: data.drwNo,
        drawDate: data.drwNoDate,
        numbers,
        bonusNumber: data.bnusNo,
      };
    } catch (error) {
      console.error(`Error fetching round ${round} via API:`, error);
      return null;
    }
  }

  /**
   * 여러 회차 가져오기
   */
  async fetchMultipleRounds(
    startRound: number,
    endRound: number,
    onProgress?: (current: number, total: number) => void,
  ): Promise<LottoDrawResult[]> {
    const results: LottoDrawResult[] = [];
    const total = endRound - startRound + 1;

    for (let round = startRound; round <= endRound; round++) {
      // API 방식 시도
      let result = await this.fetchDrawResultViaApi(round);

      // 실패 시 HTML 파싱 방식 시도
      if (!result) {
        result = await this.fetchDrawResult(round);
      }

      if (result) {
        results.push(result);
      }

      if (onProgress) {
        onProgress(round - startRound + 1, total);
      }

      // API 부하 방지 (300ms 딜레이)
      await new Promise((resolve) => setTimeout(resolve, 300));
    }

    return results;
  }

  /**
   * 최신 회차 번호 가져오기
   */
  async getLatestRound(): Promise<number> {
    // 현재 날짜 기준으로 대략적인 최신 회차 계산
    const firstDrawDate = new Date('2002-12-07');
    const today = new Date();
    const daysDiff = Math.floor(
      (today.getTime() - firstDrawDate.getTime()) / (1000 * 60 * 60 * 24),
    );
    const estimatedRound = Math.floor(daysDiff / 7) + 1;

    // 추정 회차부터 역순으로 확인
    for (let round = estimatedRound; round > estimatedRound - 10; round--) {
      const result = await this.fetchDrawResultViaApi(round);
      if (result) {
        return round;
      }
    }

    return estimatedRound;
  }
}

export const lottoScraper = new LottoScraper();
