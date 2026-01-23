/**
 * 조합 검증 페이지
 */

'use client';

import React, { useState } from 'react';
import { lottoApi } from '@/lib/api';
import {
  CombinationValidationResult,
  LottoNumber as LottoNumberType,
} from '@/types/lotto';
import { NumberPicker } from '@/components/NumberPicker';
import { LottoNumberSet } from '@/components/LottoNumberSet';

export default function ValidatePage() {
  const [selectedNumbers, setSelectedNumbers] = useState<LottoNumberType[]>([]);
  const [roundRange, setRoundRange] = useState({ start: 1, end: 100 });
  const [results, setResults] = useState<CombinationValidationResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleValidate = async () => {
    if (selectedNumbers.length !== 6) {
      setError('6개의 번호를 선택해주세요.');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const validationResults = await lottoApi.validateCombination({
        numbers: selectedNumbers,
        startRound: roundRange.start,
        endRound: roundRange.end,
      });

      setResults(validationResults);
    } catch (err) {
      setError('검증에 실패했습니다.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const getMatchStats = () => {
    const matchCounts = results.reduce(
      (acc, result) => {
        acc[result.matchCount] = (acc[result.matchCount] || 0) + 1;
        return acc;
      },
      {} as Record<number, number>,
    );

    return matchCounts;
  };

  const matchStats = results.length > 0 ? getMatchStats() : {};

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">조합 검증</h1>
        <p className="text-gray-600">
          선택한 번호의 과거 당첨번호와의 일치도를 분석합니다
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* 번호 선택 */}
        <div className="space-y-6">
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-bold mb-4 text-gray-800">
              번호 선택
            </h2>
            <NumberPicker
              selectedNumbers={selectedNumbers}
              onChange={setSelectedNumbers}
            />
          </div>

          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-bold mb-4 text-gray-800">
              검증 범위
            </h2>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  시작 회차
                </label>
                <input
                  type="number"
                  value={roundRange.start}
                  onChange={(e) =>
                    setRoundRange({
                      ...roundRange,
                      start: parseInt(e.target.value) || 1,
                    })
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
                    setRoundRange({
                      ...roundRange,
                      end: parseInt(e.target.value) || 100,
                    })
                  }
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
                  min="1"
                />
              </div>
            </div>

            <button
              onClick={handleValidate}
              disabled={loading || selectedNumbers.length !== 6}
              className="w-full px-6 py-3 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors font-bold disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              {loading ? '검증 중...' : '검증 시작'}
            </button>

            {error && (
              <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-red-600">{error}</p>
              </div>
            )}
          </div>
        </div>

        {/* 결과 표시 */}
        <div className="space-y-6">
          {selectedNumbers.length === 6 && (
            <div className="bg-white rounded-lg shadow-md p-6">
              <h2 className="text-xl font-bold mb-4 text-gray-800">
                선택된 번호
              </h2>
              <div className="flex justify-center">
                <LottoNumberSet numbers={selectedNumbers} size="lg" showRangeLabels />
              </div>
            </div>
          )}

          {results.length > 0 && (
            <>
              {/* 매칭 통계 */}
              <div className="bg-white rounded-lg shadow-md p-6">
                <h2 className="text-xl font-bold mb-4 text-gray-800">
                  일치 통계
                </h2>
                <div className="space-y-2">
                  {[6, 5, 4, 3, 2, 1, 0].map((count) => (
                    <div
                      key={count}
                      className="flex justify-between items-center p-3 bg-gray-50 rounded-lg"
                    >
                      <span className="font-medium text-gray-700">
                        {count}개 일치
                      </span>
                      <span className="font-bold text-blue-600">
                        {matchStats[count] || 0}회
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* 상세 결과 */}
              <div className="bg-white rounded-lg shadow-md p-6">
                <h2 className="text-xl font-bold mb-4 text-gray-800">
                  상세 결과
                  <span className="ml-2 text-sm font-normal text-gray-500">
                    (3개 이상 일치만 표시)
                  </span>
                </h2>
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {results
                    .filter((result) => result.matchCount >= 3)
                    .map((result) => (
                      <div
                        key={result.round}
                        className={`p-4 rounded-lg ${
                          result.matchCount === 6
                            ? 'bg-yellow-100 border-2 border-yellow-400'
                            : result.matchCount === 5
                              ? 'bg-orange-100 border-2 border-orange-400'
                              : result.matchCount === 4
                                ? 'bg-blue-100 border-2 border-blue-400'
                                : 'bg-gray-100'
                        }`}
                      >
                        <div className="flex justify-between items-center mb-2">
                          <span className="font-bold text-gray-800">
                            {result.round}회
                          </span>
                          <span
                            className={`px-3 py-1 rounded-full text-sm font-bold ${
                              result.matchCount === 6
                                ? 'bg-yellow-500 text-white'
                                : result.matchCount === 5
                                  ? 'bg-orange-500 text-white'
                                  : result.matchCount === 4
                                    ? 'bg-blue-500 text-white'
                                    : 'bg-gray-500 text-white'
                            }`}
                          >
                            {result.matchCount}개 일치
                          </span>
                        </div>
                        <div className="flex gap-2">
                          {result.matchedNumbers.map((num) => (
                            <div
                              key={num}
                              className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center text-white font-bold text-sm"
                            >
                              {num}
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
