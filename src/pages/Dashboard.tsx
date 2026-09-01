import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import { Activity, IndianRupee, AlertTriangle, Bell } from 'lucide-react';
import { useStore } from '../hooks/useStore';
import StatCard from '../components/StatCard';
import ActionBadge from '../components/ActionBadge';
import { formatCurrency, formatNumber, timeAgo } from '../utils/format';

const PIE_COLORS = ['#10b981', '#f59e0b', '#3b82f6', '#8b5cf6', '#ef4444'];
const PAYMENT_LABELS: Record<string, string> = {
  card: 'Card',
  upi: 'UPI',
  netbanking: 'Net Banking',
  wallet: 'Wallet',
  emi: 'EMI',
};

const riskBuckets = [
  { name: '0-20', min: 0, max: 20 },
  { name: '21-40', min: 21, max: 40 },
  { name: '41-60', min: 41, max: 60 },
  { name: '61-80', min: 61, max: 80 },
  { name: '81-100', min: 81, max: 100 },
];

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

export default function Dashboard() {
  const { transactions, alerts, dailyStats } = useStore();

  const totalCount = transactions.length;
  const totalVolume = useMemo(() => transactions.reduce((s, t) => s + t.amount, 0), [transactions]);
  const highRiskCount = useMemo(() => transactions.filter((t) => t.riskScore >= 60).length, [transactions]);
  const activeAlertCount = useMemo(() => alerts.filter((a) => a.status === 'active').length, [alerts]);

  const last30Days = useMemo(() => dailyStats.slice(-30), [dailyStats]);

  const riskDistData = useMemo(() => {
    return riskBuckets.map((b) => ({
      name: b.name,
      count: transactions.filter((t) => t.riskScore >= b.min && t.riskScore <= b.max).length,
    }));
  }, [transactions]);

  const paymentDistData = useMemo(() => {
    const map: Record<string, number> = { card: 0, upi: 0, netbanking: 0, wallet: 0, emi: 0 };
    transactions.forEach((t) => { map[t.paymentMethod]++; });
    return Object.entries(map).map(([key, value]) => ({ name: PAYMENT_LABELS[key], value }));
  }, [transactions]);

  const avgRiskTrend = useMemo(() => {
    return last30Days.map((d) => ({
      date: new Date(d.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }),
      avgRisk: Number(d.avgRiskScore.toFixed(1)),
    }));
  }, [last30Days]);

  const highRiskTxns = useMemo(
    () => [...transactions].sort((a, b) => b.riskScore - a.riskScore).slice(0, 10),
    [transactions]
  );

  return (
    <div className="min-h-screen bg-zinc-950 p-6 space-y-6">
      <h1 className="text-2xl font-bold text-white tracking-tight">Dashboard</h1>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Transactions"
          value={formatNumber(totalCount)}
          icon={<Activity className="w-5 h-5" />}
          color="blue"
        />
        <StatCard
          title="Total Volume"
          value={formatCurrency(totalVolume)}
          icon={<IndianRupee className="w-5 h-5" />}
          color="green"
        />
        <StatCard
          title="High Risk"
          value={formatNumber(highRiskCount)}
          subtitle="Risk score >= 60"
          icon={<AlertTriangle className="w-5 h-5" />}
          color="amber"
        />
        <StatCard
          title="Active Alerts"
          value={formatNumber(activeAlertCount)}
          icon={<Bell className="w-5 h-5" />}
          color="red"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl p-6 shadow-lg">
          <h2 className="text-sm font-semibold text-zinc-300 mb-4">Daily Transaction Volume</h2>
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={last30Days}>
              <defs>
                <linearGradient id="volumeGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
              <XAxis
                dataKey="date"
                tick={{ fill: '#71717a', fontSize: 11 }}
                tickFormatter={(v: string) => new Date(v).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                stroke="rgba(255,255,255,0.1)"
              />
              <YAxis tick={{ fill: '#71717a', fontSize: 11 }} stroke="rgba(255,255,255,0.1)" />
              <Tooltip
                {...chartTooltipStyle}
                labelFormatter={(v) => new Date(String(v)).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                formatter={(value) => [formatNumber(Number(value)), 'Volume']}
              />
              <Area type="monotone" dataKey="totalVolume" stroke="#3b82f6" fill="url(#volumeGrad)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl p-6 shadow-lg">
          <h2 className="text-sm font-semibold text-zinc-300 mb-4">Risk Score Distribution</h2>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={riskDistData}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
              <XAxis dataKey="name" tick={{ fill: '#71717a', fontSize: 11 }} stroke="rgba(255,255,255,0.1)" />
              <YAxis tick={{ fill: '#71717a', fontSize: 11 }} stroke="rgba(255,255,255,0.1)" />
              <Tooltip {...chartTooltipStyle} formatter={(value) => [formatNumber(Number(value)), 'Count']} />
              <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                {riskDistData.map((_, i) => (
                  <Cell key={i} fill={i < 3 ? '#10b981' : i === 3 ? '#f59e0b' : '#ef4444'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl p-6 shadow-lg">
          <h2 className="text-sm font-semibold text-zinc-300 mb-4">Payment Method Distribution</h2>
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <Pie
                data={paymentDistData}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={100}
                paddingAngle={4}
                dataKey="value"
              >
                {paymentDistData.map((_, i) => (
                  <Cell key={i} fill={PIE_COLORS[i]} />
                ))}
              </Pie>
              <Tooltip {...chartTooltipStyle} formatter={(value) => [formatNumber(Number(value)), 'Transactions']} />
              <Legend
                wrapperStyle={{ color: '#a1a1aa', fontSize: '12px' }}
                formatter={(value: string) => <span style={{ color: '#a1a1aa' }}>{value}</span>}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl p-6 shadow-lg">
          <h2 className="text-sm font-semibold text-zinc-300 mb-4">Average Daily Risk Score</h2>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={avgRiskTrend}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
              <XAxis
                dataKey="date"
                tick={{ fill: '#71717a', fontSize: 11 }}
                stroke="rgba(255,255,255,0.1)"
              />
              <YAxis tick={{ fill: '#71717a', fontSize: 11 }} stroke="rgba(255,255,255,0.1)" domain={[0, 100]} />
              <Tooltip
                {...chartTooltipStyle}
                formatter={(value) => [`${Number(value)}/100`, 'Avg Risk Score']}
              />
              <Line
                type="monotone"
                dataKey="avgRisk"
                stroke="#f59e0b"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4, fill: '#f59e0b' }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl p-6 shadow-lg">
        <h2 className="text-sm font-semibold text-zinc-300 mb-4">Recent High-Risk Transactions</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10">
                <th className="text-left py-3 px-4 text-zinc-400 font-medium">ID</th>
                <th className="text-right py-3 px-4 text-zinc-400 font-medium">Amount</th>
                <th className="text-left py-3 px-4 text-zinc-400 font-medium">Customer</th>
                <th className="text-center py-3 px-4 text-zinc-400 font-medium">Risk Score</th>
                <th className="text-center py-3 px-4 text-zinc-400 font-medium">Action</th>
                <th className="text-right py-3 px-4 text-zinc-400 font-medium">Time</th>
              </tr>
            </thead>
            <tbody>
              {highRiskTxns.map((txn) => (
                <tr
                  key={txn.id}
                  className="border-b border-white/5 hover:bg-white/5 transition-colors cursor-pointer"
                >
                  <td className="py-3 px-4">
                    <Link to={`/investigation/${txn.id}`} className="text-blue-400 hover:text-blue-300 font-mono text-xs">
                      {txn.id}
                    </Link>
                  </td>
                  <td className="py-3 px-4 text-right text-white font-medium">{formatCurrency(txn.amount)}</td>
                  <td className="py-3 px-4 text-zinc-300">{txn.customerEmail}</td>
                  <td className="py-3 px-4 text-center">
                    <span className={`inline-flex items-center gap-1 text-sm font-semibold ${
                      txn.riskScore >= 80 ? 'text-red-400' : txn.riskScore >= 60 ? 'text-orange-400' : 'text-yellow-400'
                    }`}>
                      {txn.riskScore}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-center">
                    <ActionBadge action={txn.recommendedAction} />
                  </td>
                  <td className="py-3 px-4 text-right text-zinc-500 text-xs">{timeAgo(txn.createdAt)}</td>
                </tr>
              ))}
              {highRiskTxns.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-zinc-500">No high-risk transactions found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
