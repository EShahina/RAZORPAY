import { useMemo, useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from 'recharts';
import { Bell, AlertTriangle, CheckCircle, Clock, TrendingUp, Shield } from 'lucide-react';
import { useStore } from '../hooks/useStore';
import RiskBadge from '../components/RiskBadge';
import ActionBadge from '../components/ActionBadge';
import { formatCurrency, formatNumber, timeAgo } from '../utils/format';
import type { AlertStatus } from '../types';

const chartTooltipStyle = {
  contentStyle: {
    backgroundColor: '#18181b',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: '8px',
    color: '#fafafa',
    fontSize: '12px',
  },
  itemStyle: { color: '#fafafa' },
};

const tabs: { key: AlertStatus | 'all'; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'active', label: 'Active' },
  { key: 'acknowledged', label: 'Acknowledged' },
  { key: 'resolved', label: 'Resolved' },
];

const severityColors: Record<string, string> = {
  info: 'bg-blue-500/15 text-blue-400 ring-blue-500/25',
  warning: 'bg-amber-500/15 text-amber-400 ring-amber-500/25',
  critical: 'bg-red-500/15 text-red-400 ring-red-500/25',
};

const statusColors: Record<string, string> = {
  active: 'bg-red-500/15 text-red-400 ring-red-500/25',
  acknowledged: 'bg-amber-500/15 text-amber-400 ring-amber-500/25',
  resolved: 'bg-emerald-500/15 text-emerald-400 ring-emerald-500/25',
};

const statusIcons: Record<string, React.ReactNode> = {
  active: <AlertTriangle className="w-4 h-4" />,
  acknowledged: <Clock className="w-4 h-4" />,
  resolved: <CheckCircle className="w-4 h-4" />,
};

