/**
 * 번호 생성 페이지
 */

'use client';

import React, { useState } from 'react';
import { lottoApi } from '@/lib/api';
import {
  CombinationGenerationResult,
  GenerateCombinationsRequest,
} from '@/types/lotto';
import { LottoNumberSet } from '@/components/LottoNumberSet';

export default function GeneratePage() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<CombinationGenerationResult | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);

  // 기본 옵션
  const [options, setOptions] = useState<GenerateCombinationsRequest>({
    recentRoundsToExclude: 2,
    recentWindowSize: 10,
    minRangeCount: 0,
    maxRangeCount: 2,
  });

  const handleGenerate = async () => {
    try {
      setLoading(true);
      setError(null);

      const generatedResult =
        await lottoApi.generateCombinations(options);

      setResult(generatedResult);
    } catch (err) {
      setError('조합 생성에 실패했습니다.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">번호 생성</h1>
        <p className="text-gray-600">
          기획안 규칙에 따른 로또 번호 조합을 생성합니다
        </p>
      </div>

      {/* 옵션 설정 */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-8">
        <h2 className="text-xl font-bold mb-4 text-gray-800">생성 옵션</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              제외할 최근 회차 수
            </label>
            <input
              type="number"
              value={options.recentRoundsToExclude}
              onChange={(e) =>
                setOptions({
                  ...options,
                  recentRoundsToExclude: parseInt(e.target.value) || 0,
                })
              }
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
              min="0"
              max="10"
            />
            <p className="text-xs text-gray-500 mt-1">
              최근 N주 내 나온 번호 제외 (기본: 2)
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              분석 윈도우 크기
            </label>
            <input
              type="number"
              value={options.recentWindowSize}
              onChange={(e) =>
                setOptions({
                  ...options,
                  recentWindowSize: parseInt(e.target.value) || 10,
                })
              }
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
              min="5"
              max="50"
            />
            <p className="text-xs text-gray-500 mt-1">
              최근 N주 데이터 분석 (기본: 10)
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              범위별 최소 번호 개수
            </label>
            <input
              type="number"
              value={options.minRangeCount}
              onChange={(e) =>
                setOptions({
                  ...options,
                  minRangeCount: parseInt(e.target.value) || 0,
                })
              }
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
              min="0"
              max="2"
            />
            <p className="text-xs text-gray-500 mt-1">
              각 범위에서 최소 개수 (기본: 0)
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              범위별 최대 번호 개수
            </label>
            <input
              type="number"
              value={options.maxRangeCount}
              onChange={(e) =>
                setOptions({
                  ...options,
                  maxRangeCount: parseInt(e.target.value) || 2,
                })
              }
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
              min="0"
              max="6"
            />
            <p className="text-xs text-gray-500 mt-1">
              각 범위에서 최대 개수 (기본: 2)
            </p>
          </div>
        </div>

        <div className="mt-6">
          <button
            onClick={handleGenerate}
            disabled={loading}
            className="w-full px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors font-bold text-lg disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            {loading ? '생성 중...' : '번호 조합 생성'}
          </button>
        </div>

        {error && (
          <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-red-600">{error}</p>
          </div>
        )}
      </div>

      {/* 결과 표시 */}
      {result && (
        <div className="space-y-6">
          {/* 통계 */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-bold mb-4 text-gray-800">생성 통계</h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-blue-50 p-4 rounded-lg">
                <div className="text-sm text-gray-600 mb-1">총 생성</div>
                <div className="text-2xl font-bold text-blue-600">
                  {result.statistics.beforeFilter.toLocaleString()}
                </div>
              </div>
              <div className="bg-green-50 p-4 rounded-lg">
                <div className="text-sm text-gray-600 mb-1">필터 후</div>
                <div className="text-2xl font-bold text-green-600">
                  {result.statistics.afterFilter.toLocaleString()}
                </div>
              </div>
              <div className="bg-red-50 p-4 rounded-lg">
                <div className="text-sm text-gray-600 mb-1">제외됨</div>
                <div className="text-2xl font-bold text-red-600">
                  {result.statistics.excluded.toLocaleString()}
                </div>
              </div>
            </div>
          </div>

          {/* 5개 일치 조합 */}
          {result.match5Combinations.length > 0 && (
            <div className="bg-white rounded-lg shadow-md p-6">
              <h2 className="text-xl font-bold mb-4 text-gray-800">
                5개 숫자 일치 조합
                <span className="ml-2 text-sm font-normal text-gray-500">
                  ({result.match5Combinations.length}개)
                </span>
              </h2>
              <div className="space-y-3">
                {result.match5Combinations.slice(0, 10).map((combination) => (
                  <div
                    key={combination.id}
                    className="p-4 bg-yellow-50 rounded-lg"
                  >
                    <LottoNumberSet
                      numbers={combination.numbers}
                      showRangeLabels
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 4개 일치 조합 */}
          {result.match4Combinations.length > 0 && (
            <div className="bg-white rounded-lg shadow-md p-6">
              <h2 className="text-xl font-bold mb-4 text-gray-800">
                4개 숫자 일치 조합
                <span className="ml-2 text-sm font-normal text-gray-500">
                  ({result.match4Combinations.length}개)
                </span>
              </h2>
              <div className="space-y-3">
                {result.match4Combinations.slice(0, 10).map((combination) => (
                  <div
                    key={combination.id}
                    className="p-4 bg-blue-50 rounded-lg"
                  >
                    <LottoNumberSet
                      numbers={combination.numbers}
                      showRangeLabels
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 필터링된 조합 */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-bold mb-4 text-gray-800">
              추천 조합
              <span className="ml-2 text-sm font-normal text-gray-500">
                (최대 20개 표시)
              </span>
            </h2>
            <div className="space-y-3">
              {result.filteredCombinations.slice(0, 20).map((combination) => (
                <div
                  key={combination.id}
                  className="p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  <LottoNumberSet numbers={combination.numbers} showRangeLabels />
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
