/**
 * 번호 선택 컴포넌트
 */

'use client';

import React, { useState } from 'react';
import { LottoNumber } from './LottoNumber';
import { LottoNumber as LottoNumberType } from '@/types/lotto';

interface NumberPickerProps {
  selectedNumbers: LottoNumberType[];
  onChange: (numbers: LottoNumberType[]) => void;
  maxSelection?: number;
}

export const NumberPicker: React.FC<NumberPickerProps> = ({
  selectedNumbers,
  onChange,
  maxSelection = 6,
}) => {
  const allNumbers = Array.from({ length: 45 }, (_, i) => i + 1);

  const handleNumberClick = (number: LottoNumberType) => {
    if (selectedNumbers.includes(number)) {
      onChange(selectedNumbers.filter((n) => n !== number));
    } else {
      if (selectedNumbers.length < maxSelection) {
        onChange([...selectedNumbers, number].sort((a, b) => a - b));
      }
    }
  };

  const handleClear = () => {
    onChange([]);
  };

  const handleRandom = () => {
    const shuffled = [...allNumbers].sort(() => Math.random() - 0.5);
    onChange(shuffled.slice(0, maxSelection).sort((a, b) => a - b));
  };

  const ranges = [
    { label: '단번대 (1-10)', numbers: allNumbers.slice(0, 10) },
    { label: '십번대 (11-20)', numbers: allNumbers.slice(10, 20) },
    { label: '이십번대 (21-30)', numbers: allNumbers.slice(20, 30) },
    { label: '삼십번대 (31-40)', numbers: allNumbers.slice(30, 40) },
    { label: '사십번대 (41-45)', numbers: allNumbers.slice(40, 45) },
  ];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div className="text-sm text-gray-600">
          선택된 번호: {selectedNumbers.length} / {maxSelection}
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleRandom}
            className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors text-sm font-medium"
          >
            랜덤 생성
          </button>
          <button
            onClick={handleClear}
            className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors text-sm font-medium"
          >
            초기화
          </button>
        </div>
      </div>

      <div className="space-y-4">
        {ranges.map((range, rangeIndex) => (
          <div key={rangeIndex} className="space-y-2">
            <div className="text-sm font-semibold text-gray-700">
              {range.label}
            </div>
            <div className="flex gap-2 flex-wrap">
              {range.numbers.map((num) => (
                <LottoNumber
                  key={num}
                  number={num}
                  size="md"
                  isSelected={selectedNumbers.includes(num)}
                  onClick={() => handleNumberClick(num)}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
