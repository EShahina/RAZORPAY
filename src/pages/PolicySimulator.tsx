import { useState, useMemo, useEffect } from 'react';
import { useStore } from '../hooks/useStore';
import { analyzeTransaction, getActionColor } from '../engine/riskEngine';
import { fetchSimulatorPolicy } from '../api/client';
import type { SimulatorPolicyResponse } from '../api/client';
import { formatCurrency, formatNumber } from '../utils/format';
import type { PolicyRule, RiskAction, Transaction } from '../types';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line } from 'recharts';
import { Sliders, Plus, Trash2, ToggleLeft, ToggleRight, ArrowRight, AlertTriangle, Coins, TrendingUp, TrendingDown, Banknote } from 'lucide-react';

let nextId = 4;

const defaultRules: PolicyRule[] = [
  { id: '1', name: 'High Amount Block', field: 'amount', operator: 'gt', threshold: 50000, action: 'block', enabled: true },
  { id: '2', name: 'Suspicious Score', field: 'riskScore', operator: 'gt', threshold: 70, action: 'review', enabled: true },
  { id: '3', name: 'Low Risk Auto-Approve', field: 'riskScore', operator: 'lt', threshold: 20, action: 'allow', enabled: true },
];

const operatorLabels: Record<string, string> = { gt: '>', lt: '<', gte: '>=', lte: '<=', eq: '==' };
const fieldOptions = ['amount', 'riskScore'] as const;
const operatorOptions = ['gt', 'lt', 'gte', 'lte'] as const;
const actionOptions: RiskAction[] = ['allow', 'verify', 'review', 'block'];

function applyPolicy(txn: Transaction, rules: PolicyRule[]): RiskAction {
  const analysis = analyzeTransaction(txn, { avgAmount: 5000, accountAgeDays: 30, recentTxCount: 2, chargebackRate: 0.02, refundRate: 0.03 }, rules);
  return analysis.action;
}

function countActions(txns: Transaction[], rules: PolicyRule[]) {
  const counts: Record<RiskAction, number> = { allow: 0, verify: 0, review: 0, block: 0 };
  txns.forEach((t) => {
    counts[applyPolicy(t, rules)]++;
  });
  return counts;
}

function getActionLabel(a: RiskAction): string {
  return a.charAt(0).toUpperCase() + a.slice(1);
}

