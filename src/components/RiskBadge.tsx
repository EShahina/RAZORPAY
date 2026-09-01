import type { RiskLevel } from '../types';

interface RiskBadgeProps {
  level: RiskLevel;
}

const levelConfig: Record<RiskLevel, { label: string; classes: string }> = {
  low: { label: 'Low', classes: 'bg-emerald-500/15 text-emerald-400 ring-emerald-500/25' },
  medium: { label: 'Medium', classes: 'bg-yellow-500/15 text-yellow-400 ring-yellow-500/25' },
  high: { label: 'High', classes: 'bg-orange-500/15 text-orange-400 ring-orange-500/25' },
  critical: { label: 'Critical', classes: 'bg-red-500/15 text-red-400 ring-red-500/25' },
};

export default function RiskBadge({ level }: RiskBadgeProps) {
  const config = levelConfig[level];

  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${config.classes}`}>
      {config.label}
    </span>
  );
}
