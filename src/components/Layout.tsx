import { useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import {
  LayoutDashboard,
  Bell,
  CreditCard,
  ListOrdered,
  Users,
  AlertTriangle,
  RotateCcw,
  Sliders,
  BarChart3,
  Activity,
  Play,
  Brain,
  Menu,
  X,
} from 'lucide-react';
import { useStore } from '../hooks/useStore';

const navItems = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/alerts', label: 'Alert Center', icon: Bell, badge: true },
  { to: '/razorpay', label: 'Razorpay Center', icon: CreditCard },
  { to: '/transactions', label: 'Transactions', icon: ListOrdered },
  { to: '/customers', label: 'Customers', icon: Users },
  { to: '/chargebacks', label: 'Chargebacks', icon: AlertTriangle },
  { to: '/returns', label: 'Returns', icon: RotateCcw },
  { to: '/policy-simulator', label: 'Policy Simulator', icon: Sliders },
  { to: '/model-performance', label: 'Model Performance', icon: BarChart3 },
  { to: '/model-health', label: 'Model Health', icon: Activity },
  { to: '/demo', label: 'Demo Mode', icon: Play },
  { to: '/limitations', label: 'AI Limitations', icon: Brain },
];

export default function Layout() {
  const { alerts } = useStore();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const activeAlertCount = alerts.filter((a) => a.status === 'active').length;

  const linkClass = ({ isActive }: { isActive: boolean }) =>
    `flex items-center gap-3 px-4 py-2.5 text-sm font-medium rounded-lg transition-colors ${
      isActive
        ? 'bg-blue-600/20 text-blue-400'
        : 'text-gray-400 hover:bg-gray-700/50 hover:text-gray-200'
    }`;

  return (
    <div className="flex h-screen bg-gray-950 text-gray-100">
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-40 w-64 flex flex-col bg-gray-900 border-r border-gray-800 transition-transform duration-200 lg:translate-x-0 lg:static lg:z-auto ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between px-5 py-5 border-b border-gray-800">
          <span className="text-lg font-bold tracking-tight">🛡️ MerchantShield AI</span>
          <button className="lg:hidden text-gray-400 hover:text-gray-200" onClick={() => setSidebarOpen(false)}>
            <X size={20} />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
          {navItems.map(({ to, label, icon: Icon, badge }) => (
            <NavLink
              key={to}
              to={to}
              className={linkClass}
              onClick={() => setSidebarOpen(false)}
            >
              <Icon size={18} />
              <span className="flex-1">{label}</span>
              {badge && activeAlertCount > 0 && (
                <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1.5 text-[11px] font-bold text-white">
                  {activeAlertCount}
                </span>
              )}
            </NavLink>
          ))}
        </nav>

        <div className="px-5 py-4 border-t border-gray-800 text-xs text-gray-500">
          MerchantShield AI v1.0
        </div>
      </aside>

      <div className="flex flex-col flex-1 min-w-0">
        <header className="flex items-center gap-3 px-4 py-3 border-b border-gray-800 bg-gray-900/50 lg:hidden">
          <button className="text-gray-400 hover:text-gray-200" onClick={() => setSidebarOpen(true)}>
            <Menu size={22} />
          </button>
          <span className="text-sm font-semibold">MerchantShield AI</span>
        </header>

        <main className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
