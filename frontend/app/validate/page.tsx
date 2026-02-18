/**
 * 조합 검증 페이지
 * 기획안 기반 6단계 흐름: 데이터 로딩 → 빈도표 → 필터링 → 조합 생성 → 과거 비교 → 그룹핑
 */

"use client";

import React, { useReducer, useCallback, useEffect, useMemo } from "react";
import * as XLSX from "xlsx-js-style";
import { lottoApi } from "@/lib/api";
import {
  LottoNumber as LottoNumberType,
  LottoDrawResult,
  FrequencyRow,
  FrequencyEntry,
  CombinationGroup,
} from "@/types/lotto";
import {
  getFrequencyTable,
  filterCandidateNumbers,
  splitAndCombine,
  filterByHistoricalMatch,
  groupBySharedNumbersAsync,
  groupByExactSharedCountAsync,
  scoreCombinationsAsync,
  getNumberRange,
} from "@/lib/combination-generator";
import type { ScoredCombination, ScoringWeights } from "@/lib/combination-generator";
import { DEFAULT_WEIGHTS } from "@/lib/combination-generator";

type RangeKey = "단" | "십" | "이" | "삼" | "사";
const RANGE_KEYS: RangeKey[] = ["단", "십", "이", "삼", "사"];

const RANGE_COLORS: Record<RangeKey, string> = {
  단: "bg-yellow-500",
  십: "bg-blue-500",
  이: "bg-red-500",
  삼: "bg-gray-700",
  사: "bg-green-500",
};

const LottoBall = React.memo(function LottoBall({
  num,
  size = "sm",
}: {
  num: LottoNumberType;
  size?: "sm" | "md";
}) {
  const range = getNumberRange(num);
  const color = RANGE_COLORS[range];
  const sizeClass = size === "md" ? "w-10 h-10 text-base" : "w-7 h-7 text-xs";
  return (
    <span
      className={`${color} ${sizeClass} rounded-full inline-flex items-center justify-center text-white font-bold`}
    >
      {num}
    </span>
  );
});

// --- State & Reducer ---

interface ValidateState {
  currentStep: number;
  loading: boolean;
  error: string | null;
  drawCount: number;
  loadMode: "recent" | "range";
  rangeStart: number;
  rangeEnd: number;
  draws: LottoDrawResult[];
  frequencyTable: FrequencyRow[];
  byRange: Record<RangeKey, FrequencyEntry[]> | null;
  count45: number;
  candidates: Record<RangeKey, LottoNumberType[]> | null;
  allCandidates: LottoNumberType[];
  recentNumbers: Set<LottoNumberType>;
  excludedNumbers: Set<LottoNumberType>;
  generatedCombos: LottoNumberType[][];
  filteredCombos: LottoNumberType[][];
  filterStats: { before: number; after: number; excluded: number };
  groups5: CombinationGroup[];
  groups4: CombinationGroup[];
  groups3: CombinationGroup[];
  topCombos: ScoredCombination[];
  allScoredCombos: ScoredCombination[];
  weights: ScoringWeights;
  progress: number;
  progressLabel: string;
}

const initialState: ValidateState = {
  currentStep: 0,
  loading: false,
  error: null,
  drawCount: 100,
  loadMode: "recent",
  rangeStart: 1,
  rangeEnd: 100,
  draws: [],
  frequencyTable: [],
  byRange: null,
  count45: 0,
  candidates: null,
  allCandidates: [],
  recentNumbers: new Set(),
  excludedNumbers: new Set(),
  generatedCombos: [],
  filteredCombos: [],
  filterStats: { before: 0, after: 0, excluded: 0 },
  groups5: [],
  groups4: [],
  groups3: [],
  topCombos: [],
  allScoredCombos: [],
  weights: { ...DEFAULT_WEIGHTS },
  progress: 0,
  progressLabel: "",
};

type ValidateAction =
  | { type: "SET_FIELD"; field: keyof ValidateState; value: unknown }
  | { type: "SET_LOADING"; loading: boolean; error?: string | null }
  | { type: "SET_PROGRESS"; progress: number; label?: string }
  | { type: "LOAD_DATA_SUCCESS"; draws: LottoDrawResult[] }
  | {
      type: "FREQUENCY_TABLE_SUCCESS";
      table: FrequencyRow[];
      byRange: Record<RangeKey, FrequencyEntry[]>;
      count45: number;
    }
  | {
      type: "FILTER_SUCCESS";
      candidates: Record<RangeKey, LottoNumberType[]>;
      allCandidates: LottoNumberType[];
      recentNumbers: Set<LottoNumberType>;
      excludedNumbers: Set<LottoNumberType>;
    }
  | {
      type: "COMBINATION_SUCCESS";
      generatedCombos: LottoNumberType[][];
      filteredCombos: LottoNumberType[][];
      filterStats: { before: number; after: number; excluded: number };
    }
  | {
      type: "GROUPING_SUCCESS";
      groups5: CombinationGroup[];
      groups4: CombinationGroup[];
    }
  | { type: "GROUP3_SUCCESS"; groups3: CombinationGroup[] }
  | {
      type: "SCORE_SUCCESS";
      topCombos: ScoredCombination[];
      allScoredCombos: ScoredCombination[];
    }
  | { type: "SET_RANGE_DEFAULTS"; rangeStart: number; rangeEnd: number }
  | { type: "RESET" };

function reducer(state: ValidateState, action: ValidateAction): ValidateState {
  switch (action.type) {
    case "SET_FIELD":
      return { ...state, [action.field]: action.value };
    case "SET_LOADING":
      return {
        ...state,
        loading: action.loading,
        error: action.error !== undefined ? action.error : state.error,
      };
    case "SET_PROGRESS":
      return {
        ...state,
        progress: action.progress,
        progressLabel:
          action.label !== undefined ? action.label : state.progressLabel,
      };
    case "LOAD_DATA_SUCCESS":
      return {
        ...state,
        draws: action.draws,
        currentStep: 1,
        loading: false,
      };
    case "FREQUENCY_TABLE_SUCCESS":
      return {
        ...state,
        frequencyTable: action.table,
        byRange: action.byRange,
        count45: action.count45,
        currentStep: 2,
      };
    case "FILTER_SUCCESS":
      return {
        ...state,
        candidates: action.candidates,
        allCandidates: action.allCandidates,
        recentNumbers: action.recentNumbers,
        excludedNumbers: action.excludedNumbers,
        currentStep: 3,
      };
    case "COMBINATION_SUCCESS":
      return {
        ...state,
        generatedCombos: action.generatedCombos,
        filteredCombos: action.filteredCombos,
        filterStats: action.filterStats,
        currentStep: 4,
        loading: false,
      };
    case "GROUPING_SUCCESS":
      return {
        ...state,
        groups5: action.groups5,
        groups4: action.groups4,
        currentStep: 5,
        loading: false,
        progress: 0,
        progressLabel: "",
      };
    case "GROUP3_SUCCESS":
      return {
        ...state,
        groups3: action.groups3,
        currentStep: 6,
        loading: false,
        progress: 0,
        progressLabel: "",
      };
    case "SCORE_SUCCESS":
      return {
        ...state,
        topCombos: action.topCombos,
        allScoredCombos: action.allScoredCombos,
        currentStep: 7,
        loading: false,
        progress: 0,
        progressLabel: "",
      };
    case "SET_RANGE_DEFAULTS":
      return {
        ...state,
        rangeStart: action.rangeStart,
        rangeEnd: action.rangeEnd,
      };
    case "RESET":
      return { ...initialState };
    default:
      return state;
  }
}

