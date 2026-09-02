import { lazy, Suspense } from 'react';
import { Routes, Route } from 'react-router-dom';
import { StoreProvider } from './hooks/useStore';
import Layout from './components/Layout';

// Route-level code splitting: each page is loaded on demand, which keeps the
// initial bundle small (recharts and other heavy view deps load per-route).
const Dashboard = lazy(() => import('./pages/Dashboard'));
const AlertCenter = lazy(() => import('./pages/AlertCenter'));
const RazorpayCenter = lazy(() => import('./pages/RazorpayCenter'));
const Transactions = lazy(() => import('./pages/Transactions'));
const TransactionInvestigation = lazy(() => import('./pages/TransactionInvestigation'));
const Customers = lazy(() => import('./pages/Customers'));
const Chargebacks = lazy(() => import('./pages/Chargebacks'));
const Returns = lazy(() => import('./pages/Returns'));
const PolicySimulator = lazy(() => import('./pages/PolicySimulator'));
const ModelPerformance = lazy(() => import('./pages/ModelPerformance'));
const ModelHealth = lazy(() => import('./pages/ModelHealth'));

function PageFallback() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-950">
      <div className="h-8 w-8 rounded-full border-2 border-zinc-700 border-t-purple-500 animate-spin" />
    </div>
  );
}

export default function App() {
  return (
    <StoreProvider>
      <Suspense fallback={<PageFallback />}>
        <Routes>
          <Route element={<Layout />}>
            <Route path="/" element={<Dashboard />} />
            <Route path="/alerts" element={<AlertCenter />} />
            <Route path="/razorpay" element={<RazorpayCenter />} />
            <Route path="/transactions" element={<Transactions />} />
            <Route path="/investigation/:id" element={<TransactionInvestigation />} />
            <Route path="/customers" element={<Customers />} />
            <Route path="/chargebacks" element={<Chargebacks />} />
            <Route path="/returns" element={<Returns />} />
            <Route path="/policy-simulator" element={<PolicySimulator />} />
            <Route path="/model-performance" element={<ModelPerformance />} />
            <Route path="/model-health" element={<ModelHealth />} />
          </Route>
        </Routes>
      </Suspense>
    </StoreProvider>
  );
}
