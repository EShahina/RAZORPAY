import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react';
import type {
  Transaction,
  Customer,
  Alert,
  Chargeback,
  Return,
  WebhookEvent,
  DailyStats,
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
} from '../data/seedData';
import { fetchTransactions, fetchAlerts, acknowledgeAlertApi, resolveAlertApi, recordDecision as apiRecordDecision, recordFeedback as apiRecordFeedback } from '../api/client';

interface StoreState {
  transactions: Transaction[];
  customers: Customer[];
  alerts: Alert[];
  chargebacks: Chargeback[];
  returns: Return[];
  webhookEvents: WebhookEvent[];
  dailyStats: DailyStats[];
  selectedTransaction: Transaction | null;
  selectedAlert: Alert | null;
  loading: boolean;
  lastOpError: string | null;
  lastOpSaved: { kind: string; id: string; at: number } | null;
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
  acknowledgeAlert: (id: string) => Promise<boolean>;
  resolveAlert: (id: string) => Promise<boolean>;
  recordMerchantDecision: (txnId: string, decision: RiskAction, notes?: string) => Promise<boolean>;
  recordFeedback: (txnId: string, label: FeedbackLabel) => Promise<boolean>;
  addWebhookEvent: (event: WebhookEvent) => void;
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
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
  const [selectedAlert, setSelectedAlert] = useState<Alert | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastOpError, setLastOpError] = useState<string | null>(null);
  const [lastOpSaved, setLastOpSaved] = useState<{ kind: string; id: string; at: number } | null>(null);
  const [dataSource, setDataSource] = useState<'backend' | 'seed'>('seed');

  // Load the transaction feed + alerts from the backend on mount. Falls back
  // to the bundled seed corpus when the server is offline so the UI renders.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [txRes, alertRes] = await Promise.all([
        fetchTransactions(500),
        fetchAlerts(),
      ]);
      if (cancelled) return;
      if (txRes.data.length > 0) {
        setTransactions(txRes.data);
        setDataSource('backend');
      }
      setAlerts(alertRes.length > 0 ? alertRes : seedAlerts);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const acknowledgeAlert = useCallback(async (id: string): Promise<boolean> => {
    const ok = await acknowledgeAlertApi(id);
    if (!ok) {
      setLastOpError(`Could not acknowledge alert ${id} on the server.`);
      return false;
    }
    setLastOpError(null);
    setLastOpSaved({ kind: 'alert', id, at: Date.now() });
    setAlerts((prev) =>
      prev.map((a) =>
        a.id === id ? { ...a, status: 'acknowledged' as const, acknowledgedAt: new Date().toISOString() } : a
      )
    );
    return true;
  }, []);

  const resolveAlert = useCallback(async (id: string): Promise<boolean> => {
    const ok = await resolveAlertApi(id);
    if (!ok) {
      setLastOpError(`Could not resolve alert ${id} on the server.`);
      return false;
    }
    setLastOpError(null);
    setLastOpSaved({ kind: 'alert', id, at: Date.now() });
    setAlerts((prev) =>
      prev.map((a) =>
        a.id === id ? { ...a, status: 'resolved' as const, resolvedAt: new Date().toISOString() } : a
      )
    );
    return true;
  }, []);

  const recordMerchantDecision = useCallback(async (txnId: string, decision: RiskAction, notes?: string): Promise<boolean> => {
    const ok = await apiRecordDecision(txnId, decision, notes);
    if (!ok) {
      setLastOpError(`Could not save decision for ${txnId} on the server.`);
      return false;
    }
    setLastOpError(null);
    setLastOpSaved({ kind: 'decision', id: txnId, at: Date.now() });
    setTransactions((prev) =>
      prev.map((t) =>
        t.id === txnId
          ? { ...t, merchantDecision: decision, ...(notes ? { investigationNotes: notes } : {}) }
          : t
      )
    );
    return true;
  }, []);

  const recordFeedback = useCallback(async (txnId: string, label: FeedbackLabel): Promise<boolean> => {
    const ok = await apiRecordFeedback(txnId, label);
    if (!ok) {
      setLastOpError(`Could not save feedback for ${txnId} on the server.`);
      return false;
    }
    setLastOpError(null);
    setLastOpSaved({ kind: 'feedback', id: txnId, at: Date.now() });
    setTransactions((prev) =>
      prev.map((t) => (t.id === txnId ? { ...t, feedbackLabel: label } : t))
    );
    return true;
  }, []);

  const addWebhookEvent = useCallback((event: WebhookEvent) => {
    setWebhookEvents((prev) => [event, ...prev]);
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
    selectedTransaction,
    selectedAlert,
    loading,
    lastOpError,
    lastOpSaved,
    dataSource,
    setTransactions,
    setCustomers,
    setAlerts,
    setChargebacks,
    setReturns,
    setWebhookEvents,
    setDailyStats,
    acknowledgeAlert,
    resolveAlert,
    recordMerchantDecision,
    recordFeedback,
    addWebhookEvent,
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
