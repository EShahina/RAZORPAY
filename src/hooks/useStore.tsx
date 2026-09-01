import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react';
import type {
  Transaction,
  Customer,
  Alert,
  Chargeback,
  Return,
  WebhookEvent,
  DailyStats,
  DemoScenario,
  RiskAction,
  FeedbackLabel,
} from '../types';
import {
  seedTransactions,
  seedCustomers,
  seedAlerts,
  seedChargebacks,
  seedReturns,
  seedWebhookEvents,
  seedDailyStats,
  seedDemoScenarios,
} from '../data/seedData';
import { fetchTransactions, recordDecision as apiRecordDecision, recordFeedback as apiRecordFeedback } from '../api/client';

interface StoreState {
  transactions: Transaction[];
  customers: Customer[];
  alerts: Alert[];
  chargebacks: Chargeback[];
  returns: Return[];
  webhookEvents: WebhookEvent[];
  dailyStats: DailyStats[];
  demoScenarios: DemoScenario[];
  demoMode: boolean;
  demoStep: number;
  selectedTransaction: Transaction | null;
  selectedAlert: Alert | null;
  loading: boolean;
  dataSource: 'backend' | 'seed';
}

interface StoreActions {
  setTransactions: (txns: Transaction[]) => void;
  setCustomers: (customers: Customer[]) => void;
  setAlerts: (alerts: Alert[]) => void;
  setChargebacks: (chargebacks: Chargeback[]) => void;
  setReturns: (returns: Return[]) => void;
  setWebhookEvents: (events: WebhookEvent[]) => void;
  setDailyStats: (stats: DailyStats[]) => void;
  setDemoScenarios: (scenarios: DemoScenario[]) => void;
  setDemoMode: (mode: boolean) => void;
  setDemoStep: (step: number) => void;
  acknowledgeAlert: (id: string) => void;
  resolveAlert: (id: string) => void;
  recordMerchantDecision: (txnId: string, decision: RiskAction, notes?: string) => void;
  recordFeedback: (txnId: string, label: FeedbackLabel) => void;
  addWebhookEvent: (event: WebhookEvent) => void;
  startDemo: () => void;
  nextDemoStep: () => void;
  resetDemo: () => void;
  selectTransaction: (txn: Transaction | null) => void;
  selectAlert: (alert: Alert | null) => void;
}

type StoreContextValue = StoreState & StoreActions;

const StoreContext = createContext<StoreContextValue | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [transactions, setTransactions] = useState<Transaction[]>(seedTransactions);
  const [customers, setCustomers] = useState<Customer[]>(seedCustomers);
  const [alerts, setAlerts] = useState<Alert[]>(seedAlerts);
  const [chargebacks, setChargebacks] = useState<Chargeback[]>(seedChargebacks);
  const [returns, setReturns] = useState<Return[]>(seedReturns);
  const [webhookEvents, setWebhookEvents] = useState<WebhookEvent[]>(seedWebhookEvents);
  const [dailyStats, setDailyStats] = useState<DailyStats[]>(seedDailyStats);
  const [demoScenarios, setDemoScenarios] = useState<DemoScenario[]>(seedDemoScenarios);
  const [demoMode, setDemoMode] = useState(false);
  const [demoStep, setDemoStep] = useState(0);
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
  const [selectedAlert, setSelectedAlert] = useState<Alert | null>(null);
  const [loading, setLoading] = useState(true);
  const [dataSource, setDataSource] = useState<'backend' | 'seed'>('seed');

  // Load the transaction feed from the backend on mount. Falls back to the
  // bundled seed corpus when the server is offline so the UI still renders.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await fetchTransactions(500);
      if (cancelled) return;
      if (res.data.length > 0) {
        setTransactions(res.data);
        setDataSource('backend');
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const acknowledgeAlert = useCallback((id: string) => {
    setAlerts((prev) =>
      prev.map((a) =>
        a.id === id ? { ...a, status: 'acknowledged' as const, acknowledgedAt: new Date().toISOString() } : a
      )
    );
  }, []);

  const resolveAlert = useCallback((id: string) => {
    setAlerts((prev) =>
      prev.map((a) =>
        a.id === id ? { ...a, status: 'resolved' as const, resolvedAt: new Date().toISOString() } : a
      )
    );
  }, []);

  const recordMerchantDecision = useCallback((txnId: string, decision: RiskAction, notes?: string) => {
    // Persist to the backend (best-effort), then update local state immediately.
    void apiRecordDecision(txnId, decision, notes);
    setTransactions((prev) =>
      prev.map((t) =>
        t.id === txnId
          ? { ...t, merchantDecision: decision, ...(notes ? { investigationNotes: notes } : {}) }
          : t
      )
    );
  }, []);

  const recordFeedback = useCallback((txnId: string, label: FeedbackLabel) => {
    void apiRecordFeedback(txnId, label);
    setTransactions((prev) =>
      prev.map((t) => (t.id === txnId ? { ...t, feedbackLabel: label } : t))
    );
  }, []);

  const addWebhookEvent = useCallback((event: WebhookEvent) => {
    setWebhookEvents((prev) => [event, ...prev]);
  }, []);

  const startDemo = useCallback(() => {
    setDemoMode(true);
    setDemoStep(0);
  }, []);

  const nextDemoStep = useCallback(() => {
    setDemoStep((prev) => prev + 1);
  }, []);

  const resetDemo = useCallback(() => {
    setDemoMode(false);
    setDemoStep(0);
    setTransactions(seedTransactions);
    setAlerts(seedAlerts);
    setDataSource('seed');
    setSelectedTransaction(null);
    setSelectedAlert(null);
  }, []);

  const selectTransaction = useCallback((txn: Transaction | null) => {
    setSelectedTransaction(txn);
  }, []);

  const selectAlert = useCallback((alert: Alert | null) => {
    setSelectedAlert(alert);
  }, []);

  const value: StoreContextValue = {
    transactions,
    customers,
    alerts,
    chargebacks,
    returns,
    webhookEvents,
    dailyStats,
    demoScenarios,
    demoMode,
    demoStep,
    selectedTransaction,
    selectedAlert,
    loading,
    dataSource,
    setTransactions,
    setCustomers,
    setAlerts,
    setChargebacks,
    setReturns,
    setWebhookEvents,
    setDailyStats,
    setDemoScenarios,
    setDemoMode,
    setDemoStep,
    acknowledgeAlert,
    resolveAlert,
    recordMerchantDecision,
    recordFeedback,
    addWebhookEvent,
    startDemo,
    nextDemoStep,
    resetDemo,
    selectTransaction,
    selectAlert,
  };

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): StoreContextValue {
  const ctx = useContext(StoreContext);
  if (!ctx) {
    throw new Error('useStore must be used within a StoreProvider');
  }
  return ctx;
}
