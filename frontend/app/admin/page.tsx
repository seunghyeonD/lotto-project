/**
 * 관리자 페이지 - 실제 로또 데이터 가져오기
 */

'use client';

import { useState, useEffect } from 'react';
import { lottoApi } from '@/lib/api';
import { LottoDrawResult } from '@/types/lotto';
import { LottoNumberSet } from '@/components/LottoNumberSet';

export default function AdminPage() {
  const [round, setRound] = useState<number>(1207);
  const [startRound, setStartRound] = useState<number>(1200);
  const [endRound, setEndRound] = useState<number>(1207);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [result, setResult] = useState<LottoDrawResult | null>(null);
  const [results, setResults] = useState<LottoDrawResult[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [latestRound, setLatestRound] = useState<number>(1207);

  // 수동 입력용 상태
  const [manualRound, setManualRound] = useState<number>(1208);
  const [manualDate, setManualDate] = useState<string>('');
  const [manualNumbers, setManualNumbers] = useState<string>('');
  const [manualBonus, setManualBonus] = useState<string>('');


  // 초기 로드 시 최신 회차 정보 가져오기
  useEffect(() => {
    const fetchLatestRound = async () => {
      try {
        const healthData = await lottoApi.healthCheck();
        setLatestRound(healthData.latestRound);
        setRound(healthData.latestRound);
        setEndRound(healthData.latestRound);
        setStartRound(Math.max(1, healthData.latestRound - 10));
        setManualRound(healthData.latestRound + 1);
      } catch (error) {
        console.error('Failed to fetch latest round:', error);
      }
    };

    fetchLatestRound();
  }, []);

  const handleFetchSingle = async () => {
    setLoading(true);
    setError(null);
    setResult(null);
    setSuccessMessage(null);

    // 회차 유효성 검증
    if (round > latestRound) {
      setError(`현재 추첨되지 않은 회차입니다. (최신 회차: ${latestRound}회)`);
      setLoading(false);
      return;
    }

    if (round < 1) {
      setError('회차는 1 이상이어야 합니다.');
      setLoading(false);
      return;
    }

    try {
      // DB에서 조회
      const data = await lottoApi.getDrawByRound(round);

      if (data) {
        setResult(data);
        setSuccessMessage(`${round}회 데이터를 조회했습니다!`);
      } else {
        setError('데이터를 찾을 수 없습니다. 회차 번호를 확인해주세요.');
      }
    } catch (err: any) {
      setError(`오류: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleFetchMultiple = async () => {
    if (startRound > endRound) {
      setError('시작 회차가 종료 회차보다 클 수 없습니다.');
      return;
    }

    if (endRound > latestRound) {
      setError(`현재 추첨되지 않은 회차입니다. (최신 회차: ${latestRound}회)`);
      return;
    }

    if (startRound < 1) {
      setError('시작 회차는 1 이상이어야 합니다.');
      return;
    }

    if (endRound - startRound > 100) {
      setError('한 번에 최대 100개 회차까지만 조회할 수 있습니다.');
      return;
    }

    setLoading(true);
    setError(null);
    setResults([]);
    setSuccessMessage(null);

    try {
      // DB에서 조회
      const data = await lottoApi.getDrawsInRange(startRound, endRound);

      setResults(data);

      if (data.length > 0) {
        setSuccessMessage(
          `${data.length}개 회차 데이터를 조회했습니다!`,
        );
      } else {
        setError('조회된 데이터가 없습니다.');
      }
    } catch (err: any) {
      setError(`오류: ${err.message}`);
    } finally {
      setLoading(false);
      setProgress({ current: 0, total: 0 });
    }
  };

  const handleGetLatestRound = async () => {
    setLoading(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const healthData = await lottoApi.healthCheck();
      const latest = healthData.latestRound;
      setLatestRound(latest);
      setRound(latest);
      setEndRound(latest);
      setStartRound(Math.max(1, latest - 10));
      setManualRound(latest + 1);
      setSuccessMessage(`최신 회차: ${latest}회 (DB에 ${healthData.totalRounds}개 회차 저장됨)`);
    } catch (err: any) {
      setError(`오류: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleManualInput = async () => {
    setLoading(true);
    setError(null);
    setSuccessMessage(null);

    try {
      // 번호 파싱
      const numbers = manualNumbers
        .split(',')
        .map((n) => parseInt(n.trim()))
        .filter((n) => !isNaN(n) && n >= 1 && n <= 45);

      const bonusNumber = parseInt(manualBonus.trim());

      // 유효성 검증
      if (numbers.length !== 6) {
        setError('6개의 번호를 입력해주세요. (예: 1, 2, 3, 4, 5, 6)');
        return;
      }

      if (isNaN(bonusNumber) || bonusNumber < 1 || bonusNumber > 45) {
        setError('보너스 번호는 1~45 사이의 숫자여야 합니다.');
        return;
      }

      if (!manualDate) {
        setError('추첨일을 입력해주세요.');
        return;
      }

      const drawData: LottoDrawResult = {
        round: manualRound,
        drawDate: manualDate,
        numbers: numbers.sort((a, b) => a - b),
        bonusNumber,
      };

      // 백엔드에 저장
      await lottoApi.addDraw(drawData);

      setResult(drawData);
      setSuccessMessage(`${manualRound}회 데이터가 수동으로 저장되었습니다!`);

      // 입력 필드 초기화
      setManualNumbers('');
      setManualBonus('');
      setManualDate('');
      setManualRound(manualRound + 1);
    } catch (err: any) {
      setError(`오류: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          관리자 - 로또 데이터 관리
        </h1>
        <p className="text-gray-600">
          데이터베이스에서 로또 당첨번호를 조회하고 수동으로 추가할 수 있습니다
        </p>
      </div>

      {/* 최신 회차 확인 */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <h2 className="text-xl font-bold mb-4 text-gray-800">최신 회차 확인</h2>
        <button
          onClick={handleGetLatestRound}
          disabled={loading}
          className="px-6 py-3 bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition-colors font-bold disabled:bg-gray-400"
        >
          {loading ? '확인 중...' : '최신 회차 확인'}
        </button>
      </div>

      {/* 단일 회차 조회 */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <h2 className="text-xl font-bold mb-4 text-gray-800">
          단일 회차 조회
        </h2>
        <div className="flex flex-col sm:flex-row gap-4 sm:items-end mb-4">
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              회차 번호 (1~{latestRound}회)
            </label>
            <input
              type="number"
              value={round}
              onChange={(e) => setRound(parseInt(e.target.value) || 1)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
              min="1"
              max={latestRound}
            />
          </div>
          <button
            onClick={handleFetchSingle}
            disabled={loading}
            className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors font-bold disabled:bg-gray-400"
          >
            {loading ? '조회 중...' : '조회하기'}
          </button>
        </div>

        {result && (
          <div className="mt-6 p-4 bg-green-50 rounded-lg">
            <div className="flex justify-between items-center mb-3">
              <span className="font-bold text-lg text-gray-800">
                {result.round}회
              </span>
              <span className="text-sm text-gray-600">{result.drawDate}</span>
            </div>
            <LottoNumberSet
              numbers={result.numbers}
              bonusNumber={result.bonusNumber}
              showRangeLabels
            />
          </div>
        )}
      </div>

      {/* 수동 데이터 입력 */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <h2 className="text-xl font-bold mb-4 text-gray-800">
          수동 데이터 입력
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              회차 번호
            </label>
            <input
              type="number"
              value={manualRound}
              onChange={(e) => setManualRound(parseInt(e.target.value) || 1)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
              min="1"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              추첨일 (YYYY-MM-DD)
            </label>
            <input
              type="date"
              value={manualDate}
              onChange={(e) => setManualDate(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
            />
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              당첨 번호 (쉼표로 구분)
            </label>
            <input
              type="text"
              value={manualNumbers}
              onChange={(e) => setManualNumbers(e.target.value)}
              placeholder="예: 1, 5, 12, 23, 34, 42"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              보너스 번호
            </label>
            <input
              type="number"
              value={manualBonus}
              onChange={(e) => setManualBonus(e.target.value)}
              placeholder="예: 15"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
              min="1"
              max="45"
            />
          </div>
        </div>
        <button
          onClick={handleManualInput}
          disabled={loading}
          className="w-full px-6 py-3 bg-indigo-500 text-white rounded-lg hover:bg-indigo-600 transition-colors font-bold disabled:bg-gray-400"
        >
          {loading ? '저장 중...' : '수동으로 데이터 저장'}
        </button>
      </div>

      {/* 여러 회차 조회 */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <h2 className="text-xl font-bold mb-4 text-gray-800">
          여러 회차 조회
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              시작 회차 (1~{latestRound}회)
            </label>
            <input
              type="number"
              value={startRound}
              onChange={(e) => setStartRound(parseInt(e.target.value) || 1)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
              min="1"
              max={latestRound}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              종료 회차 (1~{latestRound}회)
            </label>
            <input
              type="number"
              value={endRound}
              onChange={(e) => setEndRound(parseInt(e.target.value) || 1)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
              min="1"
              max={latestRound}
            />
          </div>
        </div>

        <button
          onClick={handleFetchMultiple}
          disabled={loading}
          className="w-full px-6 py-3 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors font-bold disabled:bg-gray-400"
        >
          {loading ? '조회 중...' : '여러 회차 조회하기'}
        </button>

        {results.length > 0 && (
          <div className="mt-6 space-y-3 max-h-96 overflow-y-auto">
            {results.map((draw) => (
              <div key={draw.round} className="p-4 bg-gray-50 rounded-lg">
                <div className="flex justify-between items-center mb-2">
                  <span className="font-bold text-gray-800">{draw.round}회</span>
                  <span className="text-sm text-gray-600">{draw.drawDate}</span>
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
        )}
      </div>

      {/* 메시지 */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
          <p className="text-red-600">{error}</p>
        </div>
      )}

      {successMessage && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <p className="text-green-600">{successMessage}</p>
        </div>
      )}

      {/* 안내 사항 */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-4">
        <h3 className="font-bold text-blue-900 mb-2">📌 사용 안내</h3>
        <ul className="text-sm text-blue-800 space-y-1">
          <li>
            • <strong>데이터베이스 조회:</strong> PostgreSQL에 저장된 로또 데이터를 조회합니다
          </li>
          <li>
            • <strong>단일 회차 조회:</strong> 특정 회차의 당첨번호를 확인할 수 있습니다
          </li>
          <li>
            • <strong>여러 회차 조회:</strong> 최대 100개 회차를 한 번에 조회할 수 있습니다
          </li>
          <li>
            • <strong>수동 입력:</strong> 새로운 회차 데이터를 직접 입력하여 추가할 수 있습니다
          </li>
          <li>• 현재 데이터베이스에 1207개 회차가 저장되어 있습니다</li>
        </ul>
      </div>

      <div className="bg-green-50 border border-green-200 rounded-lg p-6">
        <h3 className="font-bold text-green-900 mb-2">✅ 데이터베이스 정보</h3>
        <p className="text-sm text-green-800 mb-2">
          모든 로또 데이터가 PostgreSQL에 안전하게 저장되어 있습니다.
        </p>
        <ul className="text-sm text-green-800 space-y-1">
          <li>
            • <strong>저장된 회차:</strong> 1회 (2002-12-07) ~ 1207회 (2026-01-17)
          </li>
          <li>
            • <strong>데이터 조회:</strong> 즉시 조회 가능, 스크래핑 불필요
          </li>
          <li>
            • <strong>데이터 추가:</strong> 수동 입력으로 새 회차 추가 가능
          </li>
        </ul>
      </div>
    </div>
  );
}
