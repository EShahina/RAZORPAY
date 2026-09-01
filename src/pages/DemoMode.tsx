import { useState, useEffect, useRef, useCallback } from 'react';
import { useStore } from '../hooks/useStore';
import { seedDemoScenarios } from '../data/seedData';
import { formatCurrency, formatRiskScore } from '../utils/format';
import type { RiskLevel, RiskAction } from '../types';
import {
  Play,
  Pause,
  SkipForward,
  SkipBack,
  RotateCcw,
  Check,
  Clock,
  Shield,
  Database,
  Brain,
  Zap,
  BarChart3,
  AlertTriangle,
  Bell,
  Search,
  Gavel,
  RefreshCw,
  Activity,
  FileText,
} from 'lucide-react';

const STEPS = [
  { title: 'Overview', icon: Shield },
  { title: 'Data Model', icon: Database },
  { title: 'Risk Engine', icon: Brain },
  { title: 'Live Transaction', icon: Zap },
  { title: 'Risk Scoring', icon: BarChart3 },
  { title: 'Spike Detection', icon: AlertTriangle },
  { title: 'Alert Generation', icon: Bell },
  { title: 'Transaction Investigation', icon: Search },
  { title: 'Merchant Decision', icon: Gavel },
  { title: 'Feedback Loop', icon: RefreshCw },
  { title: 'Model Evaluation', icon: Activity },
  { title: 'Summary', icon: FileText },
] as const;

const RISK_COLORS: Record<RiskLevel, string> = {
  low: 'text-emerald-400 bg-emerald-500/10',
  medium: 'text-yellow-400 bg-yellow-500/10',
  high: 'text-orange-400 bg-orange-500/10',
  critical: 'text-red-400 bg-red-500/10',
};

const ACTION_COLORS: Record<RiskAction, string> = {
  allow: 'text-emerald-400 bg-emerald-500/10',
  verify: 'text-yellow-400 bg-yellow-500/10',
  review: 'text-orange-400 bg-orange-500/10',
  block: 'text-red-400 bg-red-500/10',
};

