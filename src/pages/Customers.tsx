import { useState, useMemo } from 'react';
import { Search, Users, Shield, AlertTriangle, ChevronDown, ChevronRight, Mail, Phone, Calendar, IndianRupee, CreditCard, RotateCcw, X } from 'lucide-react';
import { useStore } from '../hooks/useStore';
import RiskBadge from '../components/RiskBadge';
import StatCard from '../components/StatCard';
import { formatCurrency, formatNumber, timeAgo } from '../utils/format';
import type { Customer, Transaction, RiskLevel } from '../types';

export default function Customers() {
  const { customers, transactions } = useStore();
  const [search, setSearch] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return customers;
    return customers.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.email.toLowerCase().includes(q) ||
        c.phone.includes(q)
    );
  }, [customers, search]);

  const totalCustomers = customers.length;
  const avgRisk = customers.length > 0 ? Math.round(customers.reduce((s, c) => s + c.avgRiskScore, 0) / customers.length) : 0;
  const highRiskCount = customers.filter((c) => c.riskLevel === 'high' || c.riskLevel === 'critical').length;

  const getCustomerTransactions = (email: string): Transaction[] => {
    return transactions.filter((t) => t.customerEmail === email);
  };

  const getRiskProfile = (customer: Customer) => {
    const factors = [];
    if (customer.chargebackCount > 0) factors.push({ label: 'Chargebacks', value: customer.chargebackCount, desc: `${customer.chargebackCount} chargeback(s) filed` });
    if (customer.refundCount > 0) factors.push({ label: 'Refunds', value: customer.refundCount, desc: `${customer.refundCount} refund(s) requested` });
    if (customer.accountAge < 30) factors.push({ label: 'New Account', value: customer.accountAge, desc: `Account is only ${customer.accountAge} days old` });
    if (customer.totalTransactions > 20) factors.push({ label: 'High Volume', value: customer.totalTransactions, desc: `${customer.totalTransactions} transactions` });
    if (customer.avgRiskScore > 70) factors.push({ label: 'High Risk Score', value: customer.avgRiskScore, desc: `Average risk score of ${customer.avgRiskScore}/100` });
    if (factors.length === 0) factors.push({ label: 'Low Risk Profile', value: 0, desc: 'No significant risk indicators' });
    return factors;
  };

  const riskLevelColor = (level: RiskLevel) => {
    const map: Record<RiskLevel, string> = { low: 'text-emerald-400', medium: 'text-yellow-400', high: 'text-orange-400', critical: 'text-red-400' };
    return map[level];
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Customer Management</h1>
        <p className="text-sm text-zinc-400 mt-1">Monitor customer risk profiles and transaction history</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard title="Total Customers" value={formatNumber(totalCustomers)} icon={<Users size={22} />} color="blue" />
        <StatCard title="Average Risk Score" value={`${avgRisk}/100`} icon={<Shield size={22} />} color={avgRisk > 50 ? 'red' : 'green'} />
        <StatCard title="High Risk Customers" value={formatNumber(highRiskCount)} icon={<AlertTriangle size={22} />} color={highRiskCount > 0 ? 'red' : 'green'} subtitle={`${totalCustomers > 0 ? ((highRiskCount / totalCustomers) * 100).toFixed(1) : 0}% of total`} />
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" size={18} />
        <input
          type="text"
          placeholder="Search by name, email, or phone..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-3 rounded-xl border border-white/10 bg-white/5 text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 backdrop-blur-xl"
        />
        {search && (
          <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300">
            <X size={16} />
          </button>
        )}
      </div>

      <div className="space-y-2">
        {filtered.length === 0 && (
          <div className="text-center py-12 text-zinc-500 rounded-xl border border-white/10 bg-white/5 backdrop-blur-xl">
            No customers match your search.
          </div>
        )}
        {filtered.map((customer) => (
          <div key={customer.id} className="rounded-xl border border-white/10 bg-white/5 backdrop-blur-xl overflow-hidden">
            <button
              onClick={() => setExpandedId(expandedId === customer.id ? null : customer.id)}
              className="w-full flex items-center gap-4 px-4 py-3 text-left hover:bg-white/5 transition-colors"
            >
              <span className="text-zinc-500">
                {expandedId === customer.id ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
              </span>
              <div className="flex-1 grid grid-cols-2 md:grid-cols-4 lg:grid-cols-9 gap-2 items-center text-sm">
                <span className="text-white font-medium truncate">{customer.name}</span>
                <span className="text-zinc-400 truncate hidden md:block">{customer.email}</span>
                <span className="text-zinc-400 hidden lg:block">{customer.phone}</span>
                <span className="text-zinc-400 hidden lg:block">{customer.accountAge}d</span>
                <span className="text-zinc-300 hidden lg:block">{formatNumber(customer.totalTransactions)}</span>
                <span className="text-zinc-300 hidden lg:block">{formatCurrency(customer.totalSpent)}</span>
                <span className="text-zinc-300 hidden lg:block">{customer.chargebackCount}</span>
                <span className="text-zinc-300 hidden lg:block">{customer.refundCount}</span>
                <div className="flex items-center gap-2">
                  <RiskBadge level={customer.riskLevel} />
                </div>
              </div>
            </button>

            {expandedId === customer.id && (
              <div className="border-t border-white/10 px-4 py-4 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-3">
                    <h3 className="text-sm font-semibold text-white uppercase tracking-wider">Customer Details</h3>
                    <div className="rounded-lg bg-white/5 p-4 space-y-2">
                      <div className="flex items-center gap-2 text-sm"><Mail size={14} className="text-zinc-500" /><span className="text-zinc-300">{customer.email}</span></div>
                      <div className="flex items-center gap-2 text-sm"><Phone size={14} className="text-zinc-500" /><span className="text-zinc-300">{customer.phone}</span></div>
                      <div className="flex items-center gap-2 text-sm"><Calendar size={14} className="text-zinc-500" /><span className="text-zinc-300">{customer.accountAge} days old</span></div>
                      <div className="flex items-center gap-2 text-sm"><IndianRupee size={14} className="text-zinc-500" /><span className="text-zinc-300">{formatCurrency(customer.totalSpent)} total spent</span></div>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <h3 className="text-sm font-semibold text-white uppercase tracking-wider">Risk Profile</h3>
                    <div className="rounded-lg bg-white/5 p-4 space-y-2">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm text-zinc-400">Risk Level</span>
                        <RiskBadge level={customer.riskLevel} />
                      </div>
                      {getRiskProfile(customer).map((factor, i) => (
                        <div key={i} className="flex items-start gap-2 text-sm">
                          <span className={`font-medium ${riskLevelColor(customer.riskLevel)}`}>-</span>
                          <div>
                            <span className="text-zinc-300">{factor.label}</span>
                            <span className="text-zinc-500 ml-1">- {factor.desc}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <h3 className="text-sm font-semibold text-white uppercase tracking-wider">Recent Transactions</h3>
                  <div className="rounded-lg bg-white/5 overflow-hidden max-h-64 overflow-y-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-white/10">
                          <th className="px-3 py-2 text-left text-xs font-semibold text-zinc-400 uppercase">ID</th>
                          <th className="px-3 py-2 text-left text-xs font-semibold text-zinc-400 uppercase">Amount</th>
                          <th className="px-3 py-2 text-left text-xs font-semibold text-zinc-400 uppercase">Status</th>
                          <th className="px-3 py-2 text-left text-xs font-semibold text-zinc-400 uppercase">Risk</th>
                          <th className="px-3 py-2 text-left text-xs font-semibold text-zinc-400 uppercase">Time</th>
                        </tr>
                      </thead>
                      <tbody>
                        {getCustomerTransactions(customer.email).slice(0, 10).map((txn) => (
                          <tr key={txn.id} className="border-b border-white/5">
                            <td className="px-3 py-2 text-zinc-300 font-mono text-xs">{txn.id}</td>
                            <td className="px-3 py-2 text-zinc-300">{formatCurrency(txn.amount)}</td>
                            <td className="px-3 py-2">
                              <span className={`text-xs font-medium ${txn.status === 'completed' ? 'text-emerald-400' : txn.status === 'chargeback' ? 'text-red-400' : txn.status === 'refunded' ? 'text-yellow-400' : 'text-zinc-400'}`}>
                                {txn.status}
                              </span>
                            </td>
                            <td className="px-3 py-2"><RiskBadge level={txn.riskLevel} /></td>
                            <td className="px-3 py-2 text-zinc-500 text-xs">{timeAgo(txn.createdAt)}</td>
                          </tr>
                        ))}
                        {getCustomerTransactions(customer.email).length === 0 && (
                          <tr><td colSpan={5} className="px-3 py-6 text-center text-zinc-500">No transactions found</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {(customer.chargebackCount > 0 || customer.refundCount > 0) && (
                  <div className="space-y-3">
                    <h3 className="text-sm font-semibold text-white uppercase tracking-wider">Chargeback & Refund History</h3>
                    <div className="rounded-lg bg-white/5 p-4 flex gap-6">
                      <div className="flex items-center gap-2">
                        <CreditCard size={16} className="text-red-400" />
                        <span className="text-sm text-zinc-300">{customer.chargebackCount} chargeback{customer.chargebackCount !== 1 ? 's' : ''}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <RotateCcw size={16} className="text-yellow-400" />
                        <span className="text-sm text-zinc-300">{customer.refundCount} refund{customer.refundCount !== 1 ? 's' : ''}</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
