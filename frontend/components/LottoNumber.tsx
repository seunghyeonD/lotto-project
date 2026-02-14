/**
 * 로또 번호 표시 컴포넌트
 */

import React from 'react';
import { LottoNumber as LottoNumberType } from '@/types/lotto';

interface LottoNumberProps {
  number: LottoNumberType;
  size?: 'sm' | 'md' | 'lg';
  isBonus?: boolean;
  isSelected?: boolean;
  onClick?: () => void;
}

const getNumberColor = (num: LottoNumberType): string => {
  if (num >= 1 && num <= 10) return 'bg-yellow-500';
  if (num >= 11 && num <= 20) return 'bg-blue-500';
  if (num >= 21 && num <= 30) return 'bg-red-500';
  if (num >= 31 && num <= 40) return 'bg-gray-700';
  if (num >= 41 && num <= 45) return 'bg-green-500';
  return 'bg-gray-500';
};

const getSizeClasses = (size: 'sm' | 'md' | 'lg'): string => {
  switch (size) {
    case 'sm':
      return 'w-8 h-8 text-sm';
    case 'md':
      return 'w-10 h-10 text-base';
    case 'lg':
      return 'w-14 h-14 text-xl';
    default:
      return 'w-10 h-10 text-base';
  }
};

export const LottoNumber: React.FC<LottoNumberProps> = React.memo(({
  number,
  size = 'md',
  isBonus = false,
  isSelected = false,
  onClick,
}) => {
  const baseClasses = 'rounded-full flex items-center justify-center font-bold text-white transition-all';
  const colorClasses = getNumberColor(number);
  const sizeClasses = getSizeClasses(size);
  const bonusClasses = isBonus ? 'ring-2 ring-orange-400 ring-offset-2' : '';
  const selectedClasses = isSelected ? 'ring-2 ring-blue-400 ring-offset-2 scale-110' : '';
  const clickableClasses = onClick ? 'cursor-pointer hover:scale-110 hover:shadow-lg' : '';

  return (
    <div
      className={`${baseClasses} ${colorClasses} ${sizeClasses} ${bonusClasses} ${selectedClasses} ${clickableClasses}`}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
    >
      {number}
    </div>
  );
});
