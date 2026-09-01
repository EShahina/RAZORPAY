import { useState, useMemo } from 'react';
import { AlertTriangle, ChevronDown, ChevronRight, Trophy, XCircle, Clock, FileText, Shield } from 'lucide-react';
import { useStore } from '../hooks/useStore';
import RiskBadge from '../components/RiskBadge';
import StatCard from '../components/StatCard';
import { formatCurrency, timeAgo } from '../utils/format';
import type { Chargeback, ChargebackStatus } from '../types';

const statusTabs: { key: ChargebackStatus | 'all'; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'open', label: 'Open' },
  { key: 'evidence_submitted', label: 'Evidence Submitted' },
  { key: 'won', label: 'Won' },
  { key: 'lost', label: 'Lost' },
];

const statusIcon: Record<ChargebackStatus, { icon: typeof Clock; color: string }> = {
  open: { icon: Clock, color: 'text-yellow-400' },
  evidence_submitted: { icon: FileText, color: 'text-blue-400' },
  won: { icon: Trophy, color: 'text-emerald-400' },
  lost: { icon: XCircle, color: 'text-red-400' },
  pending_review: { icon: Clock, color: 'text-zinc-400' },
};

const statusLabel: Record<ChargebackStatus, string> = {
  open: 'Open',
  evidence_submitted: 'Evidence Submitted',
  won: 'Won',
  lost: 'Lost',
  pending_review: 'Pending Review',
};

