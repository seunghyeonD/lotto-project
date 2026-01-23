/**
 * 대시보드 페이지
 */

'use client';

import React, { useEffect, useState } from 'react';
import { lottoApi } from '@/lib/api';
import { LottoDrawResult, NumberStatistics } from '@/types/lotto';
import { LottoNumberSet } from '@/components/LottoNumberSet';
import { StatisticsCard } from '@/components/StatisticsCard';

export default function DashboardPage() {
  const [recentDraws, setRecentDraws] = useState<LottoDrawResult[]>([]);
  const [statistics, setStatistics] = useState<NumberStatistics[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);

      const [draws, stats] = await Promise.all([
        lottoApi.getRecentDraws(10),
        lottoApi.getStatistics(),
      ]);

      setRecentDraws(draws);
      setStatistics(stats);
    } catch (err) {
      setError('데이터를 불러오는데 실패했습니다.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-600">데이터를 불러오는 중...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <p className="text-red-500 mb-4">{error}</p>
          <button
            onClick={loadData}
            className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
          >
            다시 시도
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          로또 번호 생성 시스템
        </h1>
        <p className="text-gray-600">
          과거 데이터 분석을 통한 지능형 번호 생성 시스템
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
        {/* 최근 당첨번호 */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-bold mb-4 text-gray-800">
            최근 당첨번호
          </h2>
          <div className="space-y-4">
            {recentDraws.map((draw) => (
              <div
                key={draw.round}
                className="p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <div className="flex justify-between items-center mb-3">
                  <span className="font-bold text-lg text-gray-800">
                    {draw.round}회
                  </span>
                  <span className="text-sm text-gray-500">{draw.drawDate}</span>
                </div>
                <LottoNumberSet
                  numbers={draw.numbers}
                  bonusNumber={draw.bonusNumber}
                  size="sm"
                  showRangeLabels
                />
              </div>
            ))}
          </div>
        </div>

        {/* 통계 */}
        <StatisticsCard
          statistics={statistics}
          title="가장 많이 나온 번호 (최근 100회)"
          limit={10}
        />
      </div>

      {/* 기능 안내 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg shadow-md p-6 text-white">
          <div className="text-3xl mb-3">🎲</div>
          <h3 className="text-lg font-bold mb-2">번호 생성</h3>
          <p className="text-blue-100 text-sm">
            기획안 규칙에 따른 지능형 번호 조합 생성
          </p>
        </div>

        <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-lg shadow-md p-6 text-white">
          <div className="text-3xl mb-3">📈</div>
          <h3 className="text-lg font-bold mb-2">통계 분석</h3>
          <p className="text-purple-100 text-sm">
            회차별 출현 빈도 및 패턴 분석
          </p>
        </div>

        <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-lg shadow-md p-6 text-white">
          <div className="text-3xl mb-3">✓</div>
          <h3 className="text-lg font-bold mb-2">조합 검증</h3>
          <p className="text-green-100 text-sm">
            선택한 번호의 과거 데이터 매칭 분석
          </p>
        </div>
      </div>
    </div>
  );
}
