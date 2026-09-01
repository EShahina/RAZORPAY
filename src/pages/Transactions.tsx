import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../hooks/useStore';
import { formatCurrency, timeAgo } from '../utils/format';
import RiskBadge from '../components/RiskBadge';
import ActionBadge from '../components/ActionBadge';
import type { RiskLevel, PaymentMethod, TransactionStatus } from '../types';
import {
  Search,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  ChevronRight,
  CreditCard,
  Smartphone,
  Building2,
  Wallet,
  Calendar,
} from 'lucide-react';

type SortField = 'amount' | 'riskScore' | 'createdAt';
type SortDir = 'asc' | 'desc';

const PAYMENT_ICONS: Record<PaymentMethod, typeof CreditCard> = {
  card: CreditCard,
  upi: Smartphone,
  netbanking: Building2,
  wallet: Wallet,
  emi: Calendar,
};

export default function Transactions() {
  const { transactions } = useStore();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [riskFilter, setRiskFilter] = useState<RiskLevel | 'all'>('all');
  const [methodFilter, setMethodFilter] = useState<PaymentMethod | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<TransactionStatus | 'all'>('all');
  const [sortField, setSortField] = useState<SortField>('createdAt');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  const filtered = useMemo(() => {
    let result = [...transactions];

    if (search) {
      const q = search.toLowerCase();
      result = result.filter(
        (t) =>
          t.id.toLowerCase().includes(q) ||
          t.customerEmail.toLowerCase().includes(q) ||
          t.orderId.toLowerCase().includes(q)
      );
    }

    if (riskFilter !== 'all') {
      result = result.filter((t) => t.riskLevel === riskFilter);
    }

    if (methodFilter !== 'all') {
      result = result.filter((t) => t.paymentMethod === methodFilter);
    }

    if (statusFilter !== 'all') {
      result = result.filter((t) => t.status === statusFilter);
    }

    result.sort((a, b) => {
      const mul = sortDir === 'asc' ? 1 : -1;
      if (sortField === 'amount') return (a.amount - b.amount) * mul;
      if (sortField === 'riskScore') return (a.riskScore - b.riskScore) * mul;
      return (new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()) * mul;
    });

    return result;
  }, [transactions, search, riskFilter, methodFilter, statusFilter, sortField, sortDir]);

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir('desc');
    }
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ArrowUpDown className="h-3 w-3 text-zinc-600" />;
    return sortDir === 'asc' ? (
      <ArrowUp className="h-3 w-3 text-purple-400" />
    ) : (
      <ArrowDown className="h-3 w-3 text-purple-400" />
    );
  };

  return (
    <div className="min-h-screen bg-zinc-950 p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Transactions</h1>
        <p className="text-sm text-zinc-400 mt-1">{filtered.length} transactions found</p>
      </div>

      <div className="space-y-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
          <input
            type="text"
            placeholder="Search by ID, email, or order ID..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-zinc-900 border border-zinc-800 rounded-xl text-sm text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500/50"
          />
        </div>

        <div className="flex gap-3">
          <select
            value={riskFilter}
            onChange={(e) => setRiskFilter(e.target.value as RiskLevel | 'all')}
            className="px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-purple-500/50"
          >
            <option value="all">All Risk Levels</option>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
            <option value="critical">Critical</option>
          </select>

          <select
            value={methodFilter}
            onChange={(e) => setMethodFilter(e.target.value as PaymentMethod | 'all')}
            className="px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-purple-500/50"
          >
            <option value="all">All Payment Methods</option>
            <option value="card">Card</option>
            <option value="upi">UPI</option>
            <option value="netbanking">Net Banking</option>
            <option value="wallet">Wallet</option>
            <option value="emi">EMI</option>
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as TransactionStatus | 'all')}
            className="px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-purple-500/50"
          >
            <option value="all">All Statuses</option>
            <option value="pending">Pending</option>
            <option value="completed">Completed</option>
            <option value="failed">Failed</option>
            <option value="refunded">Refunded</option>
            <option value="chargeback">Chargeback</option>
          </select>
        </div>
      </div>

      <div className="bg-zinc-900 rounded-xl ring-1 ring-zinc-800 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-zinc-800">
                <th className="text-left px-4 py-3 text-xs font-medium text-zinc-400">Order ID</th>
                <th className="text-left px-4 py-3">
                  <button onClick={() => toggleSort('amount')} className="flex items-center gap-1 text-xs font-medium text-zinc-400 hover:text-white transition-colors">
                    Amount <SortIcon field="amount" />
                  </button>
                </th>
                <th className="text-left px-4 py-3 text-xs font-medium text-zinc-400">Customer</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-zinc-400">Method</th>
                <th className="text-left px-4 py-3">
                  <button onClick={() => toggleSort('riskScore')} className="flex items-center gap-1 text-xs font-medium text-zinc-400 hover:text-white transition-colors">
                    Risk Score <SortIcon field="riskScore" />
                  </button>
                </th>
                <th className="text-left px-4 py-3 text-xs font-medium text-zinc-400">Status</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-zinc-400">Action</th>
                <th className="text-left px-4 py-3">
                  <button onClick={() => toggleSort('createdAt')} className="flex items-center gap-1 text-xs font-medium text-zinc-400 hover:text-white transition-colors">
                    Time <SortIcon field="createdAt" />
                  </button>
                </th>
                <th className="w-8 px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/50">
              {filtered.map((txn) => {
                const MethodIcon = PAYMENT_ICONS[txn.paymentMethod];
                return (
                  <tr
                    key={txn.id}
                    onClick={() => navigate(`/investigation/${txn.id}`)}
                    className="hover:bg-zinc-800/40 cursor-pointer transition-colors"
                  >
                    <td className="px-4 py-3">
                      <span className="text-xs font-mono text-zinc-300">{txn.orderId}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm font-medium text-white">{formatCurrency(txn.amount)}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs text-zinc-300 truncate max-w-[160px] block">{txn.customerEmail}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        <MethodIcon className="h-3.5 w-3.5 text-zinc-400" />
                        <span className="text-xs text-zinc-300 capitalize">{txn.paymentMethod}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <RiskBadge level={txn.riskLevel} />
                        <span className="text-xs text-zinc-500">{txn.riskScore}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
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
                    </td>
                    <td className="px-4 py-3">
                      <ActionBadge action={txn.recommendedAction} />
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs text-zinc-500">{timeAgo(txn.createdAt)}</span>
                    </td>
                    <td className="px-4 py-3">
                      <ChevronRight className="h-4 w-4 text-zinc-600" />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {filtered.length === 0 && (
          <div className="p-12 text-center text-zinc-500 text-sm">
            No transactions match your filters
          </div>
        )}
      </div>
    </div>
  );
}
