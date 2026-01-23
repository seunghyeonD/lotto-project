import { Injectable, OnModuleDestroy } from '@nestjs/common';
import axios from 'axios';
import * as cheerio from 'cheerio';
import { Browser } from 'puppeteer';
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import { LottoDrawResult } from '../types/lotto.types';

// Stealth 플러그인 추가
puppeteer.use(StealthPlugin());

/**
 * 동행복권 웹사이트 스크래핑 서비스
 */
@Injectable()
export class ScraperService implements OnModuleDestroy {
  private readonly baseUrl = 'https://www.dhlottery.co.kr/gameResult.do';
  private readonly apiUrl = 'https://www.dhlottery.co.kr/common.do';
  private browser: Browser | null = null;

  /**
   * 모듈 종료 시 브라우저 정리
   */
  async onModuleDestroy() {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }

  /**
   * Puppeteer 브라우저 인스턴스 가져오기 (재사용)
   */
  private async getBrowser(): Promise<Browser> {
    if (!this.browser) {
      console.log('[ScraperService] Launching Puppeteer browser with stealth...');
      this.browser = await puppeteer.launch({
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-blink-features=AutomationControlled',
          '--disable-features=IsolateOrigins,site-per-process',
          '--disable-web-security',
          '--window-size=1920,1080',
        ],
        defaultViewport: {
          width: 1920,
          height: 1080,
        },
      });
      console.log('[ScraperService] Browser launched successfully');
    }
    return this.browser;
  }

  /**
   * Puppeteer를 통한 데이터 가져오기 (브라우저 자동화)
   * HTML 페이지에서 직접 데이터 추출
   */
  async fetchDrawResultViaPuppeteer(
    round: number,
  ): Promise<LottoDrawResult | null> {
    let page: Awaited<ReturnType<Browser['newPage']>> | null = null;
    try {
      const browser = await this.getBrowser();
      page = await browser.newPage();

      console.log(`[ScraperService] Fetching round ${round} via Puppeteer...`);

      // User-Agent 설정
      await page.setUserAgent(
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      );

      // HTML 페이지로 이동
      const url = `https://www.dhlottery.co.kr/gameResult.do?method=byWin&drwNo=${round}`;
      await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });

      // 페이지에서 직접 데이터 추출
      const data = await page.evaluate(() => {
        // 회차 번호 추출
        const roundElement = document.querySelector('.win_result h4 strong');
        const roundText = roundElement?.textContent?.trim() || '';
        const roundMatch = roundText.match(/(\d+)/);
        const round = roundMatch ? parseInt(roundMatch[1]) : 0;

        // 당첨번호 추출
        const numbers: number[] = [];
        for (let i = 1; i <= 6; i++) {
          const ball = document.querySelector(`.num.win .ball_645.lrg.ball${i}`);
          const numText = ball?.textContent?.trim() || '';
          const num = parseInt(numText);
          if (num > 0) {
            numbers.push(num);
          }
        }

        // 보너스 번호 추출
        const bonusBall = document.querySelector('.num.bonus .ball_645.lrg');
        const bonusText = bonusBall?.textContent?.trim() || '';
        const bonusNumber = parseInt(bonusText);

        // 추첨일 추출
        const descElement = document.querySelector('.desc');
        const dateText = descElement?.textContent || '';
        const dateMatch = dateText.match(/\((\d{4}\.\d{2}\.\d{2})\)/);
        const drawDate = dateMatch ? dateMatch[1].replace(/\./g, '-') : '';

        return {
          round,
          numbers: numbers.sort((a, b) => a - b),
          bonusNumber,
          drawDate,
        };
      });

      // 데이터 유효성 검증
      console.log(`[ScraperService] Extracted data:`, JSON.stringify(data));
      if (!data.round || data.numbers.length !== 6 || !data.bonusNumber) {
        console.error(
          `[ScraperService] Invalid data extracted for round ${round}:`,
          `round=${data.round}, numbers=${data.numbers.length}, bonus=${data.bonusNumber}`,
        );
        return null;
      }

      // 요청한 회차와 추출된 회차가 다른지 확인
      if (data.round !== round) {
        console.warn(
          `[ScraperService] Requested round ${round} but page shows round ${data.round}`,
        );
        return null;
      }

      console.log(
        `[ScraperService] Successfully fetched round ${round} via Puppeteer:`,
        data.numbers,
      );

      return {
        round: data.round,
        drawDate: data.drawDate,
        numbers: data.numbers,
        bonusNumber: data.bonusNumber,
      };
    } catch (error) {
      console.error(
        `[ScraperService] Error fetching round ${round} via Puppeteer:`,
        error.message,
      );
      return null;
    } finally {
      if (page) {
        await page.close();
      }
    }
  }

  /**
   * JSONP API를 통한 데이터 가져오기
   */
  async fetchDrawResultViaApi(round: number): Promise<LottoDrawResult | null> {
    try {
      const url = `${this.apiUrl}?method=getLottoNumber&drwNo=${round}`;

      console.log(`[ScraperService] Fetching round ${round} from API...`);

      const response = await axios.get(url, {
        headers: {
          Accept: 'application/json, text/javascript, */*',
          'User-Agent':
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          Referer: 'https://www.dhlottery.co.kr/',
        },
        timeout: 10000,
        validateStatus: (status) => status === 200,
      });

      console.log(
        `[ScraperService] Response status: ${response.status}, Content-Type: ${response.headers['content-type']}`,
      );

      const data = response.data;

      // 응답이 HTML인 경우 (차단됨)
      if (typeof data === 'string' && data.includes('<!DOCTYPE')) {
        console.error(
          `[ScraperService] Received HTML response instead of JSON (blocked)`,
        );
        return null;
      }

      if (!data || data.returnValue !== 'success') {
        console.warn(
          `[ScraperService] API returned unsuccessful: ${JSON.stringify(data)}`,
        );
        return null;
      }

      // 요청한 회차와 반환된 회차가 다른지 확인
      if (data.drwNo !== round) {
        console.warn(
          `[ScraperService] Requested round ${round} but API returned round ${data.drwNo}`,
        );
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

      console.log(
        `[ScraperService] Successfully fetched round ${round}:`,
        numbers,
      );

      return {
        round: data.drwNo,
        drawDate: data.drwNoDate,
        numbers,
        bonusNumber: data.bnusNo,
      };
    } catch (error) {
      console.error(
        `[ScraperService] Error fetching round ${round} via API:`,
        error.message,
      );
      if (error.response) {
        console.error(
          `[ScraperService] Response status: ${error.response.status}`,
        );
      }
      return null;
    }
  }

  /**
   * HTML 파싱을 통한 데이터 가져오기
   */
  async fetchDrawResult(round: number): Promise<LottoDrawResult | null> {
    try {
      const url = `${this.baseUrl}?method=byWin&drwNo=${round}`;

      const response = await axios.get(url, {
        headers: {
          Accept:
            'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'ko-KR,ko;q=0.9',
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        },
      });

      const $ = cheerio.load(response.data);

      // 회차 번호 추출 및 검증
      const roundText = $('.win_result h4 strong').text().trim();
      const roundMatch = roundText.match(/(\d+)/);
      if (roundMatch) {
        const actualRound = parseInt(roundMatch[1]);
        if (actualRound !== round) {
          console.warn(
            `[ScraperService] Requested round ${round} but page shows round ${actualRound}`,
          );
          return null;
        }
      }

      // 당첨번호 추출
      const numbers: number[] = [];
      for (let i = 1; i <= 6; i++) {
        const numText = $(`.num.win .ball_645.lrg.ball${i}`).text().trim();
        const num = parseInt(numText);
        if (num > 0) {
          numbers.push(num);
        }
      }

      // 보너스 번호 추출
      const bonusText = $('.num.bonus .ball_645.lrg').text().trim();
      const bonusNumber = parseInt(bonusText);

      // 추첨일 추출
      const dateText = $('.desc').text();
      const dateMatch = dateText.match(/\((\d{4}\.\d{2}\.\d{2})\)/);
      const drawDate = dateMatch ? dateMatch[1].replace(/\./g, '-') : '';

      if (numbers.length !== 6 || !bonusNumber) {
        return null;
      }

      return {
        round,
        drawDate,
        numbers: numbers.sort((a, b) => a - b),
        bonusNumber,
      };
    } catch (error) {
      console.error(`Error fetching round ${round}:`, error.message);
      return null;
    }
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

  /**
   * 여러 회차 가져오기
   */
  async fetchMultipleRounds(
    startRound: number,
    endRound: number,
  ): Promise<LottoDrawResult[]> {
    const results: LottoDrawResult[] = [];

    for (let round = startRound; round <= endRound; round++) {
      // 1. Puppeteer 방식 시도 (우선순위 1)
      let result = await this.fetchDrawResultViaPuppeteer(round);

      // 2. 실패 시 일반 API 방식 시도
      if (!result) {
        result = await this.fetchDrawResultViaApi(round);
      }

      // 3. 실패 시 HTML 파싱 방식 시도
      if (!result) {
        result = await this.fetchDrawResult(round);
      }

      if (result) {
        results.push(result);
        console.log(
          `[ScraperService] Progress: ${results.length}/${endRound - startRound + 1}`,
        );
      }

      // API 부하 방지 (500ms 딜레이)
      await new Promise((resolve) => setTimeout(resolve, 500));
    }

    console.log(
      `[ScraperService] Completed: ${results.length} rounds fetched`,
    );
    return results;
  }
}
