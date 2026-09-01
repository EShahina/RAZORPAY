import { useState, useMemo } from 'react';
import { RotateCcw, ChevronDown, ChevronRight, CheckCircle, XCircle, Clock, AlertTriangle, TrendingUp } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { useStore } from '../hooks/useStore';
import RiskBadge from '../components/RiskBadge';
import StatCard from '../components/StatCard';
import { formatCurrency, timeAgo } from '../utils/format';
import type { Return, ReturnStatus, RiskLevel } from '../types';

const statusTabs: { key: ReturnStatus | 'all'; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'initiated', label: 'Initiated' },
  { key: 'approved', label: 'Approved' },
  { key: 'denied', label: 'Denied' },
  { key: 'completed', label: 'Completed' },
];

const statusIcon: Record<ReturnStatus, { icon: typeof Clock; color: string }> = {
  initiated: { icon: Clock, color: 'text-yellow-400' },
  approved: { icon: CheckCircle, color: 'text-emerald-400' },
  denied: { icon: XCircle, color: 'text-red-400' },
  completed: { icon: CheckCircle, color: 'text-blue-400' },
};

const statusLabel: Record<ReturnStatus, string> = {
  initiated: 'Initiated',
  approved: 'Approved',
  denied: 'Denied',
  completed: 'Completed',
};

const pieColors: Record<RiskLevel, string> = {
  low: '#34d399',
  medium: '#facc15',
  high: '#fb923c',
  critical: '#f87171',
};

