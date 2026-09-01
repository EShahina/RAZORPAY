import { useState, useMemo, useEffect } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  LineChart,
  Line,
} from 'recharts';
import {
  Activity,
  Brain,
  Calendar,
  Database,
  Layers,
  ShieldCheck,
  AlertTriangle,
} from 'lucide-react';
import type { ModelDrift } from '../types';
import { fetchModelHealth } from '../api/client';

const MODEL_INFO = {
  name: 'MerchantShield Risk Model v2.1',
  type: 'Gradient-boosted ensemble',
  lastTrained: '2026-08-15',
  trainingSamples: '50,000 transactions',
  features: 7,
  status: 'Healthy',
};

const driftData: ModelDrift[] = [
  { featureName: 'Amount Deviation', baselineMean: 0.32, currentMean: 0.34, driftPercent: 6.25, isDrifting: false },
  { featureName: 'Account Age', baselineMean: 142, currentMean: 138, driftPercent: 2.82, isDrifting: false },
  { featureName: 'Attempt Count', baselineMean: 1.8, currentMean: 1.9, driftPercent: 5.56, isDrifting: false },
  { featureName: 'Velocity', baselineMean: 3.2, currentMean: 3.6, driftPercent: 12.5, isDrifting: true },
  { featureName: 'Chargeback History', baselineMean: 0.04, currentMean: 0.042, driftPercent: 5.0, isDrifting: false },
  { featureName: 'Refund History', baselineMean: 0.12, currentMean: 0.125, driftPercent: 4.17, isDrifting: false },
  { featureName: 'IP Risk', baselineMean: 0.18, currentMean: 0.175, driftPercent: 2.78, isDrifting: false },
];

const healthTimeline = Array.from({ length: 30 }, (_, i) => {
  const day = new Date();
  day.setDate(day.getDate() - (29 - i));
  const base = 94;
  const dip = i >= 18 && i <= 21 ? -4 - Math.random() * 2 : 0;
  const jitter = (Math.random() - 0.5) * 2;
  return {
    date: day.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }),
    score: Math.round((base + jitter + dip) * 10) / 10,
  };
});

function driftColor(pct: number): string {
  if (pct > 15) return 'text-red-400';
  if (pct >= 5) return 'text-yellow-400';
  return 'text-emerald-400';
}

function driftBg(pct: number): string {
  if (pct > 15) return 'bg-red-500/10 ring-red-500/25';
  if (pct >= 5) return 'bg-yellow-500/10 ring-yellow-500/25';
  return 'bg-emerald-500/10 ring-emerald-500/25';
}

function driftLabel(pct: number): string {
  if (pct > 15) return 'Critical';
  if (pct >= 5) return 'Warning';
  return 'Healthy';
}

const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number }>; label?: string }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-xs">
      <p className="text-zinc-300 font-medium">{label}</p>
      <p className="text-white font-semibold">{payload[0].value.toFixed(1)}%</p>
    </div>
  );
};