// --- Component ---

export default function ValidatePage() {
  const [state, dispatch] = useReducer(reducer, initialState);
  const {
    currentStep,
    loading,
    error,
    drawCount,
    loadMode,
    rangeStart,
    rangeEnd,
    draws,
    frequencyTable,
    byRange,
    count45,
    candidates,
    allCandidates,
    recentNumbers,
    excludedNumbers,
    filteredCombos,
    filterStats,
    groups5,
    groups4,
    groups3,
    topCombos,
    allScoredCombos,
    weights,
    progress,
    progressLabel,
  } = state;

  // 최신 회차 기반으로 기본 범위 설정
  useEffect(() => {
    lottoApi
      .healthCheck()
      .then(({ latestRound }) => {
        if (latestRound > 0) {
          dispatch({
            type: "SET_RANGE_DEFAULTS",
            rangeStart: Math.max(1, latestRound - 99),
            rangeEnd: latestRound,
          });
        }
      })
      .catch(() => {});
  }, []);

  // --- Memoized derived data ---

  const sortedRecentNumbers = useMemo(
    () => Array.from(recentNumbers).sort((a, b) => a - b),
    [recentNumbers],
  );

  const sortedExcludedNumbers = useMemo(
    () => Array.from(excludedNumbers).sort((a, b) => a - b),
    [excludedNumbers],
  );

  const frequencyTableRows = useMemo(
    () =>
      frequencyTable.map((row, idx) => {
        const isHighlighted = idx >= 10 && idx <= 18;
        return (
          <tr
            key={row.rank}
            className={`${
              isHighlighted
                ? "bg-yellow-50"
                : idx % 2 === 0
                  ? "bg-white"
                  : "bg-gray-50"
            }`}
          >
            <td className="border border-gray-300 px-3 py-1.5 text-center font-medium text-gray-600">
              {row.rank}
            </td>
            {RANGE_KEYS.map((key) => {
              const entry = row[key] as FrequencyEntry | null;
              return (
                <td
                  key={key}
                  className="border border-gray-300 px-3 py-1.5 text-center"
                >
                  {entry ? (
                    <span className="inline-flex items-center gap-1">
                      <LottoBall num={entry.number} />
                      <span className="text-gray-500 text-xs">
                        ({entry.count})
                      </span>
                    </span>
                  ) : (
                    <span className="text-gray-300">-</span>
                  )}
                </td>
              );
            })}
            <td className="border border-gray-300 px-3 py-1.5 text-center text-gray-600">
              {idx === 0 ? count45 : "-"}
            </td>
          </tr>
        );
      }),
    [frequencyTable, count45],
  );

  const topCombosRendered = useMemo(
    () =>
      topCombos.map((item, idx) => {
        const oddCount = item.numbers.filter((n) => n % 2 === 1).length;
        const total = item.numbers.reduce((s, n) => s + n, 0);
        return (
          <div
            key={idx}
            className={`rounded-lg p-4 ${
              idx < 5
                ? "bg-gradient-to-r from-yellow-50 to-orange-50 border border-yellow-200"
                : idx < 10
                  ? "bg-gray-50"
                  : "bg-white border border-gray-100"
            }`}
          >
            <div className="flex items-center gap-3">
              <span
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                  idx < 5
                    ? "bg-yellow-500 text-white"
                    : idx < 10
                      ? "bg-gray-400 text-white"
                      : "bg-gray-200 text-gray-600"
                }`}
              >
                {idx + 1}
              </span>
              <div className="flex gap-1.5">
                {item.numbers.map((num) => (
                  <LottoBall key={num} num={num} size="md" />
                ))}
              </div>
              <div className="ml-auto flex items-center gap-4">
                <span className="text-lg font-bold text-orange-600">
                  {item.score.toFixed(1)}점
                </span>
              </div>
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5 text-xs">
              <span className="bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded">
                빈도{item.details.frequencyScore.toFixed(0)}
              </span>
              <span className="bg-pink-100 text-pink-700 px-1.5 py-0.5 rounded">
                동반{item.details.coOccurrenceScore.toFixed(0)}
              </span>
              <span className="bg-cyan-100 text-cyan-700 px-1.5 py-0.5 rounded">
                AC{item.details.acScore.toFixed(0)}
              </span>
              <span className="bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded">
                이월{item.details.carryoverScore.toFixed(0)}
              </span>
              <span className="bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">
                균형{item.details.balanceScore.toFixed(0)}
              </span>
              <span className="bg-green-100 text-green-700 px-1.5 py-0.5 rounded">
                합{total}({item.details.sumScore.toFixed(0)})
              </span>
              <span className="bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded">
                홀{oddCount}짝{6 - oddCount}(
                {item.details.oddEvenScore.toFixed(0)})
              </span>
              <span className="bg-rose-100 text-rose-700 px-1.5 py-0.5 rounded">
                연속{item.details.consecutiveScore.toFixed(0)}
              </span>
              <span className="bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded">
                끝수{item.details.lastDigitScore.toFixed(0)}
              </span>
            </div>
          </div>
        );
      }),
    [topCombos],
  );

  // --- Field setters ---

  const setLoadMode = useCallback(
    (v: "recent" | "range") =>
      dispatch({ type: "SET_FIELD", field: "loadMode", value: v }),
    [],
  );
  const setDrawCount = useCallback(
    (v: number) =>
      dispatch({ type: "SET_FIELD", field: "drawCount", value: v }),
    [],
  );
  const setRangeStart = useCallback(
    (v: number) =>
      dispatch({ type: "SET_FIELD", field: "rangeStart", value: v }),
    [],
  );
  const setRangeEnd = useCallback(
    (v: number) => dispatch({ type: "SET_FIELD", field: "rangeEnd", value: v }),
    [],
  );
  const setCurrentStep = useCallback(
    (v: number) =>
      dispatch({ type: "SET_FIELD", field: "currentStep", value: v }),
    [],
  );

  // --- Step handlers ---

  // Step 1: 데이터 로딩
  const handleLoadData = useCallback(async () => {
    try {
      dispatch({ type: "SET_LOADING", loading: true, error: null });
      let recentDraws: LottoDrawResult[];
      if (loadMode === "recent") {
        recentDraws = await lottoApi.getRecentDraws(drawCount);
      } else {
        recentDraws = await lottoApi.getDrawsInRange(rangeStart, rangeEnd);
      }
      dispatch({ type: "LOAD_DATA_SUCCESS", draws: recentDraws });
    } catch (err) {
      dispatch({
        type: "SET_LOADING",
        loading: false,
        error: "데이터 로딩에 실패했습니다. API 서버를 확인해주세요.",
      });
      console.error(err);
    }
  }, [drawCount, loadMode, rangeStart, rangeEnd]);

  // Step 2: 빈도순 정리표 생성
  const handleGenerateFrequencyTable = useCallback(() => {
    const result = getFrequencyTable(draws, drawCount);
    dispatch({
      type: "FREQUENCY_TABLE_SUCCESS",
      table: result.table,
      byRange: result.byRange,
      count45: result.count45,
    });
  }, [draws, drawCount]);

  // Step 3: 10주 내 번호 필터링
  const handleFilterNumbers = useCallback(() => {
    if (!byRange) return;
    const result = filterCandidateNumbers(byRange, draws, 10, 2);
    dispatch({
      type: "FILTER_SUCCESS",
      candidates: result.candidates,
      allCandidates: result.allCandidates,
      recentNumbers: result.recentNumbers,
      excludedNumbers: result.excludedNumbers,
    });
  }, [byRange, draws]);

  // Step 4 & 5: 조합 생성 + 과거 비교 (async/await로 개선)
  const handleGenerateCombinations = useCallback(async () => {
    dispatch({ type: "SET_LOADING", loading: true, error: null });

    // requestAnimationFrame으로 UI 업데이트 후 연산 시작
    await new Promise((r) => requestAnimationFrame(r));

    try {
      const combos = splitAndCombine(allCandidates, 15);
      const result = filterByHistoricalMatch(combos, draws, 3);
      dispatch({
        type: "COMBINATION_SUCCESS",
        generatedCombos: combos,
        filteredCombos: result.filtered,
        filterStats: {
          before: result.beforeCount,
          after: result.afterCount,
          excluded: result.beforeCount - result.afterCount,
        },
      });
    } catch (err) {
      dispatch({
        type: "SET_LOADING",
        loading: false,
        error: "조합 생성 중 오류가 발생했습니다.",
      });
      console.error(err);
    }
  }, [allCandidates, draws]);

  // Step 6: 그룹핑
  const handleGroupCombinations = useCallback(async () => {
    dispatch({ type: "SET_LOADING", loading: true, error: null });
    dispatch({
      type: "SET_PROGRESS",
      progress: 0,
      label: "5개 공유 그룹 분석 중...",
    });
    try {
      const g5 = await groupBySharedNumbersAsync(filteredCombos, 5, (p) =>
        dispatch({ type: "SET_PROGRESS", progress: Math.round(p * 0.5) }),
      );

      dispatch({
        type: "SET_PROGRESS",
        progress: 50,
        label: "4개 공유 그룹 분석 중...",
      });
      const g4 = await groupBySharedNumbersAsync(filteredCombos, 4, (p) =>
        dispatch({
          type: "SET_PROGRESS",
          progress: 50 + Math.round(p * 0.5),
        }),
      );
      dispatch({ type: "GROUPING_SUCCESS", groups5: g5, groups4: g4 });
    } catch (err) {
      dispatch({
        type: "SET_LOADING",
        loading: false,
        error: "그룹핑 중 오류가 발생했습니다.",
      });
      dispatch({ type: "SET_PROGRESS", progress: 0, label: "" });
      console.error(err);
    }
  }, [filteredCombos]);

  // 연산용 조합 제한 (너무 많으면 브라우저 멈춤 방지)
  const MAX_COMBOS = 3000;
  const getLimitedCombos = useCallback((combos: LottoNumberType[][]) => {
    if (combos.length <= MAX_COMBOS) return combos;
    const step = combos.length / MAX_COMBOS;
    const sampled: LottoNumberType[][] = [];
    for (let i = 0; i < MAX_COMBOS; i++) {
      sampled.push(combos[Math.floor(i * step)]);
    }
    return sampled;
  }, []);

  // Step 7: 3개 공유 그룹핑
  const handleGroup3Combinations = useCallback(async () => {
    dispatch({ type: "SET_LOADING", loading: true, error: null });
    dispatch({
      type: "SET_PROGRESS",
      progress: 0,
      label: "3개 공유 그룹 분석 중...",
    });
    try {
      const combos = getLimitedCombos(filteredCombos);
      const g3 = await groupByExactSharedCountAsync(combos, 3, (p) =>
        dispatch({ type: "SET_PROGRESS", progress: p }),
      );
      dispatch({ type: "GROUP3_SUCCESS", groups3: g3 });
    } catch (err) {
      dispatch({
        type: "SET_LOADING",
        loading: false,
        error: "3개 공유 그룹핑 중 오류가 발생했습니다.",
      });
      dispatch({ type: "SET_PROGRESS", progress: 0, label: "" });
      console.error(err);
    }
  }, [filteredCombos, getLimitedCombos]);

  // Step 8: 확률 점수 분석
  const handleScoreCombinations = useCallback(async () => {
    dispatch({ type: "SET_LOADING", loading: true, error: null });
    dispatch({
      type: "SET_PROGRESS",
      progress: 0,
      label: "확률 점수 계산 중...",
    });
    try {
      const { top, pool } = await scoreCombinationsAsync(
        filteredCombos,
        draws,
        50,
        (p) => dispatch({ type: "SET_PROGRESS", progress: p }),
        1000,
        weights,
      );
      dispatch({
        type: "SCORE_SUCCESS",
        topCombos: top,
        allScoredCombos: pool,
      });
    } catch (err) {
      dispatch({
        type: "SET_LOADING",
        loading: false,
        error: "확률 분석 중 오류가 발생했습니다.",
      });
      dispatch({ type: "SET_PROGRESS", progress: 0, label: "" });
      console.error(err);
    }
  }, [filteredCombos, draws, weights]);

  // 엑셀 내보내기
  const handleExportExcel = useCallback(() => {
    if (topCombos.length === 0) return;

    const colCount = 19;
    const colWidths = [
      { wch: 5 },
      { wch: 6 },
      { wch: 6 },
      { wch: 6 },
      { wch: 6 },
      { wch: 6 },
      { wch: 6 },
      { wch: 7 },
      { wch: 7 },
      { wch: 8 },
      { wch: 7 },
      { wch: 7 },
      { wch: 7 },
      { wch: 6 },
      { wch: 8 },
      { wch: 6 },
      { wch: 8 },
      { wch: 7 },
      { wch: 7 },
    ];
    const thinBorder = {
      top: { style: "thin" as const, color: { rgb: "000000" } },
      bottom: { style: "thin" as const, color: { rgb: "000000" } },
      left: { style: "thin" as const, color: { rgb: "000000" } },
      right: { style: "thin" as const, color: { rgb: "000000" } },
    };

    const combosToRows = (combos: ScoredCombination[]) =>
      combos.map((item, idx) => {
        const oddCount = item.numbers.filter((n) => n % 2 === 1).length;
        const total = item.numbers.reduce((s, n) => s + n, 0);
        return {
          순위: idx + 1,
          번호1: item.numbers[0],
          번호2: item.numbers[1],
          번호3: item.numbers[2],
          번호4: item.numbers[3],
          번호5: item.numbers[4],
          번호6: item.numbers[5],
          총점: Number(item.score.toFixed(1)),
          빈도: Number(item.details.frequencyScore.toFixed(1)),
          동반출현: Number(item.details.coOccurrenceScore.toFixed(1)),
          AC값: Number(item.details.acScore.toFixed(1)),
          이월: Number(item.details.carryoverScore.toFixed(1)),
          균형: Number(item.details.balanceScore.toFixed(1)),
          합계: total,
          합계점수: Number(item.details.sumScore.toFixed(1)),
          "홀:짝": `${oddCount}:${6 - oddCount}`,
          홀짝점수: Number(item.details.oddEvenScore.toFixed(1)),
          연속: Number(item.details.consecutiveScore.toFixed(1)),
          끝수: Number(item.details.lastDigitScore.toFixed(1)),
        };
      });

    const applySheetStyle = (
      ws: XLSX.WorkSheet,
      dataLen: number,
      headerColor: string,
    ) => {
      ws["!cols"] = colWidths;
      const rowCount = dataLen + 1;
      for (let r = 0; r < rowCount; r++) {
        for (let c = 0; c < colCount; c++) {
          const cellRef = XLSX.utils.encode_cell({ r, c });
          const cell = ws[cellRef];
          if (!cell) continue;
          cell.s = {
            border: thinBorder,
            alignment: { horizontal: "center", vertical: "center" },
            font: { bold: true, sz: 11 },
          };
          if (r === 0) {
            cell.s = {
              ...cell.s,
              fill: { fgColor: { rgb: headerColor } },
              font: { bold: true, sz: 11, color: { rgb: "000000" } },
            };
          }
          if (r > 0 && c === 0) {
            cell.s = {
              ...cell.s,
              fill: { fgColor: { rgb: "FFFF00" } },
            };
          }
        }
      }
    };

    const ws1 = XLSX.utils.json_to_sheet(combosToRows(topCombos));
    applySheetStyle(ws1, topCombos.length, "FF8C00");

    const ws2 = XLSX.utils.json_to_sheet(combosToRows(allScoredCombos));
    applySheetStyle(ws2, allScoredCombos.length, "4472C4");

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws1, "추천 조합");
    XLSX.utils.book_append_sheet(
      wb,
      ws2,
      `전체 후보 (${allScoredCombos.length}개)`,
    );
    XLSX.writeFile(wb, `로또_추천조합_TOP${topCombos.length}.xlsx`);
  }, [topCombos, allScoredCombos]);

  const steps = [
    { label: "데이터 로딩", description: "최근 100주 당첨 데이터" },
    { label: "빈도순 정리표", description: "100주간 번호 출현 빈도" },
    { label: "번호 필터링", description: "10주 내 번호 필터링" },
    { label: "조합 생성", description: "후보 번호에서 조합 생성" },
    { label: "과거 비교", description: "과거 데이터와 비교 필터링" },
    { label: "그룹핑 결과", description: "최종 추천 조합" },
    { label: "3개 공유 조합", description: "3개만 같은 다양한 조합" },
    { label: "확률 분석", description: "확률 기반 최종 추천" },
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">조합 검증</h1>
        <p className="text-gray-600">
          기획안 기반 로또 번호 조합 생성 및 검증 시스템
        </p>
      </div>

      {/* 스텝 인디케이터 */}
      <div className="mb-8 overflow-x-auto">
        <div className="flex items-center min-w-max gap-1">
          {steps.map((step, idx) => (
            <div key={idx} className="flex items-center">
              <div
                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm ${
                  idx < currentStep
                    ? "bg-green-100 text-green-800"
                    : idx === currentStep
                      ? "bg-blue-100 text-blue-800 font-bold"
                      : "bg-gray-100 text-gray-400"
                }`}
              >
                <span
                  className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                    idx < currentStep
                      ? "bg-green-500 text-white"
                      : idx === currentStep
                        ? "bg-blue-500 text-white"
                        : "bg-gray-300 text-white"
                  }`}
                >
                  {idx < currentStep ? "✓" : idx + 1}
                </span>
                <span className="whitespace-nowrap">{step.label}</span>
              </div>
              {idx < steps.length - 1 && (
                <div
                  className={`w-6 h-0.5 ${
                    idx < currentStep ? "bg-green-300" : "bg-gray-200"
                  }`}
                />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* 에러 표시 */}
      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-red-600 font-medium">{error}</p>
        </div>
      )}

      {/* 진행률 표시 */}
      {loading && progressLabel && (
        <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex items-center justify-between mb-2">
            <span className="text-blue-800 font-medium">{progressLabel}</span>
            <span className="text-blue-600 text-sm">{progress}%</span>
          </div>
          <div className="w-full bg-blue-200 rounded-full h-2.5">
            <div
              className="bg-blue-600 h-2.5 rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}

      {/* Step 0: 시작 */}
      {currentStep === 0 && (
        <div className="bg-white rounded-lg shadow-md p-8">
          <h2 className="text-2xl font-bold text-gray-800 mb-2 text-center">
            조합 생성 시작
          </h2>
          <p className="text-gray-600 mb-6 text-center">
            당첨 데이터를 기반으로 로또 번호 조합을 자동 생성합니다.
          </p>

          {/* 로딩 모드 선택 */}
          <div className="max-w-md mx-auto space-y-4">
            <div className="flex gap-2">
              <button
                onClick={() => setLoadMode("recent")}
                className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-colors ${
                  loadMode === "recent"
                    ? "bg-blue-500 text-white"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                최근 N회차
              </button>
              <button
                onClick={() => setLoadMode("range")}
                className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-colors ${
                  loadMode === "range"
                    ? "bg-blue-500 text-white"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                회차 범위 지정
              </button>
            </div>

            {loadMode === "recent" ? (
              <div className="bg-gray-50 rounded-lg p-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  분석 회차 수
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    value={drawCount}
                    onChange={(e) =>
                      setDrawCount(
                        Math.max(
                          10,
                          Math.min(500, parseInt(e.target.value) || 100),
                        ),
                      )
                    }
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-center text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    min="10"
                    max="500"
                  />
                  <span className="text-sm text-gray-500">회</span>
                </div>
                <p className="text-xs text-gray-400 mt-1">
                  최신 회차부터 역순으로 {drawCount}회차를 불러옵니다
                </p>
              </div>
            ) : (
              <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    시작 회차
                  </label>
                  <input
                    type="number"
                    value={rangeStart}
                    onChange={(e) =>
                      setRangeStart(parseInt(e.target.value) || 1)
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    min="1"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    종료 회차
                  </label>
                  <input
                    type="number"
                    value={rangeEnd}
                    onChange={(e) => setRangeEnd(parseInt(e.target.value) || 1)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    min="1"
                  />
                </div>
                <p className="text-xs text-gray-400">
                  {rangeStart}회 ~ {rangeEnd}회 (
                  {Math.abs(rangeEnd - rangeStart) + 1}회차)
                </p>
              </div>
            )}

            <button
              onClick={handleLoadData}
              disabled={loading}
              className="w-full px-8 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors font-bold disabled:bg-gray-400"
            >
              {loading
                ? "로딩 중..."
                : loadMode === "recent"
                  ? `최근 ${drawCount}회 데이터 로딩`
                  : `${rangeStart}회 ~ ${rangeEnd}회 데이터 로딩`}
            </button>
          </div>
        </div>
      )}

      {/* Step 1: 데이터 로딩 완료 */}
      {currentStep >= 1 && (
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-gray-800">
              Step 1: 데이터 로딩 완료
            </h2>
            <button
              onClick={() => setCurrentStep(0)}
              className="text-sm text-blue-500 hover:text-blue-700 font-medium"
            >
              설정 변경
            </button>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div className="bg-gray-50 p-3 rounded-lg">
              <div className="text-gray-500">총 회차</div>
              <div className="text-lg font-bold text-gray-900">
                {draws.length}회
              </div>
            </div>
            <div className="bg-gray-50 p-3 rounded-lg">
              <div className="text-gray-500">최신 회차</div>
              <div className="text-lg font-bold text-gray-900">
                {Math.max(
                  draws[0]?.round || 0,
                  draws[draws.length - 1]?.round || 0,
                )}
                회
              </div>
            </div>
            <div className="bg-gray-50 p-3 rounded-lg">
              <div className="text-gray-500">시작 회차</div>
              <div className="text-lg font-bold text-gray-900">
                {Math.min(
                  draws[0]?.round || 0,
                  draws[draws.length - 1]?.round || 0,
                )}
                회
              </div>
            </div>
            <div className="bg-gray-50 p-3 rounded-lg">
              <div className="text-gray-500">기간</div>
              <div className="text-lg font-bold text-gray-900">
                {draws[draws.length - 1]?.drawDate || "-"} ~{" "}
                {draws[0]?.drawDate || "-"}
              </div>
            </div>
          </div>
          {currentStep === 1 && (
            <button
              onClick={handleGenerateFrequencyTable}
              className="mt-4 px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors font-bold"
            >
              다음: 빈도순 정리표 생성
            </button>
          )}
        </div>
      )}

      {/* Step 2: 100주 빈도순 정리표 */}
      {currentStep >= 2 && (
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-xl font-bold text-gray-800 mb-4">
            Step 2: {draws.length}주 DATA 빈도순 정리표
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-gray-100">
                  <th className="border border-gray-300 px-3 py-2 text-center">
                    순위
                  </th>
                  {RANGE_KEYS.map((key) => (
                    <th
                      key={key}
                      className="border border-gray-300 px-3 py-2 text-center"
                    >
                      <span
                        className={`${RANGE_COLORS[key]} text-white px-2 py-0.5 rounded text-xs`}
                      >
                        {key}번대
                      </span>
                    </th>
                  ))}
                  <th className="border border-gray-300 px-3 py-2 text-center">
                    45
                  </th>
                </tr>
              </thead>
              <tbody>{frequencyTableRows}</tbody>
            </table>
          </div>
          <p className="mt-2 text-xs text-gray-500">
            노란색 강조: 11번~19번 행 (필터링 대상 범위)
          </p>
          {currentStep === 2 && (
            <button
              onClick={handleFilterNumbers}
              className="mt-4 px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors font-bold"
            >
              다음: 10주 내 번호 필터링
            </button>
          )}
        </div>
      )}

      {/* Step 3: 10주 내 번호 필터링 */}
      {currentStep >= 3 && candidates && (
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-xl font-bold text-gray-800 mb-4">
            Step 3: 10주 내 번호 필터링
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            {/* 최근 10주 출현 번호 */}
            <div className="bg-blue-50 rounded-lg p-4">
              <h3 className="font-bold text-blue-800 mb-2">
                최근 10주 출현 번호
              </h3>
              <div className="flex flex-wrap gap-1.5">
                {sortedRecentNumbers.map((num) => (
                  <LottoBall key={num} num={num} />
                ))}
              </div>
              <p className="mt-2 text-xs text-blue-600">
                {recentNumbers.size}개 번호
              </p>
            </div>

            {/* 최근 2주 번호 (제외 대상) */}
            <div className="bg-red-50 rounded-lg p-4">
              <h3 className="font-bold text-red-800 mb-2">
                최근 2주 번호
                {/* (제외) */}
              </h3>
              <div className="flex flex-wrap gap-1.5">
                {sortedExcludedNumbers.map((num) => (
                  <LottoBall key={num} num={num} />
                ))}
              </div>
              <p className="mt-2 text-xs text-red-600">
                {excludedNumbers.size}개 번호
                {/* 제외 */}
              </p>
            </div>
          </div>

          {/* 범대별 최종 후보 */}
          <div className="bg-green-50 rounded-lg p-4">
            <h3 className="font-bold text-green-800 mb-3">
              최종 후보 번호 (범대별)
            </h3>
            <div className="space-y-2">
              {RANGE_KEYS.map((key) => (
                <div key={key} className="flex items-center gap-3">
                  <span
                    className={`${RANGE_COLORS[key]} text-white px-2 py-0.5 rounded text-xs font-bold w-14 text-center`}
                  >
                    {key}번대
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {candidates[key].length > 0 ? (
                      candidates[key].map((num) => (
                        <LottoBall key={num} num={num} size="md" />
                      ))
                    ) : (
                      <span className="text-gray-400 text-sm">없음</span>
                    )}
                  </div>
                  <span className="text-xs text-gray-500">
                    ({candidates[key].length}개)
                  </span>
                </div>
              ))}
            </div>
            <div className="mt-3 pt-3 border-t border-green-200">
              <span className="font-bold text-green-800">
                총 후보: {allCandidates.length}개
              </span>
              <div className="flex flex-wrap gap-1.5 mt-2">
                {allCandidates.map((num) => (
                  <LottoBall key={num} num={num} size="md" />
                ))}
              </div>
            </div>
          </div>

          {currentStep === 3 && (
            <button
              onClick={handleGenerateCombinations}
              disabled={loading || allCandidates.length < 6}
              className="mt-4 px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors font-bold disabled:bg-gray-400"
            >
              {loading
                ? "조합 생성 중..."
                : allCandidates.length < 6
                  ? "후보 번호가 6개 미만입니다"
                  : `다음: ${allCandidates.length}개 번호로 조합 생성`}
            </button>
          )}
        </div>
      )}

      {/* Step 4 & 5: 조합 생성 + 과거 비교 결과 */}
      {currentStep >= 4 && (
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-xl font-bold text-gray-800 mb-4">
            Step 4-5: 조합 생성 및 과거 데이터 비교
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="bg-blue-50 rounded-lg p-4 text-center">
              <div className="text-sm text-blue-600">생성된 조합 수</div>
              <div className="text-2xl font-bold text-blue-800">
                {filterStats.before.toLocaleString()}개
              </div>
              <div className="text-xs text-blue-500">
                C({Math.min(allCandidates.length, 15)},6) x{" "}
                {Math.ceil(allCandidates.length / 15)} 그룹
              </div>
            </div>
            <div className="bg-red-50 rounded-lg p-4 text-center">
              <div className="text-sm text-red-600">제외된 조합 수</div>
              <div className="text-2xl font-bold text-red-800">
                {filterStats.excluded.toLocaleString()}개
              </div>
              <div className="text-xs text-red-500">
                과거 100회와 4개 이상 일치
              </div>
            </div>
            <div className="bg-green-50 rounded-lg p-4 text-center">
              <div className="text-sm text-green-600">최종 조합 수</div>
              <div className="text-2xl font-bold text-green-800">
                {filterStats.after.toLocaleString()}개
              </div>
              <div className="text-xs text-green-500">
                필터율:{" "}
                {filterStats.before > 0
                  ? ((filterStats.excluded / filterStats.before) * 100).toFixed(
                      1,
                    )
                  : 0}
                %
              </div>
            </div>
          </div>

          {/* 필터링된 조합 미리보기 */}
          <div className="bg-gray-50 rounded-lg p-4">
            <h3 className="font-bold text-gray-700 mb-3">
              필터링된 조합 미리보기 (상위 20개)
            </h3>
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {filteredCombos.slice(0, 20).map((combo, idx) => (
                <div
                  key={idx}
                  className="flex items-center gap-2 bg-white p-2 rounded"
                >
                  <span className="text-xs text-gray-400 w-8 text-right">
                    #{idx + 1}
                  </span>
                  <div className="flex gap-1.5">
                    {combo.map((num) => (
                      <LottoBall key={num} num={num} size="md" />
                    ))}
                  </div>
                </div>
              ))}
              {filteredCombos.length > 20 && (
                <p className="text-xs text-gray-400 text-center py-2">
                  ... 외 {(filteredCombos.length - 20).toLocaleString()}개 조합
                </p>
              )}
            </div>
          </div>

          {currentStep === 4 && (
            <button
              onClick={handleGroupCombinations}
              disabled={loading || filteredCombos.length === 0}
              className="mt-4 px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors font-bold disabled:bg-gray-400"
            >
              {loading ? `그룹핑 중... ${progress}%` : "다음: 그룹핑 분석"}
            </button>
          )}
        </div>
      )}

      {/* Step 6: 그룹핑 결과 */}
      {currentStep >= 5 && (
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-xl font-bold text-gray-800 mb-4">
            Step 6: 그룹핑 결과
          </h2>

          {/* 5개 공유 그룹 */}
          <div className="mb-6">
            <h3 className="font-bold text-purple-800 mb-3 flex items-center gap-2">
              <span className="bg-purple-100 text-purple-800 px-2 py-0.5 rounded text-sm">
                5개 번호 공유 그룹
              </span>
              <span className="text-sm text-gray-500">
                {groups5.length}개 그룹
              </span>
            </h3>
            {groups5.length > 0 ? (
              <div className="space-y-4 max-h-96 overflow-y-auto">
                {groups5.map((group, gIdx) => (
                  <div key={gIdx} className="bg-purple-50 rounded-lg p-4">
                    <div className="mb-2">
                      <span className="text-xs text-purple-600 font-medium">
                        공유 번호:
                      </span>
                      <div className="flex gap-1.5 mt-1">
                        {group.sharedNumbers.map((num) => (
                          <LottoBall key={num} num={num} size="md" />
                        ))}
                      </div>
                    </div>
                    <div className="space-y-1">
                      {group.combinations.map((combo, cIdx) => (
                        <div
                          key={cIdx}
                          className="flex items-center gap-2 bg-white p-2 rounded"
                        >
                          <div className="flex gap-1.5">
                            {combo.numbers.map((num) => (
                              <LottoBall key={num} num={num} />
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                    <span className="text-xs text-purple-500">
                      {group.combinations.length}개 조합
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-400 text-sm">
                5개 번호를 공유하는 그룹이 없습니다.
              </p>
            )}
          </div>

          {/* 4개 공유 그룹 */}
          <div>
            <h3 className="font-bold text-indigo-800 mb-3 flex items-center gap-2">
              <span className="bg-indigo-100 text-indigo-800 px-2 py-0.5 rounded text-sm">
                4개 번호 공유 그룹
              </span>
              <span className="text-sm text-gray-500">
                {groups4.length}개 그룹
              </span>
            </h3>
            {groups4.length > 0 ? (
              <div className="space-y-4 max-h-96 overflow-y-auto">
                {groups4.slice(0, 30).map((group, gIdx) => (
                  <div key={gIdx} className="bg-indigo-50 rounded-lg p-4">
                    <div className="mb-2">
                      <span className="text-xs text-indigo-600 font-medium">
                        공유 번호:
                      </span>
                      <div className="flex gap-1.5 mt-1">
                        {group.sharedNumbers.map((num) => (
                          <LottoBall key={num} num={num} size="md" />
                        ))}
                      </div>
                    </div>
                    <div className="space-y-1">
                      {group.combinations.map((combo, cIdx) => (
                        <div
                          key={cIdx}
                          className="flex items-center gap-2 bg-white p-2 rounded"
                        >
                          <div className="flex gap-1.5">
                            {combo.numbers.map((num) => (
                              <LottoBall key={num} num={num} />
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                    <span className="text-xs text-indigo-500">
                      {group.combinations.length}개 조합
                    </span>
                  </div>
                ))}
                {groups4.length > 30 && (
                  <p className="text-xs text-gray-400 text-center py-2">
                    ... 외 {groups4.length - 30}개 그룹
                  </p>
                )}
              </div>
            ) : (
              <p className="text-gray-400 text-sm">
                4개 번호를 공유하는 그룹이 없습니다.
              </p>
            )}
          </div>

          {currentStep === 5 && (
            <button
              onClick={handleGroup3Combinations}
              disabled={loading || filteredCombos.length === 0}
              className="mt-4 px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors font-bold disabled:bg-gray-400"
            >
              {loading
                ? `그룹핑 중... ${progress}%`
                : "다음: 3개 공유 조합 분석"}
            </button>
          )}
        </div>
      )}

      {/* Step 7: 3개 공유 그룹핑 결과 */}
      {currentStep >= 6 && (
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-xl font-bold text-gray-800 mb-4">
            Step 7: 3개 공유 조합 (다양한 조합)
          </h2>
          <p className="text-sm text-gray-500 mb-4">
            3개 번호만 공유하고 나머지 3개가 다른 조합 그룹입니다. 더 넓은 번호
            범위를 커버합니다.
          </p>

          <div className="mb-4">
            <span className="bg-teal-100 text-teal-800 px-2 py-0.5 rounded text-sm font-bold">
              3개 번호 공유 그룹
            </span>
            <span className="text-sm text-gray-500 ml-2">
              {groups3.length}개 그룹
            </span>
          </div>

          {groups3.length > 0 ? (
            <div className="space-y-4 max-h-[600px] overflow-y-auto">
              {groups3.slice(0, 50).map((group, gIdx) => (
                <div key={gIdx} className="bg-teal-50 rounded-lg p-4">
                  <div className="mb-2">
                    <span className="text-xs text-teal-600 font-medium">
                      공유 번호:
                    </span>
                    <div className="flex gap-1.5 mt-1">
                      {group.sharedNumbers.map((num) => (
                        <LottoBall key={num} num={num} size="md" />
                      ))}
                    </div>
                  </div>
                  <div className="space-y-1">
                    {group.combinations.map((combo, cIdx) => (
                      <div
                        key={cIdx}
                        className="flex items-center gap-2 bg-white p-2 rounded"
                      >
                        <div className="flex gap-1.5">
                          {combo.numbers.map((num) => {
                            const isShared = group.sharedNumbers.includes(num);
                            return (
                              <span
                                key={num}
                                className={
                                  isShared ? "opacity-100" : "opacity-60"
                                }
                              >
                                <LottoBall num={num} />
                              </span>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                  <span className="text-xs text-teal-500">
                    {group.combinations.length}개 조합
                  </span>
                </div>
              ))}
              {groups3.length > 50 && (
                <p className="text-xs text-gray-400 text-center py-2">
                  ... 외 {groups3.length - 50}개 그룹
                </p>
              )}
            </div>
          ) : (
            <p className="text-gray-400 text-sm">
              3개 번호만 공유하는 그룹이 없습니다.
            </p>
          )}

          {currentStep === 6 && (
            <div className="mt-4 p-4 bg-gray-50 rounded-lg">
              <h3 className="text-sm font-bold text-gray-700 mb-3">Step 8 채점 가중치 설정</h3>
              {(() => {
                const weightSum = Math.round(
                  Object.values(weights).reduce((s, v) => s + v * 100, 0),
                );
                const isValid = weightSum === 100;
                const items: { key: keyof ScoringWeights; label: string; bg: string; text: string; bold: string }[] = [
                  { key: "frequency", label: "빈도", bg: "bg-orange-50", text: "text-orange-600", bold: "text-orange-800" },
                  { key: "coOccurrence", label: "동반출현", bg: "bg-pink-50", text: "text-pink-600", bold: "text-pink-800" },
                  { key: "ac", label: "AC값", bg: "bg-cyan-50", text: "text-cyan-600", bold: "text-cyan-800" },
                  { key: "carryover", label: "이월번호", bg: "bg-amber-50", text: "text-amber-600", bold: "text-amber-800" },
                  { key: "balance", label: "범대균형", bg: "bg-blue-50", text: "text-blue-600", bold: "text-blue-800" },
                  { key: "sumRange", label: "합계범위", bg: "bg-green-50", text: "text-green-600", bold: "text-green-800" },
                  { key: "oddEven", label: "홀짝균형", bg: "bg-purple-50", text: "text-purple-600", bold: "text-purple-800" },
                  { key: "consecutive", label: "연속번호", bg: "bg-rose-50", text: "text-rose-600", bold: "text-rose-800" },
                  { key: "lastDigit", label: "끝수다양", bg: "bg-indigo-50", text: "text-indigo-600", bold: "text-indigo-800" },
                ];
                return (
                  <>
                    <div className="grid grid-cols-3 md:grid-cols-5 gap-2 mb-2">
                      {items.map(({ key, label, bg, text, bold }) => (
                        <div key={key} className={`${bg} rounded-lg p-2 text-center`}>
                          <div className={`text-xs ${text}`}>{label}</div>
                          <div className="flex items-center justify-center gap-1 mt-1">
                            <input
                              type="number"
                              min="0"
                              max="100"
                              step="5"
                              value={Math.round(weights[key] * 100)}
                              onChange={(e) => {
                                const val = Math.max(0, Math.min(100, parseInt(e.target.value) || 0));
                                dispatch({
                                  type: "SET_FIELD",
                                  field: "weights",
                                  value: { ...weights, [key]: val / 100 },
                                });
                              }}
                              className={`w-12 px-1 py-0.5 text-center text-sm font-bold ${bold} border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent`}
                            />
                            <span className={`text-xs ${text}`}>%</span>
                          </div>
                        </div>
                      ))}
                      <div className="rounded-lg p-2 flex items-center justify-center">
                        <button
                          onClick={handleScoreCombinations}
                          disabled={loading || !isValid || filteredCombos.length === 0}
                          className="px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors text-sm font-bold disabled:bg-gray-400 whitespace-nowrap"
                        >
                          {loading ? `${progress}%` : "조회"}
                        </button>
                      </div>
                    </div>
                    <div className={`text-sm text-center font-medium ${isValid ? "text-green-600" : "text-red-600"}`}>
                      합계: {weightSum}% {!isValid && "(100%가 되어야 합니다)"}
                      {isValid && (
                        <button
                          onClick={() =>
                            dispatch({
                              type: "SET_FIELD",
                              field: "weights",
                              value: { ...DEFAULT_WEIGHTS },
                            })
                          }
                          className="ml-3 text-xs text-gray-400 hover:text-gray-600 underline"
                        >
                          기본값 복원
                        </button>
                      )}
                    </div>
                  </>
                );
              })()}
            </div>
          )}
        </div>
      )}

      {/* Step 8: 확률 분석 최종 추천 */}
      {currentStep >= 7 && (
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-xl font-bold text-gray-800 mb-4">
            Step 8: 확률 기반 최종 추천
          </h2>
          <p className="text-sm text-gray-500 mb-4">
            9가지 기준으로 점수를 매겨 상위 50개 조합을 추천합니다.
          </p>

          {(() => {
            const weightSum = Math.round(
              Object.values(weights).reduce((s, v) => s + v * 100, 0),
            );
            const isValid = weightSum === 100;
            const weightItems: {
              key: keyof ScoringWeights;
              label: string;
              bg: string;
              text: string;
              bold: string;
            }[] = [
              { key: "frequency", label: "빈도", bg: "bg-orange-50", text: "text-orange-600", bold: "text-orange-800" },
              { key: "coOccurrence", label: "동반출현", bg: "bg-pink-50", text: "text-pink-600", bold: "text-pink-800" },
              { key: "ac", label: "AC값", bg: "bg-cyan-50", text: "text-cyan-600", bold: "text-cyan-800" },
              { key: "carryover", label: "이월번호", bg: "bg-amber-50", text: "text-amber-600", bold: "text-amber-800" },
              { key: "balance", label: "범대균형", bg: "bg-blue-50", text: "text-blue-600", bold: "text-blue-800" },
              { key: "sumRange", label: "합계범위", bg: "bg-green-50", text: "text-green-600", bold: "text-green-800" },
              { key: "oddEven", label: "홀짝균형", bg: "bg-purple-50", text: "text-purple-600", bold: "text-purple-800" },
              { key: "consecutive", label: "연속번호", bg: "bg-rose-50", text: "text-rose-600", bold: "text-rose-800" },
              { key: "lastDigit", label: "끝수다양", bg: "bg-indigo-50", text: "text-indigo-600", bold: "text-indigo-800" },
            ];
            return (
              <div className="mb-6">
                <div className="grid grid-cols-3 md:grid-cols-5 gap-2 mb-2">
                  {weightItems.map(({ key, label, bg, text, bold }) => (
                    <div key={key} className={`${bg} rounded-lg p-2 text-center`}>
                      <div className={`text-xs ${text}`}>{label}</div>
                      <div className="flex items-center justify-center gap-1 mt-1">
                        <input
                          type="number"
                          min="0"
                          max="100"
                          step="5"
                          value={Math.round(weights[key] * 100)}
                          onChange={(e) => {
                            const val = Math.max(0, Math.min(100, parseInt(e.target.value) || 0));
                            dispatch({
                              type: "SET_FIELD",
                              field: "weights",
                              value: { ...weights, [key]: val / 100 },
                            });
                          }}
                          className={`w-12 px-1 py-0.5 text-center text-sm font-bold ${bold} border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent`}
                        />
                        <span className={`text-xs ${text}`}>%</span>
                      </div>
                    </div>
                  ))}
                  <div className="rounded-lg p-2 flex items-center justify-center">
                    <button
                      onClick={handleScoreCombinations}
                      disabled={loading || !isValid}
                      className="px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors text-sm font-bold disabled:bg-gray-400 whitespace-nowrap"
                    >
                      {loading ? `${progress}%` : "재조회"}
                    </button>
                  </div>
                </div>
                <div className={`text-sm text-center font-medium ${isValid ? "text-green-600" : "text-red-600"}`}>
                  합계: {weightSum}% {!isValid && "(100%가 되어야 합니다)"}
                  {isValid && (
                    <button
                      onClick={() =>
                        dispatch({
                          type: "SET_FIELD",
                          field: "weights",
                          value: { ...DEFAULT_WEIGHTS },
                        })
                      }
                      className="ml-3 text-xs text-gray-400 hover:text-gray-600 underline"
                    >
                      기본값 복원
                    </button>
                  )}
                </div>
              </div>
            );
          })()}

          {topCombos.length > 0 ? (
            <div className="space-y-3">{topCombosRendered}</div>
          ) : (
            <p className="text-gray-400 text-sm">추천 조합이 없습니다.</p>
          )}

          {/* 엑셀 내보내기 */}
          {topCombos.length > 0 && (
            <div className="mt-4 flex justify-end">
              <button
                onClick={handleExportExcel}
                className="flex items-center gap-2 px-5 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-bold"
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  />
                </svg>
                엑셀로 내보내기
              </button>
            </div>
          )}

          {/* 최종 요약 */}
          <div className="mt-6 bg-gradient-to-r from-blue-50 to-green-50 rounded-lg p-4">
            <h3 className="font-bold text-gray-800 mb-2">최종 요약</h3>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-sm">
              <div>
                <span className="text-gray-500">분석 데이터</span>
                <div className="font-bold text-gray-500">
                  {draws.length}회차
                </div>
              </div>
              <div>
                <span className="text-gray-500">후보 번호</span>
                <div className="font-bold text-gray-500">
                  {allCandidates.length}개
                </div>
              </div>
              <div>
                <span className="text-gray-500">최종 조합</span>
                <div className="font-bold text-gray-500">
                  {filterStats.after.toLocaleString()}개
                </div>
              </div>
              <div>
                <span className="text-gray-500">그룹 (5/4/3)</span>
                <div className="font-bold text-gray-500">
                  {groups5.length} / {groups4.length} / {groups3.length}
                </div>
              </div>
              <div>
                <span className="text-gray-500">추천 TOP</span>
                <div className="font-bold text-orange-600">
                  {topCombos.length}개
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 전체 리셋 버튼 */}
      {currentStep > 0 && (
        <div className="text-center mt-6">
          <button
            onClick={() => dispatch({ type: "RESET" })}
            className="px-6 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors"
          >
            처음부터 다시 시작
          </button>
        </div>
      )}
    </div>
  );
}
