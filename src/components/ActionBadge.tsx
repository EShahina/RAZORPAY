import type { RiskAction } from '../types';

interface ActionBadgeProps {
  action: RiskAction;
}

const actionConfig: Record<RiskAction, { label: string; classes: string }> = {
  allow: { label: 'Allow', classes: 'bg-emerald-500/15 text-emerald-400 ring-emerald-500/25' },
  verify: { label: 'Verify', classes: 'bg-yellow-500/15 text-yellow-400 ring-yellow-500/25' },
  review: { label: 'Review', classes: 'bg-orange-500/15 text-orange-400 ring-orange-500/25' },
  block: { label: 'Block', classes: 'bg-red-500/15 text-red-400 ring-red-500/25' },
};

export default function ActionBadge({ action }: ActionBadgeProps) {
  const config = actionConfig[action];

  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${config.classes}`}>
      {config.label}
    </span>
  );
}
