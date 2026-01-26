/**
 * 로또 번호 세트 표시 컴포넌트
 */

import React from 'react';
import { LottoNumber } from './LottoNumber';
import { LottoNumber as LottoNumberType } from '@/types/lotto';

interface LottoNumberSetProps {
  numbers: LottoNumberType[];
  bonusNumber?: LottoNumberType;
  size?: 'sm' | 'md' | 'lg';
  showRangeLabels?: boolean;
}

export const LottoNumberSet: React.FC<LottoNumberSetProps> = ({
  numbers,
  bonusNumber,
  size = 'md',
  showRangeLabels = false,
}) => {
  const sortedNumbers = [...numbers].sort((a, b) => a - b);

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <div className="flex gap-2 flex-wrap">
        {sortedNumbers.map((num, index) => (
          <LottoNumber key={index} number={num} size={size} />
        ))}
      </div>

      {bonusNumber !== undefined && (
        <>
          <span className="text-gray-400 font-bold mx-1">+</span>
          <LottoNumber number={bonusNumber} size={size} isBonus />
        </>
      )}

      {showRangeLabels && (
        <div className="ml-4 text-xs text-gray-500">
          {getRangeLabel(sortedNumbers)}
        </div>
      )}
    </div>
  );
};

function getRangeLabel(numbers: LottoNumberType[]): string {
  const ranges = {
    단: 0,
    십: 0,
    이: 0,
    삼: 0,
    사: 0,
  };

  numbers.forEach((num) => {
    if (num >= 1 && num <= 10) ranges.단++;
    else if (num >= 11 && num <= 20) ranges.십++;
    else if (num >= 21 && num <= 30) ranges.이++;
    else if (num >= 31 && num <= 40) ranges.삼++;
    else if (num >= 41 && num <= 45) ranges.사++;
  });

  return Object.entries(ranges)
    .filter(([, count]) => count > 0)
    .map(([range, count]) => `${range}${count}`)
    .join(' ');
}