export default function AlertCenter() {
  const { alerts, transactions, acknowledgeAlert, resolveAlert } = useStore();
  const [activeTab, setActiveTab] = useState<AlertStatus | 'all'>('all');
  const [expandedAlert, setExpandedAlert] = useState<string | null>(null);

  const activeAlerts = useMemo(() => alerts.filter((a) => a.status === 'active'), [alerts]);
  const totalExposure = useMemo(
    () => activeAlerts.reduce((s, a) => s + a.totalExposure, 0),
    [activeAlerts]
  );
  const resolvedToday = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    return alerts.filter((a) => a.status === 'resolved' && a.resolvedAt?.startsWith(today)).length;
  }, [alerts]);

  const latestSpikeAlert = useMemo(
    () => alerts.find((a) => a.spikeData && a.status === 'active'),
    [alerts]
  );

  const filteredAlerts = useMemo(
    () => (activeTab === 'all' ? alerts : alerts.filter((a) => a.status === activeTab)),
    [alerts, activeTab]
  );

  const spikeChartData = useMemo(() => {
    if (!latestSpikeAlert?.spikeData) return [];
    const sd = latestSpikeAlert.spikeData;
    return [
      { name: 'Baseline', count: sd.baselineCount, fill: '#3b82f6' },
      { name: 'Current', count: sd.currentCount, fill: sd.spikePercent > 200 ? '#ef4444' : sd.spikePercent > 100 ? '#f59e0b' : '#10b981' },
    ];
  }, [latestSpikeAlert]);

  const getSpikeColor = (pct: number) => {
    if (pct > 200) return 'text-red-400';
    if (pct > 100) return 'text-amber-400';
    return 'text-emerald-400';
  };

  const toggleExpand = (id: string) => {
    setExpandedAlert((prev) => (prev === id ? null : id));
  };

  return (
    <div className="min-h-screen bg-zinc-950 p-6 space-y-6">
      <h1 className="text-2xl font-bold text-white tracking-tight">Alert Center</h1>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl p-6 shadow-lg">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-full bg-red-500/20">
              <Bell className="w-5 h-5 text-red-400" />
            </div>
            <div>
              <p className="text-sm text-zinc-400">Active Alerts</p>
              <p className="text-2xl font-bold text-white">{activeAlerts.length}</p>
            </div>
          </div>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl p-6 shadow-lg">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-full bg-amber-500/20">
              <TrendingUp className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <p className="text-sm text-zinc-400">Total Exposure</p>
              <p className="text-2xl font-bold text-white">{formatCurrency(totalExposure)}</p>
            </div>
          </div>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl p-6 shadow-lg">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-full bg-emerald-500/20">
              <CheckCircle className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <p className="text-sm text-zinc-400">Resolved Today</p>
              <p className="text-2xl font-bold text-white">{resolvedToday}</p>
            </div>
          </div>
        </div>
      </div>

      {latestSpikeAlert?.spikeData && (
        <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl p-6 shadow-lg">
          <div className="flex items-center gap-2 mb-4">
            <Shield className="w-5 h-5 text-amber-400" />
            <h2 className="text-sm font-semibold text-zinc-300">Spike Detection</h2>
          </div>
          {(() => {
            const sd = latestSpikeAlert.spikeData!;
            const spikePct = sd.spikePercent;
            const spikeColor = getSpikeColor(spikePct);
            const barWidth = Math.min((sd.currentCount / (sd.baselineCount * 3)) * 100, 100);
            const normalWidth = Math.min((sd.baselineCount / (sd.baselineCount * 3)) * 100, 100);

            return (
              <div className="space-y-4">
                <div className="flex flex-wrap items-center gap-6">
                  <div>
                    <p className="text-xs text-zinc-500 uppercase tracking-wider">Current High-Risk</p>
                    <p className="text-3xl font-bold text-white">{sd.currentCount}</p>
                  </div>
                  <div className="text-zinc-600 text-2xl font-light">/</div>
                  <div>
                    <p className="text-xs text-zinc-500 uppercase tracking-wider">Baseline</p>
                    <p className="text-3xl font-bold text-zinc-400">{sd.baselineCount}</p>
                  </div>
                  <div className="ml-auto">
                    <p className="text-xs text-zinc-500 uppercase tracking-wider text-right">Spike</p>
                    <p className={`text-3xl font-bold ${spikeColor}`}>{spikePct.toFixed(0)}%</p>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-zinc-500 w-16">Normal</span>
                    <div className="flex-1 h-6 bg-zinc-800 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-blue-500/60 rounded-full transition-all"
                        style={{ width: `${normalWidth}%` }}
                      />
                    </div>
                    <span className="text-xs text-zinc-400 w-12 text-right">{sd.baselineCount}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-zinc-500 w-16">Current</span>
                    <div className="flex-1 h-6 bg-zinc-800 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${
                          spikePct > 200 ? 'bg-red-500' : spikePct > 100 ? 'bg-amber-500' : 'bg-emerald-500'
                        }`}
                        style={{ width: `${barWidth}%` }}
                      />
                    </div>
                    <span className="text-xs text-zinc-400 w-12 text-right">{sd.currentCount}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2 text-xs text-zinc-500">
                  <Clock className="w-3 h-3" />
                  <span>Window: {sd.windowMinutes} min</span>
                  <span className="mx-1">|</span>
                  <span>Normal range: {sd.normalRange[0]}-{sd.normalRange[1]}</span>
                </div>
              </div>
            );
          })()}

          <div className="mt-6">
            <h3 className="text-xs font-semibold text-zinc-400 mb-3">Baseline vs Current</h3>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={spikeChartData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                <XAxis type="number" tick={{ fill: '#71717a', fontSize: 11 }} stroke="rgba(255,255,255,0.1)" />
                <YAxis type="category" dataKey="name" tick={{ fill: '#71717a', fontSize: 11 }} stroke="rgba(255,255,255,0.1)" width={80} />
                <Tooltip {...chartTooltipStyle} formatter={(value) => [formatNumber(Number(value)), 'Count']} />
                <Bar dataKey="count" radius={[0, 4, 4, 0]} barSize={24}>
                  {spikeChartData.map((entry, i) => (
                    <Cell key={i} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl p-6 shadow-lg">
        <h2 className="text-sm font-semibold text-zinc-300 mb-4">Alert List</h2>
        <div className="flex gap-1 mb-4 bg-zinc-800/50 rounded-lg p-1 w-fit">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
                activeTab === tab.key
                  ? 'bg-white/10 text-white'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="space-y-3">
          {filteredAlerts.map((alert) => {
            const isExpanded = expandedAlert === alert.id;
            const alertTransactions = transactions.filter((t) =>
              alert.transactionIds.includes(t.id)
            );

            return (
              <div
                key={alert.id}
                className="border border-white/5 rounded-xl overflow-hidden hover:border-white/10 transition-colors"
              >
                <button
                  onClick={() => toggleExpand(alert.id)}
                  className="w-full text-left p-4 flex items-center gap-4 hover:bg-white/5 transition-colors"
                >
                  <div className="flex-shrink-0">
                    {statusIcons[alert.status]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-medium text-white truncate">{alert.title}</span>
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ring-1 ring-inset ${severityColors[alert.severity]}`}>
                        {alert.severity}
                      </span>
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ring-1 ring-inset ${statusColors[alert.status]}`}>
                        {alert.status}
                      </span>
                    </div>
                    <div className="flex items-center gap-4 text-xs text-zinc-500">
                      <span>{timeAgo(alert.createdAt)}</span>
                      <span>{formatCurrency(alert.totalExposure)} exposure</span>
                    </div>
                  </div>
                  <svg
                    className={`w-4 h-4 text-zinc-500 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {isExpanded && (
                  <div className="px-4 pb-4 space-y-4 border-t border-white/5 pt-4">
                    <p className="text-sm text-zinc-400">{alert.description}</p>

                    {alertTransactions.length > 0 && (
                      <div>
                        <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">
                          Affected Transactions ({alertTransactions.length})
                        </p>
                        <div className="space-y-1">
                          {alertTransactions.slice(0, 5).map((txn) => (
                            <div
                              key={txn.id}
                              className="flex items-center justify-between py-1.5 px-3 rounded-lg bg-zinc-800/50 text-xs"
                            >
                              <div className="flex items-center gap-3">
                                <span className="font-mono text-zinc-400">{txn.id}</span>
                                <span className="text-white">{formatCurrency(txn.amount)}</span>
                                <RiskBadge level={txn.riskLevel} />
                              </div>
                              <ActionBadge action={txn.recommendedAction} />
                            </div>
                          ))}
                          {alertTransactions.length > 5 && (
                            <p className="text-xs text-zinc-600 pl-3">
                              +{alertTransactions.length - 5} more
                            </p>
                          )}
                        </div>
                      </div>
                    )}

                    {alert.status !== 'resolved' && (
                      <div className="flex gap-3 pt-2">
                        {alert.status === 'active' && (
                          <button
                            onClick={(e) => { e.stopPropagation(); acknowledgeAlert(alert.id); }}
                            className="px-4 py-2 rounded-lg bg-amber-500/15 text-amber-400 text-sm font-medium hover:bg-amber-500/25 transition-colors"
                          >
                            Acknowledge
                          </button>
                        )}
                        <button
                          onClick={(e) => { e.stopPropagation(); resolveAlert(alert.id); }}
                          className="px-4 py-2 rounded-lg bg-emerald-500/15 text-emerald-400 text-sm font-medium hover:bg-emerald-500/25 transition-colors"
                        >
                          Resolve
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
          {filteredAlerts.length === 0 && (
            <p className="text-center text-zinc-500 py-8">No alerts found.</p>
          )}
        </div>
      </div>
    </div>
  );
}
