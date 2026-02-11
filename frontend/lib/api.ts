/**
 * 로또 API 클라이언트
 */

import {
  LottoDrawResult,
  NumberStatistics,
  CombinationGenerationResult,
  GenerateCombinationsRequest,
  ValidateCombinationRequest,
  CombinationValidationResult,
  AnalyzeCombinationRequest,
} from '@/types/lotto';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || '';

class LottoApiClient {
  private baseUrl: string;

  constructor(baseUrl: string = API_BASE_URL) {
    this.baseUrl = baseUrl;
  }

  private async fetch<T>(
    endpoint: string,
    options?: RequestInit,
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;

    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          ...options?.headers,
        },
      });

      if (!response.ok) {
        let errorMessage = `API Error: ${response.statusText}`;
        try {
          const errorData = await response.json();
          errorMessage = `API Error: ${response.statusText} - ${JSON.stringify(errorData)}`;
        } catch {
          // JSON 파싱 실패시 기본 에러 메시지 사용
        }
        throw new Error(errorMessage);
      }

      return await response.json();
    } catch (error) {
      console.error('API request failed:', error);
      throw error;
    }
  }

  /**
   * 전체 당첨번호 조회
   */
  async getAllDraws(): Promise<LottoDrawResult[]> {
    return this.fetch<LottoDrawResult[]>('/api/lotto/recent/1000');
  }

  /**
   * 특정 회차 당첨번호 조회
   */
  async getDrawByRound(round: number): Promise<LottoDrawResult> {
    return this.fetch<LottoDrawResult>(`/api/lotto/draw/${round}`);
  }

  /**
   * 범위 내 당첨번호 조회
   */
  async getDrawsInRange(
    startRound: number,
    endRound: number,
  ): Promise<LottoDrawResult[]> {
    return this.fetch<LottoDrawResult[]>(
      `/api/lotto/range?start=${startRound}&end=${endRound}`,
    );
  }

  /**
   * 최근 N회차 조회
   */
  async getRecentDraws(count: number): Promise<LottoDrawResult[]> {
    return this.fetch<LottoDrawResult[]>(`/api/lotto/recent/${count}`);
  }

  /**
   * 번호 통계 조회
   */
  async getStatistics(
    startRound?: number,
    endRound?: number,
  ): Promise<NumberStatistics[]> {
    const params = new URLSearchParams();
    if (startRound) params.append('start', startRound.toString());
    if (endRound) params.append('end', endRound.toString());

    const query = params.toString();
    const endpoint = `/api/lotto/statistics${query ? `?${query}` : ''}`;

    return this.fetch<NumberStatistics[]>(endpoint);
  }

  /**
   * 조합 생성
   */
  async generateCombinations(
    request: GenerateCombinationsRequest,
  ): Promise<CombinationGenerationResult> {
    return this.fetch<CombinationGenerationResult>(
      '/api/lotto/generate',
      {
        method: 'POST',
        body: JSON.stringify(request),
      },
    );
  }

  /**
   * 조합 검증
   */
  async validateCombination(
    request: ValidateCombinationRequest,
  ): Promise<CombinationValidationResult[]> {
    return this.fetch<CombinationValidationResult[]>(
      '/api/lotto/validate',
      {
        method: 'POST',
        body: JSON.stringify(request),
      },
    );
  }

  /**
   * 조합 분석
   */
  async analyzeCombination(
    request: AnalyzeCombinationRequest,
  ): Promise<any> {
    return this.fetch<any>('/api/lotto/analyze', {
      method: 'POST',
      body: JSON.stringify(request),
    });
  }

  /**
   * 단일 당첨번호 추가
   */
  async addDraw(draw: LottoDrawResult): Promise<any> {
    return this.fetch<any>('/api/lotto/draws', {
      method: 'POST',
      body: JSON.stringify(draw),
    });
  }

  /**
   * 여러 당첨번호 추가
   */
  async bulkAddDraws(draws: LottoDrawResult[]): Promise<any> {
    return this.fetch<any>('/api/lotto/draws/bulk', {
      method: 'POST',
      body: JSON.stringify(draws),
    });
  }

  /**
   * 헬스 체크
   */
  async healthCheck(): Promise<{
    status: string;
    totalRounds: number;
    latestRound: number;
  }> {
    return this.fetch<any>('/api/lotto/health');
  }

  /**
   * 최신 회차 번호 조회 (스크래핑)
   */
  async getLatestRoundFromScraper(): Promise<number> {
    const response = await this.fetch<{ success: boolean; latestRound: number }>(
      '/api/lotto/scraper/latest-round',
    );
    return response.latestRound;
  }

  /**
   * 특정 회차 스크래핑
   */
  async scrapeDraw(round: number): Promise<LottoDrawResult> {
    const response = await this.fetch<{
      success: boolean;
      data: LottoDrawResult;
    }>(`/api/lotto/scraper/fetch/${round}`, {
      method: 'POST',
    });
    return response.data;
  }

  /**
   * 여러 회차 스크래핑
   */
  async scrapeMultipleDraws(
    startRound: number,
    endRound: number,
  ): Promise<LottoDrawResult[]> {
    const response = await this.fetch<{
      success: boolean;
      count: number;
      data: LottoDrawResult[];
    }>('/api/lotto/scraper/fetch-multiple', {
      method: 'POST',
      body: JSON.stringify({ startRound, endRound }),
    });
    return response.data;
  }
}

export const lottoApi = new LottoApiClient();