export default function Returns() {
  const { returns, transactions } = useStore();
  const [activeTab, setActiveTab] = useState<ReturnStatus | 'all'>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    if (activeTab === 'all') return returns;
    return returns.filter((r) => r.status === activeTab);
  }, [returns, activeTab]);

  const totalCount = returns.length;
  const initiatedCount = returns.filter((r) => r.status === 'initiated').length;
  const approvedCount = returns.filter((r) => r.status === 'approved').length;
  const deniedCount = returns.filter((r) => r.status === 'denied').length;
  const completedCount = returns.filter((r) => r.status === 'completed').length;

  const abuseReturns = useMemo(() => returns.filter((r) => r.riskScore > 60), [returns]);

  const pieData = useMemo(() => {
    const counts: Record<RiskLevel, number> = { low: 0, medium: 0, high: 0, critical: 0 };
    returns.forEach((r) => { counts[r.riskLevel]++; });
    return Object.entries(counts)
      .filter(([, v]) => v > 0)
      .map(([name, value]) => ({ name: name.charAt(0).toUpperCase() + name.slice(1), value, color: pieColors[name as RiskLevel] }));
  }, [returns]);

  const getLinkedTransaction = (txnId: string) => transactions.find((t) => t.id === txnId);

  const getApprovalRecommendation = (score: number) => {
    if (score < 30) return { action: 'Auto-Approve', color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20', reason: 'Low risk return. Transaction history is clean with no suspicious patterns.' };
    if (score < 60) return { action: 'Manual Review', color: 'text-yellow-400', bg: 'bg-yellow-500/10 border-yellow-500/20', reason: 'Moderate risk. Recommend reviewing transaction and customer history before approving.' };
    return { action: 'Deny / Flag', color: 'text-red-400', bg: 'bg-red-500/10 border-red-500/20', reason: 'High risk return. Multiple risk indicators detected. Recommend thorough investigation.' };
  };

  const getRiskFactors = (ret: Return) => {
    const factors = [];
    if (ret.riskScore > 70) factors.push('Elevated risk score indicates potential return abuse');
    if (ret.amount > 10000) factors.push('High-value transaction return');
    const txn = getLinkedTransaction(ret.transactionId);
    if (txn) {
      if (txn.riskScore > 60) factors.push('Original transaction had high risk score');
      if (txn.status === 'chargeback') factors.push('Customer has previously filed a chargeback');
      if (txn.paymentMethod === 'upi') factors.push('UPI transactions have higher refund complexity');
    }
    if (factors.length === 0) factors.push('Standard return request with no elevated risk indicators');
    return factors;
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Return Risk Module</h1>
        <p className="text-sm text-zinc-400 mt-1">Identify return abuse and assess return risk with AI-driven insights</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        <StatCard title="Total Returns" value={totalCount} icon={<RotateCcw size={22} />} color="blue" />
        <StatCard title="Initiated" value={initiatedCount} icon={<Clock size={22} />} color="amber" />
        <StatCard title="Approved" value={approvedCount} icon={<CheckCircle size={22} />} color="green" />
        <StatCard title="Denied" value={deniedCount} icon={<XCircle size={22} />} color="red" />
        <StatCard title="Completed" value={completedCount} icon={<CheckCircle size={22} />} color="blue" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center gap-1 overflow-x-auto pb-1">
            {statusTabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`px-4 py-2 text-sm font-medium rounded-lg whitespace-nowrap transition-colors ${
                  activeTab === tab.key
                    ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30'
                    : 'text-zinc-400 hover:bg-white/5 border border-transparent'
                }`}
              >
                {tab.label}
                <span className="ml-2 text-xs text-zinc-500">
                  {returns.filter((r) => tab.key === 'all' || r.status === tab.key).length}
                </span>
              </button>
            ))}
          </div>

          <div className="space-y-2">
            {filtered.length === 0 && (
              <div className="text-center py-12 text-zinc-500 rounded-xl border border-white/10 bg-white/5 backdrop-blur-xl">
                No returns found.
              </div>
            )}
            {filtered.map((ret) => {
              const StatusIcon = statusIcon[ret.status]?.icon || Clock;
              const statusColor = statusIcon[ret.status]?.color || 'text-zinc-400';
              return (
                <div key={ret.id} className="rounded-xl border border-white/10 bg-white/5 backdrop-blur-xl overflow-hidden">
                  <button
                    onClick={() => setExpandedId(expandedId === ret.id ? null : ret.id)}
                    className="w-full flex items-center gap-4 px-4 py-3 text-left hover:bg-white/5 transition-colors"
                  >
                    <span className="text-zinc-500">
                      {expandedId === ret.id ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                    </span>
                    <div className="flex-1 grid grid-cols-2 lg:grid-cols-7 gap-3 items-center text-sm">
                      <span className="text-white font-mono text-xs truncate">{ret.id}</span>
                      <span className="text-zinc-400 text-xs hidden md:block">TXN: {ret.transactionId}</span>
                      <span className="text-white font-semibold">{formatCurrency(ret.amount)}</span>
                      <span className="text-zinc-300 truncate hidden lg:block">{ret.reason}</span>
                      <div className="flex items-center gap-1.5">
                        <StatusIcon size={14} className={statusColor} />
                        <span className={`text-xs font-medium ${statusColor}`}>{statusLabel[ret.status]}</span>
                      </div>
                      <RiskBadge level={ret.riskLevel} />
                      <span className="text-zinc-500 text-xs hidden lg:block">{timeAgo(ret.initiatedAt)}</span>
                    </div>
                  </button>

                  {expandedId === ret.id && (
                    <div className="border-t border-white/10 px-4 py-4 space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-3">
                          <h3 className="text-sm font-semibold text-white uppercase tracking-wider">Return Details</h3>
                          <div className="rounded-lg bg-white/5 p-4 space-y-2 text-sm">
                            <div className="flex justify-between"><span className="text-zinc-400">ID</span><span className="text-zinc-200 font-mono">{ret.id}</span></div>
                            <div className="flex justify-between"><span className="text-zinc-400">Amount</span><span className="text-white font-semibold">{formatCurrency(ret.amount)}</span></div>
                            <div className="flex justify-between"><span className="text-zinc-400">Reason</span><span className="text-zinc-300">{ret.reason}</span></div>
                            <div className="flex justify-between"><span className="text-zinc-400">Status</span><span className={`font-medium ${statusColor}`}>{statusLabel[ret.status]}</span></div>
                            <div className="flex justify-between"><span className="text-zinc-400">Initiated</span><span className="text-zinc-300">{new Date(ret.initiatedAt).toLocaleDateString()}</span></div>
                            {ret.completedAt && (
                              <div className="flex justify-between"><span className="text-zinc-400">Completed</span><span className="text-zinc-300">{new Date(ret.completedAt).toLocaleDateString()}</span></div>
                            )}
                          </div>
                        </div>
                        <div className="space-y-3">
                          <h3 className="text-sm font-semibold text-white uppercase tracking-wider">Linked Transaction</h3>
                          {(() => {
                            const txn = getLinkedTransaction(ret.transactionId);
                            if (!txn) return <div className="rounded-lg bg-white/5 p-4 text-sm text-zinc-500">Transaction not found</div>;
                            return (
                              <div className="rounded-lg bg-white/5 p-4 space-y-2 text-sm">
                                <div className="flex justify-between"><span className="text-zinc-400">ID</span><span className="text-zinc-200 font-mono">{txn.id}</span></div>
                                <div className="flex justify-between"><span className="text-zinc-400">Amount</span><span className="text-white">{formatCurrency(txn.amount)}</span></div>
                                <div className="flex justify-between"><span className="text-zinc-400">Payment</span><span className="text-zinc-300 uppercase">{txn.paymentMethod}</span></div>
                                <div className="flex justify-between"><span className="text-zinc-400">Status</span><span className="text-zinc-300">{txn.status}</span></div>
                                <div className="flex justify-between"><span className="text-zinc-400">Risk Score</span><RiskBadge level={txn.riskLevel} /></div>
                              </div>
                            );
                          })()}
                        </div>
                      </div>

                      <div className="space-y-3">
                        <h3 className="text-sm font-semibold text-white uppercase tracking-wider">Risk Assessment Factors</h3>
                        <div className="rounded-lg bg-white/5 p-4 space-y-2">
                          {getRiskFactors(ret).map((factor, i) => (
                            <div key={i} className="flex items-start gap-2 text-sm">
                              <AlertTriangle size={14} className="text-zinc-500 mt-0.5 flex-shrink-0" />
                              <span className="text-zinc-300">{factor}</span>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="space-y-3">
                        <h3 className="text-sm font-semibold text-white uppercase tracking-wider">Approval Recommendation</h3>
                        {(() => {
                          const rec = getApprovalRecommendation(ret.riskScore);
                          return (
                            <div className={`rounded-lg border p-4 ${rec.bg}`}>
                              <div className="flex items-center justify-between mb-2">
                                <span className={`text-sm font-semibold ${rec.color}`}>{rec.action}</span>
                                <span className="text-sm text-zinc-400">Risk Score: {ret.riskScore}/100</span>
                              </div>
                              <p className="text-xs text-zinc-400 leading-relaxed">{rec.reason}</p>
                            </div>
                          );
                        })()}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div className="space-y-6">
          <div className="rounded-xl border border-white/10 bg-white/5 backdrop-blur-xl p-6">
            <h3 className="text-sm font-semibold text-white uppercase tracking-wider mb-4">Risk Distribution</h3>
            {returns.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={3} dataKey="value">
                    {pieData.map((entry, i) => (
                      <Cell key={i} fill={entry.color} stroke="transparent" />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ backgroundColor: '#18181b', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', fontSize: '12px' }}
                    itemStyle={{ color: '#a1a1aa' }}
                  />
                  <Legend
                    formatter={(value) => <span style={{ color: '#a1a1aa', fontSize: '12px' }}>{value}</span>}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="text-center py-8 text-zinc-500 text-sm">No data</div>
            )}
          </div>

          {abuseReturns.length > 0 && (
            <div className="rounded-xl border border-red-500/20 bg-red-500/5 backdrop-blur-xl p-6">
              <div className="flex items-center gap-2 mb-4">
                <TrendingUp size={18} className="text-red-400" />
                <h3 className="text-sm font-semibold text-red-400 uppercase tracking-wider">Abuse Detection</h3>
              </div>
              <p className="text-xs text-zinc-400 mb-3">
                {abuseReturns.length} return{abuseReturns.length !== 1 ? 's' : ''} flagged with risk score &gt; 60
              </p>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {abuseReturns.map((ret) => (
                  <div key={ret.id} className="flex items-center justify-between rounded-lg bg-white/5 p-2.5 text-sm">
                    <div className="min-w-0 flex-1">
                      <p className="text-zinc-300 font-mono text-xs truncate">{ret.id}</p>
                      <p className="text-zinc-500 text-xs">{formatCurrency(ret.amount)}</p>
                    </div>
                    <div className="flex items-center gap-2 ml-2">
                      <span className="text-xs font-semibold text-red-400">{ret.riskScore}</span>
                      <RiskBadge level={ret.riskLevel} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
