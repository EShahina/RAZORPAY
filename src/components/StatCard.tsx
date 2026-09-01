import React from 'react';

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  trend?: {
    direction: 'up' | 'down' | 'neutral';
    percent: number;
  };
  icon: React.ReactNode;
  color: 'green' | 'red' | 'amber' | 'blue';
}

const colorMap = {
  green: 'bg-emerald-500/20 text-emerald-400',
  red: 'bg-red-500/20 text-red-400',
  amber: 'bg-amber-500/20 text-amber-400',
  blue: 'bg-blue-500/20 text-blue-400',
};

const trendColorMap = {
  up: 'text-emerald-400',
  down: 'text-red-400',
  neutral: 'text-zinc-400',
};

const trendIconMap = {
  up: '\u2191',
  down: '\u2193',
  neutral: '\u2192',
};

export default function StatCard({ title, value, subtitle, trend, icon, color }: StatCardProps) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl p-6 shadow-lg">
      <div className="flex items-start justify-between">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-zinc-400 truncate">{title}</p>
          <p className="mt-2 text-3xl font-bold text-white tracking-tight">{value}</p>
          {subtitle && (
            <p className="mt-1 text-sm text-zinc-500 truncate">{subtitle}</p>
          )}
          {trend && (
            <div className={`mt-2 flex items-center gap-1 text-sm font-medium ${trendColorMap[trend.direction]}`}>
              <span>{trendIconMap[trend.direction]}</span>
              <span>{trend.percent}%</span>
            </div>
          )}
        </div>
        <div className={`flex-shrink-0 flex items-center justify-center w-12 h-12 rounded-full ${colorMap[color]}`}>
          {icon}
        </div>
      </div>
    </div>
  );
}
