import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useStore } from '../hooks/useStore';
import { fetchTransactionDetail } from '../api/client';
import type { Transaction } from '../types';
import { formatCurrency, timeAgo, formatPercent } from '../utils/format';
import RiskBadge from '../components/RiskBadge';
import ActionBadge from '../components/ActionBadge';
import type { RiskAction, FeedbackLabel } from '../types';
import {
  ArrowLeft,
  User,
  Mail,
  Phone,
  Globe,
  CreditCard,
  Shield,
  AlertTriangle,
  CheckCircle2,
  Ban,
  Eye,
  Save,
  ThumbsUp,
  ThumbsDown,
  HelpCircle,
  TrendingUp,
  TrendingDown,
  Banknote,
  Loader2,
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';

const ACTION_CONFIG: Record<RiskAction, { icon: typeof Shield; color: string; bg: string }> = {
  allow: { icon: CheckCircle2, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
  verify: { icon: Eye, color: 'text-yellow-400', bg: 'bg-yellow-500/10' },
  review: { icon: AlertTriangle, color: 'text-orange-400', bg: 'bg-orange-500/10' },
  block: { icon: Ban, color: 'text-red-400', bg: 'bg-red-500/10' },
};

const FEEDBACK_CONFIG: Record<FeedbackLabel, { icon: typeof ThumbsUp; label: string; color: string; bg: string }> = {
  legitimate: { icon: ThumbsUp, label: 'Legitimate', color: 'text-emerald-400', bg: 'bg-emerald-500/10 hover:bg-emerald-500/20 ring-emerald-500/25' },
  fraudulent: { icon: ThumbsDown, label: 'Fraudulent', color: 'text-red-400', bg: 'bg-red-500/10 hover:bg-red-500/20 ring-red-500/25' },
  unknown: { icon: HelpCircle, label: 'Unknown', color: 'text-zinc-400', bg: 'bg-zinc-500/10 hover:bg-zinc-500/20 ring-zinc-500/25' },
};

function RiskGauge({ score }: { score: number }) {
  const radius = 70;
  const circumference = Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;

  const getColor = (s: number) => {
    if (s <= 25) return '#10b981';
    if (s <= 50) return '#eab308';
    if (s <= 75) return '#f97316';
    return '#ef4444';
  };

  return (
    <div className="relative flex flex-col items-center">
      <svg width="180" height="110" viewBox="0 0 180 110">
        <path
          d="M 10 100 A 80 80 0 0 1 170 100"
          fill="none"
          stroke="#27272a"
          strokeWidth="12"
          strokeLinecap="round"
        />
        <path
          d="M 10 100 A 80 80 0 0 1 170 100"
          fill="none"
          stroke={getColor(score)}
          strokeWidth="12"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{ transition: 'stroke-dashoffset 0.8s ease' }}
        />
      </svg>
      <div className="absolute bottom-4 flex flex-col items-center">
        <span className="text-4xl font-bold text-white">{score}</span>
        <span className="text-xs text-zinc-400 mt-0.5">out of 100</span>
      </div>
    </div>
  );
}

export default function TransactionInvestigation() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { transactions, recordMerchantDecision, recordFeedback, dataSource } = useStore();

  const [txn, setTxn] = useState<Transaction | undefined>(() =>
    transactions.find((t) => t.id === id)
  );
  const [loadingDetail, setLoadingDetail] = useState(false);

  const [decision, setDecision] = useState<RiskAction | null>(txn?.merchantDecision ?? null);
  const [notes, setNotes] = useState(txn?.investigationNotes ?? '');
  const [feedback, setFeedback] = useState<FeedbackLabel | null>(txn?.feedbackLabel ?? null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  // Pull the full transaction detail (with real factor contributions) from the
  // backend when available, falling back to the store copy.
  useEffect(() => {
    let cancelled = false;
    if (!id) return;
    setLoadingDetail(true);
    void fetchTransactionDetail(id).then((detail) => {
      if (cancelled) return;
      if (detail) {
        setTxn(detail);
        setDecision(detail.merchantDecision ?? null);
        setNotes(detail.investigationNotes ?? '');
        setFeedback(detail.feedbackLabel ?? null);
      }
      setLoadingDetail(false);
    });
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (!txn) {
    return (
      <div className="min-h-screen bg-zinc-950 p-6 flex items-center justify-center">
        <div className="text-center space-y-4">
          <AlertTriangle className="h-12 w-12 text-zinc-600 mx-auto" />
          <p className="text-zinc-400">Transaction not found</p>
          <button
            onClick={() => navigate('/transactions')}
            className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg text-sm"
          >
            Back to Transactions
          </button>
        </div>
      </div>
    );
  }

  const factorChartData = txn.factors.map((f) => ({
    name: f.name.length > 16 ? f.name.slice(0, 16) + '…' : f.name,
    contribution: f.contribution,
    value: f.value,
  }));

  const handleSave = async () => {
    if (!decision) return;
    setSaving(true);
    setSaveError(null);
    setSaveMessage(null);
    try {
      const ok = await recordMerchantDecision(txn.id, decision, notes);
      if (ok) {
        setSaveMessage(`Decision saved: ${decision}${notes ? ' · with notes' : ''}`);
      } else {
        setSaveError(`Failed to save decision for ${txn.id}. Please try again.`);
      }
    } finally {
      setSaving(false);
    }
  };

  const handleFeedback = async (label: FeedbackLabel) => {
    setFeedback(label);
    setSaveError(null);
    setSaveMessage(null);
    const ok = await recordFeedback(txn.id, label);
    if (ok) {
      setSaveMessage(`Feedback saved: ${label}`);
    } else {
      setSaveError(`Failed to save feedback for ${txn.id}. Please try again.`);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 p-6 space-y-6">
      <button
        onClick={() => navigate('/transactions')}
        className="flex items-center gap-2 text-sm text-zinc-400 hover:text-white transition-colors"
      >
        <ArrowLeft className="h-4 w-4" /> Back to Transactions
      </button>

      <div className="flex items-center gap-2 justify-end">
        {loadingDetail ? (
          <span className="text-xs text-zinc-500">Loading detail…</span>
        ) : (
          <span className={`px-2.5 py-1 rounded-full text-[10px] font-medium ring-1 ring-inset ${
            dataSource === 'backend'
              ? 'bg-emerald-500/10 ring-emerald-500/25 text-emerald-400'
              : 'bg-zinc-800 ring-zinc-700 text-zinc-400'
          }`}>
            {dataSource === 'backend' ? 'Live backend data' : 'Offline seed data'}
          </span>
        )}
      </div>

      <div className="bg-zinc-900 rounded-xl ring-1 ring-zinc-800 p-6">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-white">{txn.orderId}</h1>
              <RiskBadge level={txn.riskLevel} />
              <ActionBadge action={txn.recommendedAction} />
            </div>
            <p className="text-sm text-zinc-400">Transaction ID: {txn.id}</p>
          </div>
          <div className="text-right space-y-1">
            <p className="text-2xl font-bold text-white">{formatCurrency(txn.amount)}</p>
            <div className="flex items-center gap-2 justify-end">
              <span className={`text-xs font-medium capitalize px-2 py-0.5 rounded ${
                txn.status === 'completed'
                  ? 'text-emerald-400 bg-emerald-500/10'
                  : txn.status === 'failed'
                  ? 'text-red-400 bg-red-500/10'
                  : txn.status === 'chargeback'
                  ? 'text-orange-400 bg-orange-500/10'
                  : txn.status === 'refunded'
                  ? 'text-yellow-400 bg-yellow-500/10'
                  : 'text-zinc-400 bg-zinc-500/10'
              }`}>
                {txn.status}
              </span>
              <span className="text-xs text-zinc-500">{timeAgo(txn.createdAt)}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-2 space-y-6">
          <div className="bg-zinc-900 rounded-xl ring-1 ring-zinc-800 p-6">
            <h2 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
              <Shield className="h-4 w-4 text-purple-400" /> Risk Analysis
            </h2>
            <div className="grid grid-cols-3 gap-6">
              <div className="flex flex-col items-center justify-center">
                <RiskGauge score={txn.riskScore} />
              </div>
              <div className="col-span-2 space-y-3">
                <div>
                  <h3 className="text-xs text-zinc-400 mb-2">Factor Contributions</h3>
                  <div className="h-44">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={factorChartData} layout="vertical" margin={{ left: 0, right: 10, top: 0, bottom: 0 }}>
                        <XAxis type="number" hide />
                        <YAxis
                          type="category"
                          dataKey="name"
                          width={120}
                          tick={{ fontSize: 11, fill: '#a1a1aa' }}
                        />
                        <Tooltip
                          contentStyle={{ background: '#18181b', border: '1px solid #27272a', borderRadius: '8px', fontSize: '12px' }}
                          labelStyle={{ color: '#fff' }}
                          formatter={(val) => [Number(val).toFixed(1), 'Contribution']}
                        />
                        <Bar dataKey="contribution" radius={[0, 4, 4, 0]}>
                          {factorChartData.map((entry, i) => (
                            <Cell
                              key={i}
                              fill={entry.contribution > 20 ? '#ef4444' : entry.contribution > 10 ? '#f97316' : entry.contribution > 5 ? '#eab308' : '#10b981'}
                            />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-6 space-y-3">
              <h3 className="text-xs text-zinc-400">Risk Factors</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-zinc-800">
                      <th className="text-left py-2 text-zinc-400 font-medium">Factor</th>
                      <th className="text-left py-2 text-zinc-400 font-medium">Value</th>
                      <th className="text-left py-2 text-zinc-400 font-medium">Weight</th>
                      <th className="text-left py-2 text-zinc-400 font-medium">Contribution</th>
                      <th className="text-left py-2 text-zinc-400 font-medium">Description</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800/50">
                    {txn.factors.map((f, i) => (
                      <tr key={i}>
                        <td className="py-2 text-zinc-300 font-medium">{f.name}</td>
                        <td className="py-2">
                          <div className="flex items-center gap-2">
                            <div className="w-16 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-purple-500 rounded-full"
                                style={{ width: `${Math.min(f.value * 100, 100)}%` }}
                              />
                            </div>
                            <span className="text-zinc-400">{f.value.toFixed(2)}</span>
                          </div>
                        </td>
                        <td className="py-2 text-zinc-400">{formatPercent(f.weight)}</td>
                        <td className="py-2">
                          <span className={`font-medium ${
                            f.contribution > 20 ? 'text-red-400' : f.contribution > 10 ? 'text-orange-400' : f.contribution > 5 ? 'text-yellow-400' : 'text-emerald-400'
                          }`}>
                            {f.contribution.toFixed(1)}
                          </span>
                        </td>
                        <td className="py-2 text-zinc-500 max-w-[200px] truncate">{f.description}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-zinc-800">
              <h3 className="text-xs text-zinc-400 mb-3">Financial Impact</h3>
              <div className="grid grid-cols-4 gap-4">
                <div className="bg-zinc-800/50 rounded-lg p-3">
                  <div className="flex items-center gap-1.5 text-zinc-400 text-xs mb-1">
                    <TrendingUp className="h-3 w-3" /> Exposure
                  </div>
                  <p className="text-sm font-semibold text-white">{formatCurrency(txn.riskScore > 50 ? txn.amount : txn.amount * 0.3)}</p>
                </div>
                <div className="bg-zinc-800/50 rounded-lg p-3">
                  <div className="flex items-center gap-1.5 text-zinc-400 text-xs mb-1">
                    <TrendingDown className="h-3 w-3" /> Recoverable Loss
                  </div>
                  <p className="text-sm font-semibold text-yellow-400">{formatCurrency(txn.amount * 0.15)}</p>
                </div>
                <div className="bg-zinc-800/50 rounded-lg p-3">
                  <div className="flex items-center gap-1.5 text-zinc-400 text-xs mb-1">
                    <Ban className="h-3 w-3" /> False Positive Cost
                  </div>
                  <p className="text-sm font-semibold text-orange-400">{formatCurrency(txn.riskScore < 50 ? txn.amount * 0.1 : 0)}</p>
                </div>
                <div className="bg-zinc-800/50 rounded-lg p-3">
                  <div className="flex items-center gap-1.5 text-zinc-400 text-xs mb-1">
                    <Banknote className="h-3 w-3" /> Net Protection
                  </div>
                  <p className="text-sm font-semibold text-emerald-400">{formatCurrency(txn.amount * 0.85)}</p>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-zinc-900 rounded-xl ring-1 ring-zinc-800 p-6">
            <h2 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
              <User className="h-4 w-4 text-purple-400" /> Customer Information
            </h2>
            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-center gap-3 p-3 bg-zinc-800/50 rounded-lg">
                <Mail className="h-4 w-4 text-zinc-400" />
                <div>
                  <p className="text-xs text-zinc-400">Email</p>
                  <p className="text-sm text-white">{txn.customerEmail}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 bg-zinc-800/50 rounded-lg">
                <Phone className="h-4 w-4 text-zinc-400" />
                <div>
                  <p className="text-xs text-zinc-400">Phone</p>
                  <p className="text-sm text-white">{txn.customerPhone}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 bg-zinc-800/50 rounded-lg">
                <Globe className="h-4 w-4 text-zinc-400" />
                <div>
                  <p className="text-xs text-zinc-400">IP Address</p>
                  <p className="text-sm text-white font-mono">{txn.customerIp}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 bg-zinc-800/50 rounded-lg">
                <CreditCard className="h-4 w-4 text-zinc-400" />
                <div>
                  <p className="text-xs text-zinc-400">Payment</p>
                  <p className="text-sm text-white capitalize">
                    {txn.paymentMethod}
                    {txn.cardLast4 && ` •••• ${txn.cardLast4}`}
                    {txn.upiId && ` — ${txn.upiId}`}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-zinc-900 rounded-xl ring-1 ring-zinc-800 p-6">
            <h2 className="text-sm font-semibold text-white mb-4">Merchant Decision</h2>
            <div className="grid grid-cols-2 gap-2 mb-4">
              {(['allow', 'verify', 'review', 'block'] as RiskAction[]).map((action) => {
                const config = ACTION_CONFIG[action];
                const Icon = config.icon;
                return (
                  <button
                    key={action}
                    onClick={() => setDecision(action)}
                    className={`flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg text-xs font-medium transition-all ring-1 ${
                      decision === action
                        ? `${config.bg} ${config.color} ring-current`
                        : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700 ring-zinc-700'
                    }`}
                  >
                    <Icon className="h-3.5 w-3.5" /> {action.charAt(0).toUpperCase() + action.slice(1)}
                  </button>
                );
              })}
            </div>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Investigation notes..."
              rows={4}
              className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50 resize-none mb-3"
            />
            <button
              onClick={handleSave}
              disabled={!decision || saving}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-purple-600 hover:bg-purple-500 disabled:bg-zinc-800 disabled:text-zinc-500 text-white rounded-lg text-sm font-medium transition-colors"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {saving ? 'Saving…' : 'Save Decision'}
            </button>
            {saveError && (
              <div className="mt-3 flex items-center gap-2 px-3 py-2.5 rounded-lg bg-red-500/10 text-red-400 text-sm">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                <span>{saveError}</span>
              </div>
            )}
            {saveMessage && (
              <div className="mt-3 flex items-center gap-2 px-3 py-2.5 rounded-lg bg-emerald-500/10 text-emerald-400 text-sm">
                <CheckCircle2 className="h-4 w-4 shrink-0" />
                <span>{saveMessage}</span>
              </div>
            )}
          </div>

          <div className="bg-zinc-900 rounded-xl ring-1 ring-zinc-800 p-6">
            <h2 className="text-sm font-semibold text-white mb-4">Feedback</h2>
            <div className="space-y-2">
              {(['legitimate', 'fraudulent', 'unknown'] as FeedbackLabel[]).map((label) => {
                const config = FEEDBACK_CONFIG[label];
                const Icon = config.icon;
                return (
                  <button
                    key={label}
                    onClick={() => handleFeedback(label)}
                    className={`w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-xs font-medium transition-all ring-1 ${
                      feedback === label
                        ? `${config.bg} ${config.color} ring-current`
                        : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700 ring-zinc-700'
                    }`}
                  >
                    <Icon className="h-3.5 w-3.5" /> {config.label}
                    {feedback === label && <CheckCircle2 className="h-3 w-3 ml-auto" />}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
