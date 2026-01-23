/**
 * 통계 카드 컴포넌트
 */

import React from 'react';
import { NumberStatistics } from '@/types/lotto';
import { LottoNumber } from './LottoNumber';

interface StatisticsCardProps {
  statistics: NumberStatistics[];
  title: string;
  limit?: number;
}

export const StatisticsCard: React.FC<StatisticsCardProps> = ({
  statistics,
  title,
  limit = 10,
}) => {
  const displayStats = statistics.slice(0, limit);

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <h3 className="text-lg font-bold mb-4 text-gray-800">{title}</h3>
      <div className="space-y-3">
        {displayStats.map((stat, index) => (
          <div
            key={stat.number}
            className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <div className="flex items-center gap-4">
              <span className="text-sm font-semibold text-gray-500 w-6">
                {index + 1}
              </span>
              <LottoNumber number={stat.number} size="sm" />
              <div className="text-sm text-gray-600">
                <span className="font-medium">{stat.range}</span>
              </div>
            </div>
            <div className="flex items-center gap-6 text-sm">
              <div className="text-center">
                <div className="text-gray-500 text-xs">출현</div>
                <div className="font-bold text-blue-600">{stat.count}회</div>
              </div>
              <div className="text-center">
                <div className="text-gray-500 text-xs">최근</div>
                <div className="font-medium text-gray-700">
                  {stat.lastAppeared || '-'}회
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
