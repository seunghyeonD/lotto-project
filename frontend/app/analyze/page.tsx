/**
 * 조합 번호 검증 페이지
 * 선택한 번호의 과거 당첨번호와의 일치도를 분석
 */

'use client';

import React, { useState, useEffect } from 'react';
import * as XLSX from 'xlsx-js-style';
import { lottoApi } from '@/lib/api';
import {
  CombinationValidationResult,
  LottoDrawResult,
  LottoNumber as LottoNumberType,
} from '@/types/lotto';
import { NumberPicker } from '@/components/NumberPicker';
import { LottoNumberSet } from '@/components/LottoNumberSet';

export default function AnalyzePage() {
  const [selectedNumbers, setSelectedNumbers] = useState<LottoNumberType[]>([]);
  const [roundRange, setRoundRange] = useState({ start: 1, end: 100 });
  const [latestRound, setLatestRound] = useState(0);
  const [selectedRound, setSelectedRound] = useState<number | null>(null);
  const [roundLoading, setRoundLoading] = useState(false);

  useEffect(() => {
    lottoApi.healthCheck().then(({ latestRound: lr }) => {
      if (lr > 0) {
        setLatestRound(lr);
        setRoundRange({ start: 1, end: lr });
      }
    }).catch(() => {});
  }, []);

  const handleRoundSelect = async (round: number | null) => {
    setSelectedRound(round);
    if (round === null) {
      setSelectedNumbers([]);
      if (latestRound > 0) {
        setRoundRange({ start: 1, end: latestRound });
      }
      setResults([]);
      setResults100([]);
      setResults200([]);
      return;
    }
    try {
      setRoundLoading(true);
      const draw = await lottoApi.getDrawByRound(round);
      setSelectedNumbers(draw.numbers.slice(0, 6).sort((a, b) => a - b) as LottoNumberType[]);
      // 회차 선택 시 자동으로 100회/200회 검증 실행
      const start100 = Math.max(1, round - 100);
      const end100 = round - 1;
      const start200 = Math.max(1, round - 200);
      const end200 = round - 1;

      if (end100 >= 1) {
        const [res100, res200] = await Promise.all([
          lottoApi.validateCombination({
            numbers: draw.numbers.slice(0, 6) as LottoNumberType[],
            startRound: start100,
            endRound: end100,
          }),
          lottoApi.validateCombination({
            numbers: draw.numbers.slice(0, 6) as LottoNumberType[],
            startRound: start200,
            endRound: end200,
          }),
        ]);
        setResults100(res100);
        setResults200(res200);
      } else {
        setResults100([]);
        setResults200([]);
      }
      setResults([]);
    } catch (err) {
      setError('회차 데이터를 불러오는데 실패했습니다.');
      console.error(err);
    } finally {
      setRoundLoading(false);
    }
  };

  const [results, setResults] = useState<CombinationValidationResult[]>([]);
  const [results100, setResults100] = useState<CombinationValidationResult[]>([]);
  const [results200, setResults200] = useState<CombinationValidationResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isRoundMode = selectedRound !== null;

  const handleValidate = async () => {
    if (selectedNumbers.length === 0 || selectedNumbers.length > 10) {
      setError('1개에서 10개 사이의 번호를 선택해주세요.');
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

  const getMatchStats = (data: CombinationValidationResult[]) => {
    const matchCounts = data.reduce(
      (acc, result) => {
        acc[result.matchCount] = (acc[result.matchCount] || 0) + 1;
        return acc;
      },
      {} as Record<number, number>,
    );

    return matchCounts;
  };

  const matchStats = results.length > 0 ? getMatchStats(results) : {};
  const matchStats100 = results100.length > 0 ? getMatchStats(results100) : {};
  const matchStats200 = results200.length > 0 ? getMatchStats(results200) : {};

  const [excelLoading, setExcelLoading] = useState(false);
  const [excelProgress, setExcelProgress] = useState('');

  const handleExcelDownload = async () => {
    try {
      setExcelLoading(true);
      setExcelProgress('데이터 로딩 중...');

      const allDraws = await lottoApi.getAllDraws();
      const drawMap = new Map<number, LottoDrawResult>();
      for (const d of allDraws) drawMap.set(d.round, d);

      // 1회부터 최신 회차까지 전체 범위
      const maxRound = Math.max(...allDraws.map(d => d.round), latestRound);

      setExcelProgress('일치통계 계산 중...');

      // 1회차: 2002-12-07 (토), 이후 매주 7일 간격
      const getDrawDate = (r: number) => {
        const first = new Date(2002, 11, 7); // 2002-12-07
        const d = new Date(first.getTime() + (r - 1) * 7 * 24 * 60 * 60 * 1000);
        return d.toISOString().slice(0, 10);
      };

      // 각 회차별 이전 100회와의 일치 통계 계산
      const rows: { round: number; date: string; counts: number[]; hasData: boolean }[] = [];
      for (let round = 1; round <= maxRound; round++) {
        const draw = drawMap.get(round);
        if (!draw) {
          rows.push({ round, date: getDrawDate(round), counts: [], hasData: false });
          continue;
        }

        const nums = draw.numbers.slice(0, 6);
        const counts = [0, 0, 0, 0, 0, 0, 0]; // 0~6개 일치

        // 이전 100회차
        let compared = 0;
        for (let prev = round - 1; prev >= Math.max(1, round - 100); prev--) {
          const prevDraw = drawMap.get(prev);
          if (!prevDraw) continue;
          const prevNums = prevDraw.numbers.slice(0, 6);
          const matchCount = nums.filter(n => prevNums.includes(n)).length;
          counts[matchCount]++;
          compared++;
        }

        rows.push({
          round: draw.round,
          date: draw.drawDate,
          counts: compared > 0 ? counts : [],
          hasData: true,
        });
      }

      setExcelProgress('엑셀 생성 중...');

      const wb = XLSX.utils.book_new();

      // 헤더 스타일
      const headerStyle = {
        font: { bold: true, color: { rgb: 'FFFFFF' } },
        fill: { fgColor: { rgb: 'FF0000' } },
        alignment: { horizontal: 'center' as const, vertical: 'center' as const },
        border: {
          top: { style: 'thin' as const },
          bottom: { style: 'thin' as const },
          left: { style: 'thin' as const },
          right: { style: 'thin' as const },
        },
      };

      const subHeaderStyle = {
        font: { bold: true },
        alignment: { horizontal: 'center' as const, vertical: 'center' as const },
        border: {
          top: { style: 'thin' as const },
          bottom: { style: 'thin' as const },
          left: { style: 'thin' as const },
          right: { style: 'thin' as const },
        },
      };

      const cellStyle = {
        alignment: { horizontal: 'center' as const },
        border: {
          top: { style: 'thin' as const },
          bottom: { style: 'thin' as const },
          left: { style: 'thin' as const },
          right: { style: 'thin' as const },
        },
      };

      const sumStyle = {
        alignment: { horizontal: 'center' as const },
        fill: { fgColor: { rgb: 'FFFF00' } },
        border: {
          top: { style: 'thin' as const },
          bottom: { style: 'thin' as const },
          left: { style: 'thin' as const },
          right: { style: 'thin' as const },
        },
      };

      // 워크시트 데이터 구성
      const wsData: any[][] = [];

      // Row 0: 번호정리 + 100주 동안 당첨번호중 나온 갯수 의 수
      wsData.push(['', '번호정리', '', '100주 동안 당첨번호중 나온 갯수 의 수', '', '', '', '', '', '', '']);

      // Row 1: 회차, 일자, 0~6, 합
      wsData.push(['', '회차', '일자', '0', '1', '2', '3', '4', '5', '6', '합']);

      // Data rows
      for (let i = 0; i < rows.length; i++) {
        const r = rows[i];
        const rowIdx = i + 3; // 1-based Excel row (0-indexed wsData row + 1)
        if (!r.hasData) {
          // DB에 데이터 없는 회차 (날짜는 계산값 사용)
          wsData.push([i + 1, r.round, r.date, '', '', '', '', '', '', '', '-']);
        } else if (r.counts.length > 0) {
          const row: any[] = [
            i + 1,
            r.round,
            r.date,
            r.counts[0] || '',
            r.counts[1] || '',
            r.counts[2] || '',
            r.counts[3] || '',
            r.counts[4] ? r.counts[4] : (r.counts[4] === 0 ? '-' : ''),
            r.counts[5] ? r.counts[5] : (r.counts[5] === 0 ? '-' : ''),
            r.counts[6] ? r.counts[6] : (r.counts[6] === 0 ? '-' : ''),
            { f: `SUM(D${rowIdx}:J${rowIdx})` },
          ];
          wsData.push(row);
        } else {
          // 데이터는 있지만 비교할 이전 회차가 없는 경우
          wsData.push([i + 1, r.round, r.date, '', '', '', '', '', '', '', '-']);
        }
      }

      const ws = XLSX.utils.aoa_to_sheet(wsData);

      // 열 너비
      ws['!cols'] = [
        { wch: 5 },  // 번호
        { wch: 8 },  // 회차
        { wch: 12 }, // 일자
        { wch: 6 },  // 0
        { wch: 6 },  // 1
        { wch: 6 },  // 2
        { wch: 6 },  // 3
        { wch: 6 },  // 4
        { wch: 6 },  // 5
        { wch: 6 },  // 6
        { wch: 6 },  // 합
      ];

      // 머지: 번호정리 (B1:C1), 100주... (D1:K1)
      ws['!merges'] = [
        { s: { r: 0, c: 1 }, e: { r: 0, c: 2 } },
        { s: { r: 0, c: 3 }, e: { r: 0, c: 10 } },
      ];

      // 스타일 적용
      const range = XLSX.utils.decode_range(ws['!ref'] || 'A1');
      for (let R = range.s.r; R <= range.e.r; R++) {
        for (let C = range.s.c; C <= range.e.c; C++) {
          const addr = XLSX.utils.encode_cell({ r: R, c: C });
          if (!ws[addr]) ws[addr] = { v: '', t: 's' };

          if (R === 0 && C >= 3) {
            ws[addr].s = headerStyle;
          } else if (R === 0) {
            ws[addr].s = subHeaderStyle;
          } else if (R === 1) {
            ws[addr].s = subHeaderStyle;
          } else if (C === 10) {
            // 합 열 = 노란색
            ws[addr].s = sumStyle;
          } else {
            ws[addr].s = cellStyle;
          }
        }
      }

      XLSX.utils.book_append_sheet(wb, ws, '번호정리');
      XLSX.writeFile(wb, `로또_일치통계_전체.xlsx`);

      setExcelProgress('');
    } catch (err) {
      setError('엑셀 다운로드에 실패했습니다.');
      console.error(err);
    } finally {
      setExcelLoading(false);
    }
  };

  const handleComboExcelDownload = async () => {
    if (selectedNumbers.length < 6) {
      setError('6개 이상의 번호를 선택해주세요.');
      return;
    }

    try {
      setExcelLoading(true);
      setExcelProgress('데이터 로딩 중...');

      // 최근 100회차 데이터 가져오기
      const recentDraws = await lottoApi.getRecentDraws(100);
      recentDraws.sort((a, b) => b.round - a.round);

      setExcelProgress('조합 생성 중...');

      // C(n, 6) 조합 생성
      const nums = [...selectedNumbers].sort((a, b) => a - b);
      const combos: number[][] = [];
      const n = nums.length;

      for (let a = 0; a < n - 5; a++)
        for (let b = a + 1; b < n - 4; b++)
          for (let c = b + 1; c < n - 3; c++)
            for (let d = c + 1; d < n - 2; d++)
              for (let e = d + 1; e < n - 1; e++)
                for (let f = e + 1; f < n; f++)
                  combos.push([nums[a], nums[b], nums[c], nums[d], nums[e], nums[f]]);

      setExcelProgress(`${combos.length}개 조합 일치통계 계산 중...`);

      // 각 조합별 최근 100회와의 일치 통계 계산
      const comboStats: { combo: number[]; counts: number[] }[] = [];
      for (const combo of combos) {
        const counts = [0, 0, 0, 0, 0, 0, 0]; // 0~6개 일치
        for (const draw of recentDraws) {
          const drawNums = draw.numbers.slice(0, 6);
          const matchCount = combo.filter(n => drawNums.includes(n)).length;
          counts[matchCount]++;
        }
        comboStats.push({ combo, counts });
      }

      setExcelProgress('엑셀 생성 중...');

      const wb = XLSX.utils.book_new();

      const headerStyle = {
        font: { bold: true, color: { rgb: 'FFFFFF' } },
        fill: { fgColor: { rgb: 'FF0000' } },
        alignment: { horizontal: 'center' as const, vertical: 'center' as const },
        border: {
          top: { style: 'thin' as const }, bottom: { style: 'thin' as const },
          left: { style: 'thin' as const }, right: { style: 'thin' as const },
        },
      };

      const subHeaderStyle = {
        font: { bold: true },
        alignment: { horizontal: 'center' as const, vertical: 'center' as const },
        border: {
          top: { style: 'thin' as const }, bottom: { style: 'thin' as const },
          left: { style: 'thin' as const }, right: { style: 'thin' as const },
        },
      };

      const cellStyle = {
        alignment: { horizontal: 'center' as const },
        border: {
          top: { style: 'thin' as const }, bottom: { style: 'thin' as const },
          left: { style: 'thin' as const }, right: { style: 'thin' as const },
        },
      };

      const sumStyle = {
        alignment: { horizontal: 'center' as const },
        fill: { fgColor: { rgb: 'FFFF00' } },
        border: {
          top: { style: 'thin' as const }, bottom: { style: 'thin' as const },
          left: { style: 'thin' as const }, right: { style: 'thin' as const },
        },
      };

      const comboStyle = {
        font: { bold: true },
        alignment: { horizontal: 'center' as const },
        fill: { fgColor: { rgb: 'E0F0FF' } },
        border: {
          top: { style: 'thin' as const }, bottom: { style: 'thin' as const },
          left: { style: 'thin' as const }, right: { style: 'thin' as const },
        },
      };

      // 워크시트 데이터
      const wsData: any[][] = [];

      // 최근 회차 범위 표시
      const latestDraw = recentDraws[0];
      const oldestDraw = recentDraws[recentDraws.length - 1];

      // Row 0: 헤더
      wsData.push([
        '', '조합 번호', '', '', '', '', '',
        `최근 100회 일치통계 (${oldestDraw.round}~${latestDraw.round}회)`, '', '', '', '', '', '', '',
      ]);

      // Row 1: 서브 헤더
      wsData.push([
        'No', 'N1', 'N2', 'N3', 'N4', 'N5', 'N6',
        '0', '1', '2', '3', '4', '5', '6', '합',
      ]);

      // Data rows
      for (let i = 0; i < comboStats.length; i++) {
        const { combo, counts } = comboStats[i];
        const rowIdx = i + 3; // Excel 1-based row
        wsData.push([
          i + 1,
          combo[0], combo[1], combo[2], combo[3], combo[4], combo[5],
          counts[0] || '',
          counts[1] || '',
          counts[2] || '',
          counts[3] || '',
          counts[4] ? counts[4] : (counts[4] === 0 ? '-' : ''),
          counts[5] ? counts[5] : (counts[5] === 0 ? '-' : ''),
          counts[6] ? counts[6] : (counts[6] === 0 ? '-' : ''),
          { f: `SUM(H${rowIdx}:N${rowIdx})` },
        ]);
      }

      const ws = XLSX.utils.aoa_to_sheet(wsData);

      // 열 너비
      ws['!cols'] = [
        { wch: 5 },  // No
        { wch: 5 }, { wch: 5 }, { wch: 5 }, { wch: 5 }, { wch: 5 }, { wch: 5 }, // N1~N6
        { wch: 6 }, { wch: 6 }, { wch: 6 }, { wch: 6 }, { wch: 6 }, { wch: 6 }, { wch: 6 }, // 0~6
        { wch: 6 },  // 합
      ];

      // 머지: 조합 번호 (B1:G1), 일치통계 (H1:O1)
      ws['!merges'] = [
        { s: { r: 0, c: 1 }, e: { r: 0, c: 6 } },
        { s: { r: 0, c: 7 }, e: { r: 0, c: 14 } },
      ];

      // 스타일 적용
      const range = XLSX.utils.decode_range(ws['!ref'] || 'A1');
      for (let R = range.s.r; R <= range.e.r; R++) {
        for (let C = range.s.c; C <= range.e.c; C++) {
          const addr = XLSX.utils.encode_cell({ r: R, c: C });
          if (!ws[addr]) ws[addr] = { v: '', t: 's' };

          if (R === 0 && C >= 7) {
            ws[addr].s = headerStyle;
          } else if (R === 0) {
            ws[addr].s = subHeaderStyle;
          } else if (R === 1) {
            ws[addr].s = subHeaderStyle;
          } else if (C >= 1 && C <= 6) {
            ws[addr].s = comboStyle;
          } else if (C === 14) {
            ws[addr].s = sumStyle;
          } else {
            ws[addr].s = cellStyle;
          }
        }
      }

      XLSX.utils.book_append_sheet(wb, ws, '조합 일치통계');
      XLSX.writeFile(wb, `로또_조합_일치통계_${nums.join('-')}.xlsx`);

      setExcelProgress('');
    } catch (err) {
      setError('엑셀 다운로드에 실패했습니다.');
      console.error(err);
    } finally {
      setExcelLoading(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">조합 번호</h1>
        <p className="text-gray-600">
          선택한 번호의 과거 당첨번호와의 일치도를 분석합니다
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* 번호 선택 */}
        <div className="space-y-6">
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-gray-800">
                번호 선택
              </h2>
              <div className="flex items-center gap-2">
                <label className="text-sm font-bold text-blue-800 whitespace-nowrap">
                  특정 회차
                </label>
                <select
                  value={selectedRound ?? ''}
                  onChange={(e) => {
                    const val = e.target.value;
                    handleRoundSelect(val === '' ? null : parseInt(val));
                  }}
                  className="w-36 px-3 py-2 border border-blue-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 bg-white text-sm"
                >
                  <option value="">선택 안함</option>
                  {latestRound > 0 && Array.from({ length: latestRound }, (_, i) => latestRound - i).map((round) => (
                    <option key={round} value={round}>
                      {round}회차
                    </option>
                  ))}
                </select>
                {roundLoading && (
                  <span className="text-sm text-blue-600">로딩중...</span>
                )}
              </div>
            </div>

            <NumberPicker
              selectedNumbers={selectedNumbers}
              onChange={isRoundMode ? () => {} : setSelectedNumbers}
              maxSelection={10}
              onRandom={(numbers) => {
                setSelectedRound(null);
                setResults100([]);
                setResults200([]);
                setSelectedNumbers(numbers);
              }}
              onClear={() => {
                setSelectedRound(null);
                setResults100([]);
                setResults200([]);
                setSelectedNumbers([]);
              }}
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
                  value={isRoundMode ? Math.max(1, selectedRound! - 200) : roundRange.start}
                  onChange={(e) =>
                    setRoundRange({
                      ...roundRange,
                      start: parseInt(e.target.value) || 1,
                    })
                  }
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 disabled:bg-gray-100 disabled:text-gray-500"
                  min="1"
                  disabled={isRoundMode}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  종료 회차
                </label>
                <input
                  type="number"
                  value={isRoundMode ? selectedRound! - 1 : roundRange.end}
                  onChange={(e) =>
                    setRoundRange({
                      ...roundRange,
                      end: parseInt(e.target.value) || 100,
                    })
                  }
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 disabled:bg-gray-100 disabled:text-gray-500"
                  min="1"
                  disabled={isRoundMode}
                />
              </div>
            </div>

            {isRoundMode && (
              <p className="text-sm text-gray-500 mb-4">
                회차 선택 모드에서는 검증범위가 자동 설정됩니다.
              </p>
            )}

            <button
              onClick={handleValidate}
              disabled={loading || isRoundMode || selectedNumbers.length === 0 || selectedNumbers.length > 10}
              className="w-full px-6 py-3 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors font-bold disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              {loading ? '검증 중...' : isRoundMode ? '회차 선택 시 자동 검증됨' : '검증 시작'}
            </button>

            {isRoundMode && (
              <button
                onClick={handleExcelDownload}
                disabled={excelLoading}
                className="w-full mt-3 px-6 py-3 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors font-bold disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                {excelLoading ? excelProgress || '처리 중...' : '전체 회차 일치통계 엑셀 다운로드'}
              </button>
            )}

            {!isRoundMode && selectedNumbers.length >= 6 && (
              <button
                onClick={handleComboExcelDownload}
                disabled={excelLoading}
                className="w-full mt-3 px-6 py-3 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors font-bold disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                {excelLoading ? excelProgress || '처리 중...' : `조합 일치통계 엑셀 다운로드 (C(${selectedNumbers.length},6) = ${Math.round((() => { const n = selectedNumbers.length; let r = 1; for (let i = 0; i < 6; i++) r = r * (n - i) / (i + 1); return r; })())}개)`}
              </button>
            )}

            {error && (
              <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-red-600">{error}</p>
              </div>
            )}
          </div>
        </div>

        {/* 결과 표시 */}
        <div className="space-y-6">
          {selectedNumbers.length > 0 && (
            <div className="bg-white rounded-lg shadow-md p-6">
              <h2 className="text-xl font-bold mb-4 text-gray-800">
                선택된 번호
              </h2>
              <div className="flex justify-center">
                <LottoNumberSet numbers={selectedNumbers} size="lg" showRangeLabels />
              </div>
            </div>
          )}

          {/* 회차 선택 모드: 100회/200회 분리 통계 */}
          {isRoundMode && (results100.length > 0 || results200.length > 0) && (
            <>
              <div className="bg-white rounded-lg shadow-md p-6">
                <h2 className="text-xl font-bold mb-4 text-gray-800">
                  일치 통계
                  <span className="ml-2 text-sm font-normal text-gray-500">
                    ({selectedRound}회차 기준)
                  </span>
                </h2>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b-2 border-gray-200">
                        <th className="text-left py-3 px-2 text-gray-700 font-bold">일치 개수</th>
                        <th className="text-center py-3 px-2 text-blue-600 font-bold">
                          이전 100회
                          <span className="block text-xs font-normal text-gray-500">
                            ({Math.max(1, selectedRound! - 100)}~{selectedRound! - 1}회)
                          </span>
                        </th>
                        <th className="text-center py-3 px-2 text-purple-600 font-bold">
                          이전 200회
                          <span className="block text-xs font-normal text-gray-500">
                            ({Math.max(1, selectedRound! - 200)}~{selectedRound! - 1}회)
                          </span>
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {[6, 5, 4, 3, 2, 1, 0].map((count) => (
                        <tr key={count} className="border-b border-gray-100 hover:bg-gray-50">
                          <td className="py-3 px-2 font-medium text-gray-700">{count}개 일치</td>
                          <td className="py-3 px-2 text-center font-bold text-blue-600">
                            {matchStats100[count] || 0}회
                          </td>
                          <td className="py-3 px-2 text-center font-bold text-purple-600">
                            {matchStats200[count] || 0}회
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* 상세 결과 (200회 기준) */}
              <div className="bg-white rounded-lg shadow-md p-6">
                <h2 className="text-xl font-bold mb-4 text-gray-800">
                  상세 결과
                  <span className="ml-2 text-sm font-normal text-gray-500">
                    (이전 200회 중 3개 이상 일치만 표시)
                  </span>
                </h2>
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {results200
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

          {/* 일반 모드: 기존 통계 */}
          {!isRoundMode && results.length > 0 && (
            <>
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