export default function Chargebacks() {
  const { chargebacks, transactions } = useStore();
  const [activeTab, setActiveTab] = useState<ChargebackStatus | 'all'>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    if (activeTab === 'all') return chargebacks;
    return chargebacks.filter((c) => c.status === activeTab);
  }, [chargebacks, activeTab]);

  const totalCount = chargebacks.length;
  const openCount = chargebacks.filter((c) => c.status === 'open').length;
  const evidenceCount = chargebacks.filter((c) => c.status === 'evidence_submitted').length;
  const wonCount = chargebacks.filter((c) => c.status === 'won').length;
  const lostCount = chargebacks.filter((c) => c.status === 'lost').length;
  const resolvedCount = wonCount + lostCount;
  const winRate = resolvedCount > 0 ? wonCount / resolvedCount : 0;

  const getLinkedTransaction = (txnId: string) => transactions.find((t) => t.id === txnId);

  const getRiskAssessment = (cb: Chargeback) => {
    const txn = getLinkedTransaction(cb.transactionId);
    if (!txn) return { score: 0, level: 'medium' as const, note: 'Transaction data unavailable' };
    const score = txn.riskScore;
    const level = txn.riskLevel;
    const note = score > 70 ? 'High risk transaction - strong evidence basis for dispute' : score > 40 ? 'Moderate risk - standard evidence review recommended' : 'Low risk transaction - evidence may be limited';
    return { score, level, note };
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Chargeback Assistant</h1>
        <p className="text-sm text-zinc-400 mt-1">Manage and analyze chargeback disputes with evidence-based insights</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        <StatCard title="Total" value={totalCount} icon={<AlertTriangle size={22} />} color="blue" />
        <StatCard title="Open" value={openCount} icon={<Clock size={22} />} color="amber" />
        <StatCard title="Evidence" value={evidenceCount} icon={<FileText size={22} />} color="blue" />
        <StatCard title="Won" value={wonCount} icon={<Trophy size={22} />} color="green" />
        <StatCard title="Lost" value={lostCount} icon={<XCircle size={22} />} color="red" />
        <StatCard title="Win Rate" value={`${(winRate * 100).toFixed(0)}%`} icon={<Shield size={22} />} color={winRate > 0.5 ? 'green' : 'red'} />
      </div>

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
            {tab.key !== 'all' && (
              <span className="ml-2 text-xs text-zinc-500">
                {chargebacks.filter((c) => tab.key === 'all' || c.status === tab.key).length}
              </span>
            )}
          </button>
        ))}
      </div>

      <div className="space-y-3">
        {filtered.length === 0 && (
          <div className="text-center py-12 text-zinc-500 rounded-xl border border-white/10 bg-white/5 backdrop-blur-xl">
            No chargebacks found.
          </div>
        )}
        {filtered.map((cb) => {
          const StatusIcon = statusIcon[cb.status]?.icon || Clock;
          const statusColor = statusIcon[cb.status]?.color || 'text-zinc-400';
          return (
            <div key={cb.id} className="rounded-xl border border-white/10 bg-white/5 backdrop-blur-xl overflow-hidden">
              <button
                onClick={() => setExpandedId(expandedId === cb.id ? null : cb.id)}
                className="w-full flex items-center gap-4 px-4 py-4 text-left hover:bg-white/5 transition-colors"
              >
                <span className="text-zinc-500">
                  {expandedId === cb.id ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                </span>
                <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3 items-center text-sm">
                  <div>
                    <p className="text-white font-mono text-xs">{cb.id}</p>
                    <p className="text-zinc-500 text-xs mt-0.5">TXN: {cb.transactionId}</p>
                  </div>
                  <span className="text-white font-semibold">{formatCurrency(cb.amount)}</span>
                  <span className="text-zinc-300 truncate hidden sm:block">{cb.reason}</span>
                  <div className="flex items-center gap-1.5">
                    <StatusIcon size={14} className={statusColor} />
                    <span className={`text-xs font-medium ${statusColor}`}>{statusLabel[cb.status]}</span>
                  </div>
                  <span className="text-zinc-500 text-xs hidden lg:block">{timeAgo(cb.filedAt)}</span>
                  <div className="hidden lg:block">
                    <RiskBadge level={getRiskAssessment(cb).level} />
                  </div>
                </div>
              </button>

              {expandedId === cb.id && (
                <div className="border-t border-white/10 px-4 py-4 space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-3">
                      <h3 className="text-sm font-semibold text-white uppercase tracking-wider">Chargeback Details</h3>
                      <div className="rounded-lg bg-white/5 p-4 space-y-2 text-sm">
                        <div className="flex justify-between"><span className="text-zinc-400">ID</span><span className="text-zinc-200 font-mono">{cb.id}</span></div>
                        <div className="flex justify-between"><span className="text-zinc-400">Amount</span><span className="text-white font-semibold">{formatCurrency(cb.amount)}</span></div>
                        <div className="flex justify-between"><span className="text-zinc-400">Reason</span><span className="text-zinc-300">{cb.reason}</span></div>
                        <div className="flex justify-between"><span className="text-zinc-400">Status</span><span className={`font-medium ${statusColor}`}>{statusLabel[cb.status]}</span></div>
                        <div className="flex justify-between"><span className="text-zinc-400">Filed</span><span className="text-zinc-300">{new Date(cb.filedAt).toLocaleDateString()}</span></div>
                        {cb.resolvedAt && (
                          <div className="flex justify-between"><span className="text-zinc-400">Resolved</span><span className="text-zinc-300">{new Date(cb.resolvedAt).toLocaleDateString()}</span></div>
                        )}
                      </div>
                    </div>
                    <div className="space-y-3">
                      <h3 className="text-sm font-semibold text-white uppercase tracking-wider">Linked Transaction</h3>
                      {(() => {
                        const txn = getLinkedTransaction(cb.transactionId);
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
                    <h3 className="text-sm font-semibold text-white uppercase tracking-wider">Evidence</h3>
                    <div className="rounded-lg bg-white/5 p-4">
                      {cb.evidence ? (
                        <p className="text-sm text-zinc-300 leading-relaxed whitespace-pre-wrap">{cb.evidence}</p>
                      ) : (
                        <p className="text-sm text-zinc-500 italic">No evidence submitted yet.</p>
                      )}
                    </div>
                    <div className="flex items-start gap-2 rounded-lg bg-blue-500/10 border border-blue-500/20 p-3">
                      <Shield size={16} className="text-blue-400 mt-0.5 flex-shrink-0" />
                      <p className="text-xs text-blue-300 leading-relaxed">
                        This module provides evidence-based analysis. Chargeback evidence is generated from transaction data — never fabricated.
                      </p>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <h3 className="text-sm font-semibold text-white uppercase tracking-wider">Risk Assessment</h3>
                    {(() => {
                      const assessment = getRiskAssessment(cb);
                      return (
                        <div className="rounded-lg bg-white/5 p-4 space-y-2 text-sm">
                          <div className="flex items-center justify-between">
                            <span className="text-zinc-400">Transaction Risk Score</span>
                            <div className="flex items-center gap-2">
                              <span className="text-white font-semibold">{assessment.score}/100</span>
                              <RiskBadge level={assessment.level} />
                            </div>
                          </div>
                          <p className="text-zinc-400 text-xs mt-2">{assessment.note}</p>
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
  );
}