export default function ModelHealth() {
  const [hoveredFeature, setHoveredFeature] = useState<string | null>(null);
  const [modelInfo, setModelInfo] = useState(MODEL_INFO);
  const [live, setLive] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void fetchModelHealth().then((health) => {
      if (!health || cancelled) return;
      setModelInfo({
        name: `MerchantShield Risk Model v${health.modelVersion}`,
        type: `Gradient-boosted ensemble · ${health.nTrees} trees`,
        lastTrained: health.trainedAt.slice(0, 10),
        trainingSamples: `${health.loadedTransactions.toLocaleString()} scored transactions`,
        features: health.nFeatures,
        status: health.status === 'healthy' ? 'Healthy' : health.status,
      });
      setLive(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const driftingFeatures = useMemo(() => driftData.filter((f) => f.driftPercent > 15), []);

  const barData = driftData.map((f) => ({
    name: f.featureName.split(' ').slice(0, 1).join(' '),
    drift: f.driftPercent,
  }));

  return (
    <div className="min-h-screen bg-zinc-950 p-6 space-y-6">
      <div className="flex items-center gap-3">
        <div className="p-2 bg-cyan-500/10 rounded-lg">
          <Activity className="h-6 w-6 text-cyan-400" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-white">Model Health</h1>
          <p className="text-sm text-zinc-400">Monitor model performance, drift, and feature stability</p>
        </div>
        <span className={`ml-auto px-3 py-1 rounded-full text-xs font-medium ring-1 ring-inset ${
          live ? 'bg-emerald-500/10 ring-emerald-500/25 text-emerald-400' : 'bg-zinc-800 ring-zinc-700 text-zinc-400'
        }`}>
          {live ? 'Live · from API' : 'Estimated · offline fallback'}
        </span>
      </div>

      {driftingFeatures.length > 0 && (
        <div className="flex items-center gap-3 bg-red-500/10 border border-red-500/25 rounded-xl px-4 py-3">
          <AlertTriangle className="h-5 w-5 text-red-400 shrink-0" />
          <p className="text-sm text-red-300">
            <span className="font-semibold">Drift Alert:</span>{' '}
            {driftingFeatures.length} feature{driftingFeatures.length > 1 ? 's' : ''} exceeding 15% threshold:{' '}
            {driftingFeatures.map((f) => f.featureName).join(', ')}. Retraining recommended.
          </p>
        </div>
      )}

      <div className="bg-zinc-900 rounded-xl ring-1 ring-zinc-800 p-6">
        <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <Brain className="h-5 w-5 text-cyan-400" /> Model Card
        </h2>
        <div className="grid grid-cols-3 gap-6">
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <span className="text-xs text-zinc-500 w-28">Name</span>
              <span className="text-sm text-white font-medium">{modelInfo.name}</span>
            </div>
            <div className="flex items-center gap-2">
              <Layers className="h-3.5 w-3.5 text-zinc-500" />
              <span className="text-xs text-zinc-500 w-28">Type</span>
              <span className="text-sm text-zinc-300">{modelInfo.type}</span>
            </div>
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-3.5 w-3.5 text-zinc-500" />
              <span className="text-xs text-zinc-500 w-28">Status</span>
              <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-emerald-500/10 ring-1 ring-inset ring-emerald-500/25 text-emerald-400">
                {modelInfo.status}
              </span>
            </div>
          </div>
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Calendar className="h-3.5 w-3.5 text-zinc-500" />
              <span className="text-xs text-zinc-500 w-28">Last Trained</span>
              <span className="text-sm text-zinc-300">{modelInfo.lastTrained}</span>
            </div>
            <div className="flex items-center gap-2">
              <Database className="h-3.5 w-3.5 text-zinc-500" />
              <span className="text-xs text-zinc-500 w-28">Training Samples</span>
              <span className="text-sm text-zinc-300">{modelInfo.trainingSamples}</span>
            </div>
          </div>
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Activity className="h-3.5 w-3.5 text-zinc-500" />
              <span className="text-xs text-zinc-500 w-28">Features</span>
              <span className="text-sm text-zinc-300">{modelInfo.features} weighted factors</span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6">
        <div className="bg-zinc-900 rounded-xl ring-1 ring-zinc-800 overflow-hidden">
          <div className="px-4 py-3 border-b border-zinc-800">
            <h2 className="text-sm font-semibold text-white">Feature Drift Detection</h2>
            <p className="text-xs text-zinc-500 mt-0.5">Baseline vs current feature distributions</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-zinc-800/50">
                  <th className="text-left text-xs font-medium text-zinc-500 px-4 py-2.5">Feature</th>
                  <th className="text-right text-xs font-medium text-zinc-500 px-4 py-2.5">Baseline Mean</th>
                  <th className="text-right text-xs font-medium text-zinc-500 px-4 py-2.5">Current Mean</th>
                  <th className="text-right text-xs font-medium text-zinc-500 px-4 py-2.5">Drift %</th>
                  <th className="text-center text-xs font-medium text-zinc-500 px-4 py-2.5">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/50">
                {driftData.map((f) => (
                  <tr
                    key={f.featureName}
                    className={`transition-colors ${hoveredFeature === f.featureName ? 'bg-zinc-800/40' : ''}`}
                    onMouseEnter={() => setHoveredFeature(f.featureName)}
                    onMouseLeave={() => setHoveredFeature(null)}
                  >
                    <td className="px-4 py-2.5 text-sm text-white font-medium">{f.featureName}</td>
                    <td className="px-4 py-2.5 text-sm text-zinc-400 text-right font-mono">{f.baselineMean.toFixed(3)}</td>
                    <td className="px-4 py-2.5 text-sm text-zinc-400 text-right font-mono">{f.currentMean.toFixed(3)}</td>
                    <td className={`px-4 py-2.5 text-sm text-right font-semibold font-mono ${driftColor(f.driftPercent)}`}>
                      {f.driftPercent.toFixed(1)}%
                    </td>
                    <td className="px-4 py-2.5 text-center">
                      <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ring-1 ring-inset ${driftBg(f.driftPercent)} ${driftColor(f.driftPercent)}`}>
                        {driftLabel(f.driftPercent)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6">
        <div className="bg-zinc-900 rounded-xl ring-1 ring-zinc-800 p-4">
          <h2 className="text-sm font-semibold text-white mb-4 px-2">Drift Visualization</h2>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={barData} margin={{ top: 10, right: 20, left: 10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
              <XAxis dataKey="name" tick={{ fill: '#a1a1aa', fontSize: 12 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#a1a1aa', fontSize: 12 }} axisLine={false} tickLine={false} unit="%" />
              <Tooltip content={<CustomTooltip />} />
              <ReferenceLine
                y={15}
                stroke="#ef4444"
                strokeDasharray="6 4"
                label={{ value: '15% Threshold', position: 'right', fill: '#ef4444', fontSize: 11 }}
              />
              <Bar dataKey="drift" radius={[4, 4, 0, 0]}>
                {barData.map((entry, index) => (
                  <rect
                    key={index}
                    fill={entry.drift > 15 ? '#ef4444' : entry.drift >= 5 ? '#eab308' : '#10b981'}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6">
        <div className="bg-zinc-900 rounded-xl ring-1 ring-zinc-800 p-4">
          <h2 className="text-sm font-semibold text-white mb-4 px-2">Health Timeline (30 Days)</h2>
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={healthTimeline} margin={{ top: 10, right: 20, left: 10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
              <XAxis
                dataKey="date"
                tick={{ fill: '#a1a1aa', fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                interval={4}
              />
              <YAxis domain={[85, 100]} tick={{ fill: '#a1a1aa', fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <ReferenceLine y={90} stroke="#eab308" strokeDasharray="4 4" label={{ value: 'Min OK', position: 'right', fill: '#eab308', fontSize: 10 }} />
              <Line type="monotone" dataKey="score" stroke="#06b6d4" strokeWidth={2} dot={false} activeDot={{ r: 4, fill: '#06b6d4' }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
