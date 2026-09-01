import { Routes, Route } from 'react-router-dom'
import { StoreProvider } from './hooks/useStore'
import Layout from './components/Layout'
import Dashboard from './pages/Dashboard'
import AlertCenter from './pages/AlertCenter'
import RazorpayCenter from './pages/RazorpayCenter'
import Transactions from './pages/Transactions'
import TransactionInvestigation from './pages/TransactionInvestigation'
import Customers from './pages/Customers'
import Chargebacks from './pages/Chargebacks'
import Returns from './pages/Returns'
import PolicySimulator from './pages/PolicySimulator'
import ModelPerformance from './pages/ModelPerformance'
import ModelHealth from './pages/ModelHealth'


export default function App() {
  return (
    <StoreProvider>
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
    </StoreProvider>
  )
}