export default function PolicySimulator() {
  const { transactions, dataSource } = useStore();
  const [rules, setRules] = useState<PolicyRule[]>(defaultRules);

  // Backend business-cost simulator (Part 5): slide a single threshold and watch
  // net protection / recoverable loss / blocked revenue change in real time.
  const [threshold, setThreshold] = useState(60);
  const [policy, setPolicy] = useState<SimulatorPolicyResponse | null>(null);
  const [policyLoading, setPolicyLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setPolicyLoading(true);
    void fetchSimulatorPolicy(threshold).then((res) => {
      if (cancelled) return;
      if (res) setPolicy(res);
      setPolicyLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [threshold]);

  const originalCounts = useMemo(() => {
    const counts: Record<RiskAction, number> = { allow: 0, verify: 0, review: 0, block: 0 };
    transactions.forEach((t) => { counts[t.recommendedAction]++; });
    return counts;
  }, [transactions]);

  const simulatedCounts = useMemo(() => countActions(transactions, rules), [transactions, rules]);

  const chartData = useMemo(() =>
    actionOptions.map((a) => ({
      action: getActionLabel(a),
      Before: originalCounts[a],
      After: simulatedCounts[a],
    })),
    [originalCounts, simulatedCounts]
  );

  const changedTxns = useMemo(() => {
    return transactions.filter((t) => t.recommendedAction !== applyPolicy(t, rules));
  }, [transactions, rules]);

  const blockDelta = simulatedCounts.block - originalCounts.block;
  const verifyDelta = simulatedCounts.verify - originalCounts.verify;
  const reviewDelta = simulatedCounts.review - originalCounts.review;
  const allowDelta = simulatedCounts.allow - originalCounts.allow;

  const changedAmount = changedTxns.reduce((s, t) => s + t.amount, 0);

  const addRule = () => {
    setRules((prev) => [
      ...prev,
      { id: String(nextId++), name: 'New Rule', field: 'amount', operator: 'gt', threshold: 0, action: 'verify', enabled: true },
    ]);
  };

  const removeRule = (id: string) => {
    setRules((prev) => prev.filter((r) => r.id !== id));
  };

  const toggleRule = (id: string) => {
    setRules((prev) => prev.map((r) => r.id === id ? { ...r, enabled: !r.enabled } : r));
  };

  const updateRule = (id: string, patch: Partial<PolicyRule>) => {
    setRules((prev) => prev.map((r) => r.id === id ? { ...r, ...patch } : r));
  };

  return (
    <div className="min-h-screen bg-zinc-950 p-6 space-y-6">
      <div className="flex items-center gap-3">
        <div className="p-2 bg-blue-500/10 rounded-lg">
          <Sliders className="h-6 w-6 text-blue-400" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-white">Policy Simulator</h1>
          <p className="text-sm text-zinc-400">What-if threshold analysis on live transaction data</p>
        </div>
      </div>

      <div className="bg-zinc-900 rounded-xl ring-1 ring-zinc-800 p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-white flex items-center gap-2">
            <Coins className="h-4 w-4 text-emerald-400" /> Business-Cost Simulator
          </h2>
          <span className={`px-2.5 py-1 rounded-full text-[10px] font-medium ring-1 ring-inset ${
            policy && dataSource === 'backend'
              ? 'bg-emerald-500/10 ring-emerald-500/25 text-emerald-400'
              : 'bg-zinc-800 ring-zinc-700 text-zinc-400'
          }`}>
            {policy && dataSource === 'backend' ? 'Live · API model' : 'Offline'}
          </span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-zinc-400">Decision Threshold</span>
              <span className="text-sm font-bold text-white font-mono">{threshold}</span>
            </div>
            <input
              type="range"
              min={35}
              max={95}
              value={threshold}
              onChange={(e) => setThreshold(Number(e.target.value))}
              className="w-full accent-emerald-500"
            />
            <p className="text-[11px] text-zinc-500 mt-2 leading-relaxed">
              Transactions at or above the threshold are flagged. Sliding lower blocks more
              fraud (higher recall) but costs more in review labor and false positives; sliding
              higher reduces friction but lets more fraud through.
            </p>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <div className="bg-zinc-800/50 rounded-lg p-3">
                <div className="flex items-center gap-1.5 text-zinc-400 text-xs mb-1">
                  <TrendingDown className="h-3 w-3" /> Recoverable Loss
                </div>
                <p className="text-lg font-bold text-white font-mono">{policy ? formatCurrency(policy.recoverableLoss) : '—'}</p>
              </div>
              <div className="bg-zinc-800/50 rounded-lg p-3">
                <div className="flex items-center gap-1.5 text-zinc-400 text-xs mb-1">
                  <Banknote className="h-3 w-3" /> Blocked Revenue
                </div>
                <p className="text-lg font-bold text-amber-400 font-mono">{policy ? formatCurrency(policy.blockedRevenue) : '—'}</p>
              </div>
              <div className="bg-zinc-800/50 rounded-lg p-3">
                <div className="flex items-center gap-1.5 text-zinc-400 text-xs mb-1">
                  <TrendingUp className="h-3 w-3" /> Net Protection
                </div>
                <p className="text-lg font-bold text-emerald-400 font-mono">{policy ? formatCurrency(policy.netProtection) : '—'}</p>
              </div>
              <div className="bg-zinc-800/50 rounded-lg p-3">
                <div className="text-xs text-zinc-400 mb-1">Recall</div>
                <p className="text-lg font-bold text-cyan-400 font-mono">{policy ? `${Math.round(policy.recall * 100)}%` : '—'}</p>
              </div>
            </div>
            <div className="mt-3 flex items-center justify-between text-xs text-zinc-500">
              <span>False-positive rate</span>
              <span className="font-mono text-zinc-300">{policy ? `${Math.round(policy.falsePositiveRate * 100)}%` : '—'}</span>
            </div>
          </div>

          <div className="lg:col-span-2 h-[280px]">
            <h3 className="text-xs font-semibold text-zinc-300 mb-3">Net Protection vs Blocked Revenue across thresholds</h3>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={policy?.curves ?? []}
                margin={{ top: 10, right: 20, left: 10, bottom: 10 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                <XAxis dataKey="threshold" tick={{ fill: '#a1a1aa', fontSize: 11 }} label={{ value: 'Threshold', position: 'bottom', fill: '#71717a', fontSize: 11, dy: 5 }} />
                <YAxis tick={{ fill: '#a1a1aa', fontSize: 11 }} tickFormatter={(v: number) => formatCurrency(v).replace(/\.\d+/, '')} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#18181b', border: '1px solid #27272a', borderRadius: 8, fontSize: 12 }}
                  labelStyle={{ color: '#fafafa' }}
                  formatter={(value) => formatCurrency(Number(value))}
                />
                <Legend wrapperStyle={{ fontSize: 12, color: '#a1a1aa' }} />
                <Line type="monotone" dataKey="netProtection" stroke="#22c55e" strokeWidth={2} dot={{ r: 2, fill: '#22c55e' }} name="Net Protection" />
                <Line type="monotone" dataKey="blockedRevenue" stroke="#eab308" strokeWidth={2} dot={{ r: 2, fill: '#eab308' }} name="Blocked Revenue" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
        {policyLoading && <p className="text-center text-xs text-zinc-500 mt-2">Recalculating…</p>}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <div className="bg-zinc-900 rounded-xl ring-1 ring-zinc-800 overflow-hidden">
          <div className="px-4 py-3 border-b border-zinc-800 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-white">Policy Rules</h2>
            <button onClick={addRule} className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-medium transition-colors">
              <Plus className="h-3.5 w-3.5" /> Add Rule
            </button>
          </div>
          <div className="divide-y divide-zinc-800/50 max-h-[520px] overflow-y-auto">
            {rules.map((rule) => (
              <div key={rule.id} className={`px-4 py-3 space-y-3 transition-opacity ${rule.enabled ? '' : 'opacity-40'}`}>
                <div className="flex items-center justify-between">
                  <input
                    type="text"
                    value={rule.name}
                    onChange={(e) => updateRule(rule.id, { name: e.target.value })}
                    className="bg-transparent text-sm font-medium text-white border-b border-zinc-700 focus:border-blue-500 outline-none w-48"
                  />
                  <div className="flex items-center gap-2">
                    <button onClick={() => toggleRule(rule.id)} className="text-zinc-400 hover:text-white transition-colors">
                      {rule.enabled ? <ToggleRight className="h-5 w-5 text-blue-400" /> : <ToggleLeft className="h-5 w-5" />}
                    </button>
                    <button onClick={() => removeRule(rule.id)} className="text-zinc-500 hover:text-red-400 transition-colors">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <select
                    value={rule.field}
                    onChange={(e) => updateRule(rule.id, { field: e.target.value })}
                    className="bg-zinc-800 text-xs text-zinc-200 rounded-md px-2 py-1.5 ring-1 ring-zinc-700 outline-none focus:ring-blue-500"
                  >
                    {fieldOptions.map((f) => <option key={f} value={f}>{f}</option>)}
                  </select>
                  <select
                    value={rule.operator}
                    onChange={(e) => updateRule(rule.id, { operator: e.target.value as PolicyRule['operator'] })}
                    className="bg-zinc-800 text-xs text-zinc-200 rounded-md px-2 py-1.5 ring-1 ring-zinc-700 outline-none focus:ring-blue-500"
                  >
                    {operatorOptions.map((o) => <option key={o} value={o}>{operatorLabels[o]}</option>)}
                  </select>
                  <input
                    type="number"
                    value={rule.threshold}
                    onChange={(e) => updateRule(rule.id, { threshold: Number(e.target.value) })}
                    className="bg-zinc-800 text-xs text-zinc-200 rounded-md px-2 py-1.5 ring-1 ring-zinc-700 outline-none focus:ring-blue-500 w-24"
                  />
                  <ArrowRight className="h-3.5 w-3.5 text-zinc-500" />
                  <select
                    value={rule.action}
                    onChange={(e) => updateRule(rule.id, { action: e.target.value as RiskAction })}
                    className="bg-zinc-800 text-xs text-zinc-200 rounded-md px-2 py-1.5 ring-1 ring-zinc-700 outline-none focus:ring-blue-500"
                  >
                    {actionOptions.map((a) => <option key={a} value={a}>{a}</option>)}
                  </select>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: getActionColor(rule.action) }} />
                  <span className="text-[11px] text-zinc-500">
                    {rule.field} {operatorLabels[rule.operator]} {rule.threshold.toLocaleString()} → {rule.action}
                  </span>
                </div>
              </div>
            ))}
            {rules.length === 0 && (
              <div className="p-8 text-center text-zinc-500 text-sm">No rules defined. Add a rule to start simulating.</div>
            )}
          </div>
        </div>

        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-zinc-900 rounded-xl p-4 ring-1 ring-zinc-800">
              <div className="text-xs text-zinc-400 mb-1">Transactions Affected</div>
              <p className="text-3xl font-bold text-white">{formatNumber(changedTxns.length)}</p>
              <p className="text-xs text-zinc-500 mt-1">of {formatNumber(transactions.length)} total</p>
            </div>
            <div className="bg-zinc-900 rounded-xl p-4 ring-1 ring-zinc-800">
              <div className="text-xs text-zinc-400 mb-1">Financial Impact Change</div>
              <p className={`text-3xl font-bold ${changedAmount > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>
                {formatCurrency(changedAmount)}
              </p>
              <p className="text-xs text-zinc-500 mt-1">in affected volume</p>
            </div>
            <div className="bg-zinc-900 rounded-xl p-4 ring-1 ring-zinc-800">
              <div className="text-xs text-zinc-400 mb-2">Action Delta</div>
              <div className="space-y-1.5">
                {actionOptions.map((a) => {
                  const delta = simulatedCounts[a] - originalCounts[a];
                  return (
                    <div key={a} className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: getActionColor(a) }} />
                        <span className="text-zinc-300">{getActionLabel(a)}</span>
                      </div>
                      <span className={`font-mono font-medium ${delta > 0 ? 'text-emerald-400' : delta < 0 ? 'text-red-400' : 'text-zinc-500'}`}>
                        {delta > 0 ? '+' : ''}{delta}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="bg-zinc-900 rounded-xl p-4 ring-1 ring-zinc-800">
              <div className="text-xs text-zinc-400 mb-2">Summary</div>
              <div className="space-y-1.5 text-xs">
                <div className="flex justify-between">
                  <span className="text-zinc-400">More blocks</span>
                  <span className={blockDelta >= 0 ? 'text-red-400' : 'text-emerald-400'}>{blockDelta >= 0 ? '+' : ''}{blockDelta}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-400">More verifies</span>
                  <span className={verifyDelta >= 0 ? 'text-amber-400' : 'text-emerald-400'}>{verifyDelta >= 0 ? '+' : ''}{verifyDelta}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-400">More reviews</span>
                  <span className={reviewDelta >= 0 ? 'text-orange-400' : 'text-emerald-400'}>{reviewDelta >= 0 ? '+' : ''}{reviewDelta}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-400">More allows</span>
                  <span className={allowDelta >= 0 ? 'text-emerald-400' : 'text-red-400'}>{allowDelta >= 0 ? '+' : ''}{allowDelta}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-zinc-900 rounded-xl p-4 ring-1 ring-zinc-800">
            <h3 className="text-sm font-semibold text-white mb-4">Action Distribution: Before vs After</h3>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={chartData} barGap={4}>
                <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                <XAxis dataKey="action" tick={{ fill: '#a1a1aa', fontSize: 12 }} />
                <YAxis tick={{ fill: '#a1a1aa', fontSize: 12 }} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#18181b', border: '1px solid #27272a', borderRadius: 8, fontSize: 12 }}
                  labelStyle={{ color: '#fafafa' }}
                />
                <Legend wrapperStyle={{ fontSize: 12, color: '#a1a1aa' }} />
                <Bar dataKey="Before" fill="#6366f1" radius={[4, 4, 0, 0]} />
                <Bar dataKey="After" fill="#22d3ee" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {changedTxns.length > 0 && (
        <div className="bg-zinc-900 rounded-xl ring-1 ring-zinc-800 overflow-hidden">
          <div className="px-4 py-3 border-b border-zinc-800 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-400" />
            <h2 className="text-sm font-semibold text-white">Transaction Impact Table</h2>
            <span className="text-xs text-zinc-500 ml-auto">{changedTxns.length} transactions would change</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-zinc-800">
                  <th className="text-left px-4 py-2.5 text-zinc-400 font-medium">Transaction ID</th>
                  <th className="text-left px-4 py-2.5 text-zinc-400 font-medium">Order ID</th>
                  <th className="text-right px-4 py-2.5 text-zinc-400 font-medium">Amount</th>
                  <th className="text-left px-4 py-2.5 text-zinc-400 font-medium">Risk Score</th>
                  <th className="text-left px-4 py-2.5 text-zinc-400 font-medium">Original Action</th>
                  <th className="px-4 py-2.5"></th>
                  <th className="text-left px-4 py-2.5 text-zinc-400 font-medium">Simulated Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/50">
                {changedTxns.slice(0, 50).map((t) => {
                  const newAction = applyPolicy(t, rules);
                  return (
                    <tr key={t.id} className="hover:bg-zinc-800/40 transition-colors">
                      <td className="px-4 py-2 font-mono text-zinc-300">{t.id.slice(0, 16)}</td>
                      <td className="px-4 py-2 font-mono text-zinc-400">{t.orderId}</td>
                      <td className="px-4 py-2 text-right text-zinc-300">{formatCurrency(t.amount)}</td>
                      <td className="px-4 py-2">
                        <span className={`font-medium ${
                          t.riskScore >= 60 ? 'text-red-400' : t.riskScore >= 30 ? 'text-amber-400' : 'text-emerald-400'
                        }`}>{t.riskScore}/100</span>
                      </td>
                      <td className="px-4 py-2">
                        <span className="px-2 py-0.5 rounded text-[11px] font-medium" style={{ backgroundColor: getActionColor(t.recommendedAction) + '20', color: getActionColor(t.recommendedAction) }}>
                          {t.recommendedAction}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-zinc-600">→</td>
                      <td className="px-4 py-2">
                        <span className="px-2 py-0.5 rounded text-[11px] font-medium" style={{ backgroundColor: getActionColor(newAction) + '20', color: getActionColor(newAction) }}>
                          {newAction}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {changedTxns.length > 50 && (
            <div className="px-4 py-2.5 border-t border-zinc-800 text-xs text-zinc-500 text-center">
              Showing 50 of {changedTxns.length} affected transactions
            </div>
          )}
        </div>
      )}
    </div>
  );
}