function stepContent(step: number, txn: ReturnType<typeof simulateTransaction>) {
  switch (step) {
    case 0:
      return (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-white">Welcome to MerchantShield AI</h3>
          <p className="text-sm text-zinc-400 leading-relaxed">
            MerchantShield AI is a real-time fraud detection and risk scoring system built for Indian payment ecosystems.
            It analyzes transaction features, detects fraud spikes, and provides explainable risk decisions — all in under 100ms.
          </p>
          <div className="grid grid-cols-2 gap-3 mt-4">
            {['Real-time Scoring', 'Explainable AI', 'Spike Detection', 'Feedback Learning'].map((item) => (
              <div key={item} className="flex items-center gap-2 bg-zinc-800/50 rounded-lg px-3 py-2">
                <Check className="h-4 w-4 text-cyan-400" />
                <span className="text-sm text-zinc-300">{item}</span>
              </div>
            ))}
          </div>
        </div>
      );
    case 1:
      return (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-white">Data Model</h3>
          <p className="text-sm text-zinc-400">Core entities and their relationships:</p>
          <div className="space-y-2">
            {[
              { name: 'Transaction', desc: 'Payment event with amount, method, customer details, and risk scores', color: 'cyan' },
              { name: 'Customer', desc: 'Identity with account age, history, and cumulative risk profile', color: 'purple' },
              { name: 'Alert', desc: 'Triggered when spike or anomaly thresholds are breached', color: 'red' },
              { name: 'Chargeback', desc: 'Disputed transaction with evidence and resolution status', color: 'orange' },
              { name: 'Return', desc: 'Refund request with risk evaluation', color: 'yellow' },
              { name: 'Policy Rule', desc: 'Configurable thresholds that drive automated decisions', color: 'emerald' },
            ].map((entity) => (
              <div key={entity.name} className="flex items-start gap-3 bg-zinc-800/50 rounded-lg px-3 py-2.5">
                <span className={`text-xs font-mono font-bold px-1.5 py-0.5 rounded bg-${entity.color}-500/10 text-${entity.color}-400 shrink-0 mt-0.5`}>
                  {entity.name}
                </span>
                <span className="text-xs text-zinc-400">{entity.desc}</span>
              </div>
            ))}
          </div>
        </div>
      );
    case 2:
      return (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-white">Risk Engine</h3>
          <p className="text-sm text-zinc-400">Feature-weighted scoring with 7 factors:</p>
          <div className="space-y-2">
            {[
              { name: 'Amount Deviation', weight: '20%', desc: 'How unusual is the transaction amount vs customer history' },
              { name: 'Account Age', weight: '20%', desc: 'Newer accounts carry higher risk signals' },
              { name: 'Attempt Count', weight: '15%', desc: 'Multiple failed attempts suggest fraud probing' },
              { name: 'Velocity', weight: '25%', desc: 'Transaction frequency within time windows' },
              { name: 'Chargeback History', weight: '10%', desc: 'Past chargeback ratio for the customer' },
              { name: 'Refund History', weight: '5%', desc: 'Abnormal refund patterns' },
              { name: 'IP Risk', weight: '5%', desc: 'IP reputation and geolocation signals' },
            ].map((f) => (
              <div key={f.name} className="flex items-center gap-3 bg-zinc-800/50 rounded-lg px-3 py-2">
                <span className="text-xs font-mono font-bold text-cyan-400 w-10 text-right shrink-0">{f.weight}</span>
                <div className="flex-1">
                  <span className="text-sm text-white font-medium">{f.name}</span>
                  <p className="text-[11px] text-zinc-500">{f.desc}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="bg-zinc-800/50 rounded-lg px-3 py-2 mt-2">
            <p className="text-xs text-zinc-400">
              Score = Σ(factor_value × weight). Range: 0 (safe) to 100 (certain fraud).
              Thresholds: &lt;25 allow, 25-50 verify, 50-75 review, &gt;75 block.
            </p>
          </div>
        </div>
      );
    case 3:
      return (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-white">Live Transaction</h3>
          <p className="text-sm text-zinc-400">A new transaction just arrived for scoring:</p>
          <div className="bg-zinc-800/50 rounded-lg p-4 space-y-3 border border-zinc-700/50">
            <div className="flex items-center justify-between">
              <span className="text-xs text-zinc-500">Transaction ID</span>
              <span className="text-xs font-mono text-white">{txn.id}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-zinc-500">Amount</span>
              <span className="text-sm font-bold text-white">{formatCurrency(txn.amount)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-zinc-500">Payment Method</span>
              <span className="text-xs text-zinc-300 uppercase">{txn.method}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-zinc-500">Customer</span>
              <span className="text-xs text-zinc-300">{txn.email}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-zinc-500">IP Address</span>
              <span className="text-xs font-mono text-zinc-300">{txn.ip}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-zinc-500">Received At</span>
              <span className="text-xs text-zinc-300">{new Date().toLocaleTimeString()}</span>
            </div>
          </div>
          <div className="flex items-center gap-2 text-cyan-400">
            <div className="h-1.5 w-1.5 rounded-full bg-cyan-400 animate-pulse" />
            <span className="text-xs">Processing through risk engine...</span>
          </div>
        </div>
      );
    case 4:
      return (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-white">Risk Scoring</h3>
          <p className="text-sm text-zinc-400">Real-time factor analysis for this transaction:</p>
          <div className="flex items-center gap-4 mb-4">
            <div className="text-center">
              <p className="text-4xl font-bold text-white">{formatRiskScore(txn.score)}</p>
              <p className="text-xs text-zinc-500 mt-1">Risk Score</p>
            </div>
            <div className="flex-1 space-y-2">
              <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${RISK_COLORS[txn.level]}`}>
                {txn.level.toUpperCase()}
              </span>
              <span className={`text-xs font-medium px-2 py-0.5 rounded-full ml-2 ${ACTION_COLORS[txn.action]}`}>
                {txn.action.toUpperCase()}
              </span>
            </div>
          </div>
          <div className="space-y-2">
            {txn.factors.map((f) => (
              <div key={f.name} className="flex items-center gap-3">
                <div className="w-32 shrink-0">
                  <span className="text-xs text-zinc-400">{f.name.replace(/_/g, ' ')}</span>
                </div>
                <div className="flex-1 h-2 bg-zinc-800 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${Math.min(f.contribution * 500, 100)}%`,
                      backgroundColor: f.contribution > 0.1 ? '#ef4444' : f.contribution > 0.05 ? '#eab308' : '#10b981',
                    }}
                  />
                </div>
                <span className="text-[10px] font-mono text-zinc-400 w-16 text-right">
                  w:{(f.weight * 100).toFixed(0)}% c:{(f.contribution * 100).toFixed(1)}%
                </span>
              </div>
            ))}
          </div>
          <p className="text-xs text-zinc-500 italic">Each bar shows the factor's contribution to the final risk score.</p>
        </div>
      );
    case 5:
      return (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-white">Spike Detection</h3>
          <p className="text-sm text-zinc-400">Monitoring transaction volume against baseline:</p>
          <div className="bg-zinc-800/50 rounded-lg p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs text-zinc-500">Monitoring Window</span>
              <span className="text-xs text-zinc-300">Last 15 minutes</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-zinc-500">Baseline Count</span>
              <span className="text-xs text-zinc-300">12 transactions / 15min</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-zinc-500">Current Count</span>
              <span className="text-xs text-orange-400 font-medium">18 transactions / 15min</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-zinc-500">Spike</span>
              <span className="text-xs font-bold text-yellow-400">+50% above baseline</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-zinc-500">Status</span>
              <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-yellow-500/10 text-yellow-400 ring-1 ring-inset ring-yellow-500/25">
                ELEVATED
              </span>
            </div>
          </div>
          <p className="text-xs text-zinc-500">
            Spike detection uses a sliding window approach. When current volume exceeds 1.5x the rolling baseline,
            an alert is triggered for merchant review.
          </p>
        </div>
      );
    case 6:
      return (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-white">Alert Generation</h3>
          <p className="text-sm text-zinc-400">An alert was automatically created:</p>
          <div className="bg-red-500/5 border border-red-500/20 rounded-lg p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Bell className="h-4 w-4 text-red-400" />
              <span className="text-sm font-semibold text-white">Fraud Spike Detected</span>
            </div>
            <p className="text-xs text-zinc-400">
              Transaction volume spiked 50% above baseline in the last 15 minutes. 6 transactions flagged as high-risk.
            </p>
            <div className="grid grid-cols-3 gap-3">
              <div className="text-center">
                <p className="text-lg font-bold text-white">₹1,24,800</p>
                <p className="text-[10px] text-zinc-500">Total Exposure</p>
              </div>
              <div className="text-center">
                <p className="text-lg font-bold text-orange-400">6</p>
                <p className="text-[10px] text-zinc-500">Flagged Txns</p>
              </div>
              <div className="text-center">
                <p className="text-lg font-bold text-yellow-400">15 min</p>
                <p className="text-[10px] text-zinc-500">Window</p>
              </div>
            </div>
            <div className="flex gap-2">
              <span className="text-[10px] font-medium px-2 py-0.5 rounded bg-red-500/10 text-red-400">critical</span>
              <span className="text-[10px] font-medium px-2 py-0.5 rounded bg-zinc-700 text-zinc-300">active</span>
            </div>
          </div>
        </div>
      );
    case 7:
      return (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-white">Transaction Investigation</h3>
          <p className="text-sm text-zinc-400">Walk through the flagged transaction:</p>
          <div className="bg-zinc-800/50 rounded-lg p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs text-zinc-500">Investigation Focus</span>
              <span className="text-xs text-white font-medium">TXN-007 — ₹24,999 Card Payment</span>
            </div>
            <div className="space-y-2">
              {[
                { label: 'Card BIN', value: '520xxx — mismatch with billing country', status: 'warning' },
                { label: 'IP Geolocation', value: 'Mumbai IP, billing address Delhi', status: 'warning' },
                { label: 'Device Fingerprint', value: 'New device, first seen today', status: 'warning' },
                { label: 'Velocity', value: '3rd card transaction from this IP in 10 min', status: 'critical' },
                { label: 'Amount', value: '₹24,999 — 8x customer average', status: 'warning' },
              ].map((item) => (
                <div key={item.label} className="flex items-center gap-3">
                  <span className={`h-2 w-2 rounded-full shrink-0 ${item.status === 'critical' ? 'bg-red-400' : 'bg-yellow-400'}`} />
                  <span className="text-xs text-zinc-500 w-28 shrink-0">{item.label}</span>
                  <span className="text-xs text-zinc-300">{item.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      );
    case 8:
      return (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-white">Merchant Decision</h3>
          <p className="text-sm text-zinc-400">The merchant reviews and records a decision:</p>
          <div className="bg-zinc-800/50 rounded-lg p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Gavel className="h-4 w-4 text-purple-400" />
              <span className="text-sm font-semibold text-white">Decision Record</span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <span className="text-[10px] text-zinc-500 block mb-1">AI Recommendation</span>
                <span className="text-xs font-medium px-2 py-0.5 rounded bg-orange-500/10 text-orange-400">REVIEW</span>
              </div>
              <div>
                <span className="text-[10px] text-zinc-500 block mb-1">Merchant Decision</span>
                <span className="text-xs font-medium px-2 py-0.5 rounded bg-red-500/10 text-red-400">BLOCK</span>
              </div>
            </div>
            <div className="bg-zinc-900 rounded-lg p-3">
              <span className="text-[10px] text-zinc-500 block mb-1">Investigation Notes</span>
              <p className="text-xs text-zinc-300 italic">
                "BIN mismatch, velocity anomaly, and new device. Blocking pending customer verification via OTP.
                Will allow if customer confirms via registered phone."
              </p>
            </div>
            <p className="text-[10px] text-zinc-500">Decision recorded at {new Date().toLocaleTimeString()}</p>
          </div>
        </div>
      );
    case 9:
      return (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-white">Feedback Loop</h3>
          <p className="text-sm text-zinc-400">How feedback improves future predictions:</p>
          <div className="space-y-3">
            {[
              { step: '1', label: 'Merchant labels transaction', desc: 'Mark as legitimate, fraudulent, or unknown', color: 'cyan' },
              { step: '2', label: 'Label flows to training pipeline', desc: 'Aggregated with other feedback signals', color: 'purple' },
              { step: '3', label: 'Model re-evaluates weights', desc: 'Features that correlate with fraud get higher weight', color: 'yellow' },
              { step: '4', label: 'Updated model deployed', desc: 'A/B tested against current version', color: 'emerald' },
            ].map((s) => (
              <div key={s.step} className="flex items-start gap-3">
                <span className={`text-xs font-bold h-6 w-6 rounded-full bg-${s.color}-500/10 text-${s.color}-400 flex items-center justify-center shrink-0`}>
                  {s.step}
                </span>
                <div>
                  <p className="text-sm text-white font-medium">{s.label}</p>
                  <p className="text-xs text-zinc-500">{s.desc}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="bg-zinc-800/50 rounded-lg p-3 mt-2">
            <p className="text-xs text-zinc-400">
              Current feedback collection rate: <span className="text-white font-medium">78%</span> of blocked transactions
              are labeled within 24 hours.
            </p>
          </div>
        </div>
      );
    case 10:
      return (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-white">Model Evaluation</h3>
          <p className="text-sm text-zinc-400">Performance metrics from evaluation pipeline:</p>
          <div className="grid grid-cols-2 gap-3">
            {[
              { metric: 'Accuracy', value: '94.2%', color: 'text-emerald-400' },
              { metric: 'Precision', value: '91.8%', color: 'text-emerald-400' },
              { metric: 'Recall', value: '89.5%', color: 'text-yellow-400' },
              { metric: 'F1 Score', value: '90.6%', color: 'text-emerald-400' },
              { metric: 'AUC-ROC', value: '0.963', color: 'text-emerald-400' },
              { metric: 'False Positive Rate', value: '3.2%', color: 'text-emerald-400' },
            ].map((m) => (
              <div key={m.metric} className="bg-zinc-800/50 rounded-lg p-3 text-center">
                <p className={`text-lg font-bold ${m.color}`}>{m.value}</p>
                <p className="text-[10px] text-zinc-500 mt-0.5">{m.metric}</p>
              </div>
            ))}
          </div>
          <div className="bg-zinc-800/50 rounded-lg p-3">
            <p className="text-[10px] text-zinc-500">Confusion Matrix (10,000 sample)</p>
            <div className="grid grid-cols-2 gap-2 mt-2">
              <div className="text-center bg-emerald-500/5 rounded p-2">
                <p className="text-sm font-bold text-emerald-400">8,420</p>
                <p className="text-[9px] text-zinc-500">True Negatives</p>
              </div>
              <div className="text-center bg-red-500/5 rounded p-2">
                <p className="text-sm font-bold text-red-400">320</p>
                <p className="text-[9px] text-zinc-500">False Positives</p>
              </div>
              <div className="text-center bg-yellow-500/5 rounded p-2">
                <p className="text-sm font-bold text-yellow-400">105</p>
                <p className="text-[9px] text-zinc-500">False Negatives</p>
              </div>
              <div className="text-center bg-cyan-500/5 rounded p-2">
                <p className="text-sm font-bold text-cyan-400">1,155</p>
                <p className="text-[9px] text-zinc-500">True Positives</p>
              </div>
            </div>
          </div>
        </div>
      );
    case 11:
      return (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-white">Summary</h3>
          <p className="text-sm text-zinc-400">Key capabilities demonstrated:</p>
          <div className="space-y-2">
            {[
              { icon: Zap, label: 'Real-time transaction scoring under 100ms', color: 'cyan' },
              { icon: Brain, label: 'Explainable risk factor breakdown for every decision', color: 'purple' },
              { icon: AlertTriangle, label: 'Automatic fraud spike detection with configurable thresholds', color: 'red' },
              { icon: Bell, label: 'Alert generation with exposure calculation and severity levels', color: 'orange' },
              { icon: Search, label: 'Transaction investigation workflow with evidence aggregation', color: 'yellow' },
              { icon: Gavel, label: 'Merchant decision recording with audit trail', color: 'emerald' },
              { icon: RefreshCw, label: 'Feedback loop for continuous model improvement', color: 'cyan' },
              { icon: Activity, label: 'Model performance tracking with confusion matrix', color: 'purple' },
            ].map((item) => (
              <div key={item.label} className="flex items-center gap-3 bg-zinc-800/50 rounded-lg px-3 py-2">
                <item.icon className={`h-4 w-4 text-${item.color}-400 shrink-0`} />
                <span className="text-sm text-zinc-300">{item.label}</span>
              </div>
            ))}
          </div>
          <div className="bg-cyan-500/5 border border-cyan-500/20 rounded-lg p-4 mt-4">
            <p className="text-sm text-cyan-300 font-medium">Built for the Razorpay hackathon</p>
            <p className="text-xs text-zinc-500 mt-1">
              MerchantShield AI demonstrates how gradient ensemble models can power real-time payment risk
              scoring with full explainability, designed for the Indian digital payments ecosystem.
            </p>
          </div>
        </div>
      );
    default:
      return null;
  }
}

function simulateTransaction() {
  const scenarios = seedDemoScenarios;
  const scenario = scenarios[Math.floor(Math.random() * scenarios.length)];
  const scoreMap: Record<RiskLevel, number> = { low: 12, medium: 42, high: 68, critical: 91 };
  const factors = [
    { name: 'amount_deviation', value: 0.32, weight: 0.2, contribution: 0.064, description: 'Amount deviation from norm' },
    { name: 'account_age', value: 0.15, weight: 0.2, contribution: 0.03, description: 'Account age factor' },
    { name: 'attempt_count', value: 0.08, weight: 0.15, contribution: 0.012, description: 'Failed attempt count' },
    { name: 'velocity', value: 0.45, weight: 0.25, contribution: 0.1125, description: 'Transaction velocity' },
    { name: 'chargeback_history', value: 0.1, weight: 0.1, contribution: 0.01, description: 'Chargeback ratio' },
    { name: 'refund_history', value: 0.05, weight: 0.05, contribution: 0.0025, description: 'Refund ratio' },
    { name: 'ip_risk', value: 0.35, weight: 0.05, contribution: 0.0175, description: 'IP reputation score' },
  ];
  return {
    id: `TXN-${Date.now().toString(36).slice(-6).toUpperCase()}`,
    amount: scenario.amount,
    method: scenario.paymentMethod,
    email: scenario.customerEmail,
    ip: `${Math.floor(Math.random() * 200 + 50)}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`,
    score: scoreMap[scenario.expectedRisk],
    level: scenario.expectedRisk,
    action: scenario.expectedAction,
    factors,
    scenario,
  };
}

export default function DemoMode() {
  const { demoMode, demoStep, startDemo, nextDemoStep, resetDemo, setDemoStep } = useStore();
  const [playing, setPlaying] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef<number>(0);
  const autoPlayRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const elapsedRef = useRef(0);

  const currentStep = demoMode ? demoStep : 0;
  const [txn] = useState(simulateTransaction);

  const formatTime = useCallback((ms: number) => {
    const secs = Math.floor(ms / 1000);
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  }, []);

  useEffect(() => {
    if (playing) {
      startTimeRef.current = Date.now() - elapsedRef.current;
      timerRef.current = setInterval(() => {
        const next = Date.now() - startTimeRef.current;
        elapsedRef.current = next;
        setElapsed(next);
      }, 100);
    } else if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [playing]);

  useEffect(() => {
    if (autoPlayRef.current) {
      clearInterval(autoPlayRef.current);
      autoPlayRef.current = null;
    }
    if (!playing || !demoMode || currentStep >= 11) {
      return;
    }
    autoPlayRef.current = setInterval(() => {
      nextDemoStep();
    }, 5000);
    return () => {
      if (autoPlayRef.current) clearInterval(autoPlayRef.current);
    };
  }, [playing, demoMode, currentStep, nextDemoStep]);

  const handleStart = () => {
    startDemo();
    elapsedRef.current = 0;
    setElapsed(0);
    setPlaying(true);
  };

  const handleReset = () => {
    resetDemo();
    setPlaying(false);
    elapsedRef.current = 0;
    setElapsed(0);
  };

  const handlePrev = () => {
    if (currentStep > 0) setDemoStep(currentStep - 1);
  };

  const handleNext = () => {
    if (currentStep < 11) nextDemoStep();
  };

  const handleTogglePlay = () => {
    if (currentStep >= 11) return;
    setPlaying(!playing);
  };

  if (!demoMode) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="text-center space-y-6 max-w-md">
          <div className="p-4 bg-cyan-500/10 rounded-2xl inline-block mx-auto">
            <Play className="h-12 w-12 text-cyan-400" />
          </div>
          <h1 className="text-3xl font-bold text-white">MerchantShield AI Demo</h1>
          <p className="text-sm text-zinc-400 leading-relaxed">
            Walk through the complete fraud detection workflow — from transaction ingestion to
            model evaluation. 12 guided steps in under 3 minutes.
          </p>
          <button
            onClick={handleStart}
            className="inline-flex items-center gap-2 px-6 py-3 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl text-sm font-semibold transition-colors"
          >
            <Play className="h-4 w-4" /> Start Demo
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-cyan-500/10 rounded-lg">
            <Play className="h-6 w-6 text-cyan-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Hackathon Demo</h1>
            <p className="text-sm text-zinc-400">Step {currentStep + 1} of 12 — {STEPS[currentStep].title}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-xs text-zinc-400 bg-zinc-900 px-3 py-1.5 rounded-lg ring-1 ring-zinc-800">
            <Clock className="h-3.5 w-3.5" />
            <span className="font-mono">{formatTime(elapsed)}</span>
            <span className="text-zinc-600">/ 3:00</span>
          </div>
          <button
            onClick={handleReset}
            className="p-2 text-zinc-400 hover:text-white bg-zinc-900 rounded-lg ring-1 ring-zinc-800 transition-colors"
            title="Reset"
          >
            <RotateCcw className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="flex items-center gap-1.5 justify-center">
        {STEPS.map((step, i) => {
          const completed = i < currentStep;
          const active = i === currentStep;
          return (
            <button
              key={i}
              onClick={() => setDemoStep(i)}
              className={`h-8 w-8 rounded-full flex items-center justify-center text-xs font-medium transition-all ${
                completed
                  ? 'bg-emerald-500/20 text-emerald-400 ring-1 ring-inset ring-emerald-500/30'
                  : active
                  ? 'bg-cyan-500/20 text-cyan-400 ring-1 ring-inset ring-cyan-500/30 scale-110'
                  : 'bg-zinc-800 text-zinc-500 ring-1 ring-zinc-700 hover:ring-zinc-600'
              }`}
              title={step.title}
            >
              {completed ? <Check className="h-3.5 w-3.5" /> : i + 1}
            </button>
          );
        })}
      </div>

      <div className="grid grid-cols-2 gap-6 min-h-[480px]">
        <div className="bg-zinc-900 rounded-xl ring-1 ring-zinc-800 p-5">
          <div className="flex items-center gap-2 mb-4">
            {(() => {
              const Icon = STEPS[currentStep].icon;
              return <Icon className="h-5 w-5 text-cyan-400" />;
            })()}
            <h2 className="text-sm font-semibold text-white">{STEPS[currentStep].title}</h2>
          </div>
          {stepContent(currentStep, txn)}
        </div>

        <div className="bg-zinc-900 rounded-xl ring-1 ring-zinc-800 p-5">
          <h2 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-cyan-400 animate-pulse" />
            Live Execution
          </h2>
          <div className="space-y-3 text-xs font-mono text-zinc-400">
            <div className="flex items-start gap-2">
              <span className="text-zinc-600 shrink-0">[{new Date().toLocaleTimeString()}]</span>
              <span className="text-emerald-400">✓ Pipeline initialized</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-zinc-600 shrink-0">[{new Date().toLocaleTimeString()}]</span>
              <span className="text-zinc-300">Loading model weights from checkpoint v2.1...</span>
            </div>
            {currentStep >= 1 && (
              <div className="flex items-start gap-2">
                <span className="text-zinc-600 shrink-0">[{new Date().toLocaleTimeString()}]</span>
                <span className="text-cyan-400">→ Data model schema loaded (6 entities)</span>
              </div>
            )}
            {currentStep >= 2 && (
              <div className="flex items-start gap-2">
                <span className="text-zinc-600 shrink-0">[{new Date().toLocaleTimeString()}]</span>
                <span className="text-cyan-400">→ Risk engine ready (7 factors, weights loaded)</span>
              </div>
            )}
            {currentStep >= 3 && (
              <div className="flex items-start gap-2">
                <span className="text-zinc-600 shrink-0">[{new Date().toLocaleTimeString()}]</span>
                <span className="text-yellow-400">⚡ New transaction received: {txn.id}</span>
              </div>
            )}
            {currentStep >= 4 && (
              <div className="flex items-start gap-2">
                <span className="text-zinc-600 shrink-0">[{new Date().toLocaleTimeString()}]</span>
                <span className="text-white font-semibold">Score: {formatRiskScore(txn.score)} | {txn.level.toUpperCase()} → {txn.action.toUpperCase()}</span>
              </div>
            )}
            {currentStep >= 5 && (
              <div className="flex items-start gap-2">
                <span className="text-zinc-600 shrink-0">[{new Date().toLocaleTimeString()}]</span>
                <span className="text-orange-400">⚠ Spike detected: +50% above 15min baseline</span>
              </div>
            )}
            {currentStep >= 6 && (
              <div className="flex items-start gap-2">
                <span className="text-zinc-600 shrink-0">[{new Date().toLocaleTimeString()}]</span>
                <span className="text-red-400">🔔 Alert created: SPL-2026-0831 | severity=critical</span>
              </div>
            )}
            {currentStep >= 7 && (
              <div className="flex items-start gap-2">
                <span className="text-zinc-600 shrink-0">[{new Date().toLocaleTimeString()}]</span>
                <span className="text-yellow-400">🔍 Investigation started for {txn.id}</span>
              </div>
            )}
            {currentStep >= 8 && (
              <div className="flex items-start gap-2">
                <span className="text-zinc-600 shrink-0">[{new Date().toLocaleTimeString()}]</span>
                <span className="text-purple-400">⚖ Merchant decision recorded: BLOCK</span>
              </div>
            )}
            {currentStep >= 9 && (
              <div className="flex items-start gap-2">
                <span className="text-zinc-600 shrink-0">[{new Date().toLocaleTimeString()}]</span>
                <span className="text-cyan-400">🔄 Feedback label applied: fraudulent</span>
              </div>
            )}
            {currentStep >= 10 && (
              <div className="flex items-start gap-2">
                <span className="text-zinc-600 shrink-0">[{new Date().toLocaleTimeString()}]</span>
                <span className="text-emerald-400">✓ Model evaluation complete | F1: 90.6% | AUC: 0.963</span>
              </div>
            )}
            {currentStep >= 11 && (
              <div className="flex items-start gap-2">
                <span className="text-zinc-600 shrink-0">[{new Date().toLocaleTimeString()}]</span>
                <span className="text-emerald-400 font-semibold">✓ Demo complete — all 12 steps executed successfully</span>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center justify-center gap-4">
        <button
          onClick={handlePrev}
          disabled={currentStep === 0}
          className="flex items-center gap-2 px-4 py-2 bg-zinc-900 hover:bg-zinc-800 disabled:opacity-40 disabled:cursor-not-allowed text-zinc-300 rounded-lg text-sm font-medium transition-colors ring-1 ring-zinc-800"
        >
          <SkipBack className="h-4 w-4" /> Previous
        </button>
        <button
          onClick={handleTogglePlay}
          disabled={currentStep >= 11}
          className={`flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-medium transition-colors ${
            playing
              ? 'bg-yellow-500/10 text-yellow-400 hover:bg-yellow-500/20 ring-1 ring-yellow-500/25'
              : 'bg-cyan-600 text-white hover:bg-cyan-500'
          }`}
        >
          {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
          {playing ? 'Pause' : 'Play'}
        </button>
        <button
          onClick={handleNext}
          disabled={currentStep >= 11}
          className="flex items-center gap-2 px-4 py-2 bg-zinc-900 hover:bg-zinc-800 disabled:opacity-40 disabled:cursor-not-allowed text-zinc-300 rounded-lg text-sm font-medium transition-colors ring-1 ring-zinc-800"
        >
          Next <SkipForward className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
