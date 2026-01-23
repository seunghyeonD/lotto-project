/**
 * 통계 분석 페이지
 */

'use client';

import React, { useEffect, useState } from 'react';
import { lottoApi } from '@/lib/api';
import { NumberStatistics } from '@/types/lotto';
import { StatisticsCard } from '@/components/StatisticsCard';

export default function StatisticsPage() {
  const [statistics, setStatistics] = useState<NumberStatistics[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [roundRange, setRoundRange] = useState({ start: 1, end: 100 });

  useEffect(() => {
    loadStatistics();
  }, [roundRange]);

  const loadStatistics = async () => {
    try {
      setLoading(true);
      setError(null);

      const stats = await lottoApi.getStatistics(
        roundRange.start,
        roundRange.end,
      );

      setStatistics(stats);
    } catch (err) {
      setError('통계 데이터를 불러오는데 실패했습니다.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const getRangeStats = (range: string) => {
    return statistics.filter((stat) => stat.range === range);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-600">통계 데이터를 불러오는 중...</p>
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
            onClick={loadStatistics}
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
        <h1 className="text-3xl font-bold text-gray-900 mb-2">통계 분석</h1>
        <p className="text-gray-600">
          회차별 번호 출현 빈도 및 패턴을 분석합니다
        </p>
      </div>

      {/* 범위 설정 */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-8">
        <h2 className="text-xl font-bold mb-4 text-gray-800">분석 범위</h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              시작 회차
            </label>
            <input
              type="number"
              value={roundRange.start}
              onChange={(e) =>
                setRoundRange({ ...roundRange, start: parseInt(e.target.value) || 1 })
              }
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
              min="1"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              종료 회차
            </label>
            <input
              type="number"
              value={roundRange.end}
              onChange={(e) =>
                setRoundRange({ ...roundRange, end: parseInt(e.target.value) || 100 })
              }
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
              min="1"
            />
          </div>
        </div>
      </div>

      {/* 전체 통계 */}
      <div className="mb-8">
        <StatisticsCard
          statistics={statistics}
          title="전체 번호 출현 빈도 (상위 20개)"
          limit={20}
        />
      </div>

      {/* 범위별 통계 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <StatisticsCard
          statistics={getRangeStats('단')}
          title="단번대 (1-10)"
          limit={10}
        />
        <StatisticsCard
          statistics={getRangeStats('십')}
          title="십번대 (11-20)"
          limit={10}
        />
        <StatisticsCard
          statistics={getRangeStats('이')}
          title="이십번대 (21-30)"
          limit={10}
        />
        <StatisticsCard
          statistics={getRangeStats('삼')}
          title="삼십번대 (31-40)"
          limit={10}
        />
        <StatisticsCard
          statistics={getRangeStats('사')}
          title="사십번대 (41-45)"
          limit={5}
        />
      </div>
    </div>
  );
}
