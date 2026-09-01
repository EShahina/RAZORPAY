import { useState } from 'react';
import { useStore } from '../hooks/useStore';
import { timeAgo } from '../utils/format';
import type { WebhookEvent, RiskLevel } from '../types';
import { createRazorpayOrder, verifyRazorpayPayment, fetchRazorpayPayments, testRazorpayWebhook, type RazorpayPaymentResult, type RazorpayPaymentRow, type WebhookTestResult } from '../api/client';
import RiskBadge from '../components/RiskBadge';
import {
  Webhook,
  Zap,
  CheckCircle2,
  Clock,
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  Plus,
  ShoppingCart,
  Loader2,
  CreditCard,
  ShieldCheck,
  RefreshCw,
  Send,
  List,
} from 'lucide-react';

declare global {
  interface Window {
    Razorpay: any;
  }
}

const EVENT_TYPES = [
  'payment.captured',
  'payment.failed',
  'payment.authorized',
  'refund.created',
  'refund.processed',
  'chargeback.created',
] as const;

function generatePayload(type: string): Record<string, unknown> {
  const id = `evt_${Math.random().toString(36).slice(2, 14)}`;
  const amount = Math.floor(Math.random() * 50000) + 100;
  const base = {
    id,
    amount,
    currency: 'INR',
    created_at: new Date().toISOString(),
  };

  switch (type) {
    case 'payment.captured':
      return {
        ...base,
        entity: 'event',
        account: 'acct_test123',
        payload: {
          payment: {
            entity: {
              id: `pay_${Math.random().toString(36).slice(2, 14)}`,
              amount,
              currency: 'INR',
              status: 'captured',
              method: 'card',
              description: 'Order payment captured',
            },
          },
        },
      };
    case 'payment.failed':
      return {
        ...base,
        entity: 'event',
        payload: {
          payment: {
            entity: {
              id: `pay_${Math.random().toString(36).slice(2, 14)}`,
              amount,
              currency: 'INR',
              status: 'failed',
              error_code: 'badateway_card_expired',
              error_description: 'The card has expired.',
            },
          },
        },
      };
    case 'payment.authorized':
      return {
        ...base,
        entity: 'event',
        payload: {
          payment: {
            entity: {
              id: `pay_${Math.random().toString(36).slice(2, 14)}`,
              amount,
              currency: 'INR',
              status: 'authorized',
              method: 'card',
            },
          },
        },
      };
    case 'refund.created':
      return {
        ...base,
        entity: 'event',
        payload: {
          refund: {
            entity: {
              id: `rfnd_${Math.random().toString(36).slice(2, 14)}`,
              amount: Math.floor(amount * 0.5),
              currency: 'INR',
              status: 'pending',
            },
          },
        },
      };
    case 'refund.processed':
      return {
        ...base,
        entity: 'event',
        payload: {
          refund: {
            entity: {
              id: `rfnd_${Math.random().toString(36).slice(2, 14)}`,
              amount: Math.floor(amount * 0.5),
              currency: 'INR',
              status: 'processed',
            },
          },
        },
      };
    case 'chargeback.created':
      return {
        ...base,
        entity: 'event',
        payload: {
          chargeback: {
            entity: {
              id: `chb_${Math.random().toString(36).slice(2, 14)}`,
              amount,
              currency: 'INR',
              reason: 'fraudulent',
              status: 'open',
            },
          },
        },
      };
    default:
      return base;
  }
}

function PayloadSummary({ payload }: { payload: Record<string, unknown> }) {
  const inner = payload.payload as Record<string, unknown> | undefined;
  if (inner) {
    const entity = inner[Object.keys(inner)[0]] as Record<string, unknown> | undefined;
    if (entity?.entity) {
      const e = entity.entity as Record<string, unknown>;
      return (
        <span className="text-xs text-zinc-400 truncate max-w-[220px]">
          {e.method ? `${e.method} ` : ''}{typeof e.amount === 'number' ? `₹${e.amount}` : ''}{e.status ? ` — ${String(e.status)}` : ''}{e.reason ? ` — ${String(e.reason)}` : ''}
        </span>
      );
    }
  }
  return <span className="text-xs text-zinc-500 truncate max-w-[220px]">No summary</span>;
}

export default function RazorpayCenter() {
  const { webhookEvents, addWebhookEvent } = useStore();
  const [selectedEvent, setSelectedEvent] = useState<WebhookEvent | null>(null);
  const [expandedPayload, setExpandedPayload] = useState<string | null>(null);
  const [amount, setAmount] = useState<number>(1500);
  const [creating, setCreating] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [paymentResult, setPaymentResult] = useState<RazorpayPaymentResult | null>(null);
  const [testMode, setTestMode] = useState<boolean | null>(null);
  const [lastOrderId, setLastOrderId] = useState<string | null>(null);

  const [payments, setPayments] = useState<RazorpayPaymentRow[] | null>(null);
  const [paymentsLoading, setPaymentsLoading] = useState(false);
  const [paymentsError, setPaymentsError] = useState<string | null>(null);
  const [whTesting, setWhTesting] = useState(false);
  const [whResult, setWhResult] = useState<WebhookTestResult | null>(null);
  const [whError, setWhError] = useState<string | null>(null);

  const handleFetchPayments = async () => {
    setPaymentsLoading(true);
    setPaymentsError(null);
    const res = await fetchRazorpayPayments(20);
    setPaymentsLoading(false);
    if (res.ok && res.data) {
      setPayments(res.data);
    } else {
      setPaymentsError(res.error || 'Failed to fetch payments');
      setPayments(null);
    }
  };

  const handleTestWebhook = async () => {
    setWhTesting(true);
    setWhError(null);
    setWhResult(null);
    const res = await testRazorpayWebhook();
    setWhTesting(false);
    if (res.ok && res.data) {
      setWhResult(res.data);
    } else {
      setWhError(res.error || 'Webhook test failed');
    }
  };

  const loadCheckoutScript = (): Promise<any> =>
    new Promise((resolve, reject) => {
      if (window.Razorpay) return resolve(window.Razorpay);
      const script = document.createElement('script');
      script.src = 'https://checkout.razorpay.com/v1/checkout.js';
      script.onload = () => resolve(window.Razorpay);
      script.onerror = () => reject(new Error('Failed to load Razorpay checkout SDK'));
      document.body.appendChild(script);
    });

  const handleCreateOrder = async () => {
    setPaymentError(null);
    setPaymentResult(null);
    setCreating(true);
    try {
      const res = await createRazorpayOrder({ amount, currency: 'INR' });
      if (!res.ok || !res.data) {
        setPaymentError(res.error || 'Could not create order');
        if (res.hint) setPaymentError(`${res.error} — ${res.hint}`);
        setCreating(false);
        return;
      }
      const order = res.data;
      setTestMode(order.test_mode);
      setLastOrderId(order.order_id);

      const RazorpayCtor = await loadCheckoutScript();
      const options = {
        key: order.key_id,
        amount: Math.round(order.amount * 100),
        currency: order.currency,
        name: 'MerchantShield AI',
        description: 'Risk-engine test payment',
        order_id: order.order_id,
        handler: async (response: any) => {
          setVerifying(true);
          try {
            const verified = await verifyRazorpayPayment({
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
            });
            if (verified.ok && verified.data) {
              setPaymentResult(verified.data);
            } else {
              setPaymentError(verified.error || 'Payment could not be verified');
            }
          } catch {
            setPaymentError('Payment verification failed unexpectedly');
          } finally {
            setVerifying(false);
          }
        },
        modal: {
          ondismiss: () => setCreating(false),
        },
      };
      const rzp = new RazorpayCtor(options);
      rzp.on('payment.failed', (failed: any) => {
        setPaymentError(
          failed?.error?.description || 'Payment failed. Please try again.',
        );
        setCreating(false);
      });
      rzp.open();
    } catch (e) {
      setPaymentError((e as Error).message || 'Checkout could not be started');
      setCreating(false);
    }
  };

  const totalEvents = webhookEvents.length;
  const processedCount = webhookEvents.filter((e) => e.processed).length;
  const pendingCount = webhookEvents.filter((e) => !e.processed).length;
  const errorCount = webhookEvents.filter(
    (e) => e.eventType === 'payment.failed' || e.eventType === 'chargeback.created'
  ).length;

  const handleSimulate = () => {
    const type = EVENT_TYPES[Math.floor(Math.random() * EVENT_TYPES.length)];
    const event: WebhookEvent = {
      id: `evt_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      eventType: type,
      payload: generatePayload(type),
      receivedAt: new Date().toISOString(),
      processed: Math.random() > 0.3,
    };
    addWebhookEvent(event);
  };

  return (
    <div className="min-h-screen bg-zinc-950 p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-purple-500/10 rounded-lg">
            <Webhook className="h-6 w-6 text-purple-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Razorpay Center</h1>
            <p className="text-sm text-zinc-400">Payments, test checkout & webhook monitoring</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full ring-1 ring-inset ${
            testMode === false
              ? 'bg-purple-500/10 ring-purple-500/25'
              : 'bg-emerald-500/10 ring-emerald-500/25'
          }`}>
            <span className={`relative flex h-2 w-2 ${
              testMode === false ? 'bg-purple-400' : 'bg-emerald-500'
            } rounded-full`} />
            <span className={`text-xs font-medium flex items-center gap-1 ${
              testMode === false ? 'text-purple-400' : 'text-emerald-400'
            }`}>
              {testMode === false ? 'Test mode' : 'Live / unconfigured'}
            </span>
          </div>
          <button
            onClick={handleSimulate}
            className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-sm font-medium transition-colors"
          >
            <Plus className="h-4 w-4" /> Simulate Webhook
          </button>
        </div>
      </div>

      {/* Test-mode checkout panel */}
      <div className="bg-zinc-900 rounded-xl ring-1 ring-zinc-800 p-5">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 bg-purple-500/10 rounded-lg">
            <ShoppingCart className="h-5 w-5 text-purple-400" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-white">Razorpay Test Checkout</h2>
            <p className="text-xs text-zinc-400">
              Create an order and complete a payment with Razorpay test cards. Captured payments are scored by the risk engine.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-end gap-4">
          <label className="block">
            <span className="text-xs text-zinc-400 mb-1 block">Amount (₹)</span>
            <input
              type="number"
              min={1}
              value={amount}
              onChange={(e) => setAmount(Number(e.target.value))}
              className="w-40 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/50"
            />
          </label>
          <button
            onClick={handleCreateOrder}
            disabled={creating || verifying}
            className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg text-sm font-medium transition-colors"
          >
            {creating ? (
              <><Loader2 className="h-4 w-4 animate-spin" /> Creating order…</>
            ) : verifying ? (
              <><Loader2 className="h-4 w-4 animate-spin" /> Verifying payment…</>
            ) : (
              <><CreditCard className="h-4 w-4" /> Pay ₹{amount.toLocaleString('en-IN')}</>
            )}
          </button>
          <p className="text-xs text-zinc-500">
            Use test card <span className="text-zinc-300 font-mono">4111 1111 1111 1111</span> · any future expiry · any CVV
          </p>
        </div>

        {paymentError && (
          <div className="mt-4 flex items-center gap-2 px-3 py-2.5 rounded-lg bg-red-500/10 text-red-400 text-sm">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span>{paymentError}</span>
          </div>
        )}

        {paymentResult && (
          <div className="mt-4 bg-zinc-800/50 rounded-lg p-4 ring-1 ring-zinc-700/50">
            <div className="flex items-center gap-2 mb-3">
              <ShieldCheck className="h-5 w-5 text-emerald-400" />
              <span className="text-sm font-semibold text-white">Payment captured & verified</span>
              <span className="text-xs font-mono text-zinc-400 truncate ml-auto">{lastOrderId}</span>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <div className="text-xs text-zinc-400 mb-1">Amount</div>
                <div className="text-lg font-semibold text-white">₹{paymentResult.amount.toLocaleString('en-IN')}</div>
              </div>
              <div>
                <div className="text-xs text-zinc-400 mb-1">Status</div>
                <div className="text-sm font-medium text-emerald-400">{paymentResult.captured ? 'Captured' : paymentResult.status}</div>
              </div>
              <div>
                <div className="text-xs text-zinc-400 mb-1">Risk Level</div>
                <RiskBadge level={paymentResult.riskLevel} />
              </div>
              <div>
                <div className="text-xs text-zinc-400 mb-1">Recommended Action</div>
                <div className="text-sm font-medium text-white capitalize">{paymentResult.action.replace('_', ' ')}</div>
              </div>
            </div>
            <p className="mt-3 text-xs text-zinc-400 leading-relaxed">{paymentResult.explanation}</p>
          </div>
        )}
      </div>

      {/* Webhook end-to-end tester */}
      <div className="bg-zinc-900 rounded-xl ring-1 ring-zinc-800 p-5">
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <div className="p-2 bg-purple-500/10 rounded-lg">
            <Send className="h-5 w-5 text-purple-400" />
          </div>
          <div className="flex-1">
            <h2 className="text-sm font-semibold text-white">Webhook End-to-End Test</h2>
            <p className="text-xs text-zinc-400">
              Builds, signs (X-Razorpay-Signature) and delivers a webhook through the live handler — same code path as a real Razorpay event.
            </p>
          </div>
          <button
            onClick={handleTestWebhook}
            disabled={whTesting}
            className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg text-sm font-medium transition-colors"
          >
            {whTesting ? (
              <><Loader2 className="h-4 w-4 animate-spin" /> Sending…</>
            ) : (
              <><Send className="h-4 w-4" /> Send Test Webhook</>
            )}
          </button>
        </div>

        {whError && (
          <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-red-500/10 text-red-400 text-sm">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span>{whError}</span>
          </div>
        )}

        {whResult && (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-xs font-mono text-purple-400 bg-zinc-800 px-2 py-0.5 rounded">{whResult.event}</span>
              {whResult.txnId && (
                <span className="flex items-center gap-1.5 text-xs text-zinc-400">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                  transaction <span className="font-mono text-emerald-400">{whResult.txnId}</span> created
                </span>
              )}
              {whResult.risk && (
                <span className="flex items-center gap-2 text-xs text-zinc-400">
                  risk <RiskBadge level={whResult.risk.level as RiskLevel} />
                  <span className="capitalize text-zinc-300">{whResult.risk.action.replace('_', ' ')}</span>
                  ({whResult.risk.score}/100)
                </span>
              )}
            </div>
            <details className="bg-zinc-800/50 rounded-lg p-3">
              <summary className="text-xs font-medium text-zinc-400 cursor-pointer">Sent payload</summary>
              <pre className="mt-2 text-xs text-zinc-300 font-mono whitespace-pre-wrap break-all leading-relaxed">
                {JSON.stringify(whResult.tested_event, null, 2)}
              </pre>
            </details>
          </div>
        )}
      </div>

      {/* Razorpay payments list (fetched server-side) */}
      <div className="bg-zinc-900 rounded-xl ring-1 ring-zinc-800 overflow-hidden">
        <div className="px-4 py-3 border-b border-zinc-800 flex items-center gap-3">
          <div className="p-1.5 rounded-md bg-purple-500/10">
            <List className="h-4 w-4 text-purple-400" />
          </div>
          <h2 className="text-sm font-semibold text-white flex-1">Razorpay Payments</h2>
          <span className="text-xs text-zinc-500">{payments ? `${payments.length} payments` : 'fetched from Razorpay API'}</span>
          <button
            onClick={handleFetchPayments}
            disabled={paymentsLoading}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 disabled:cursor-not-allowed text-zinc-200 rounded-md text-xs font-medium transition-colors"
          >
            {paymentsLoading ? (
              <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading…</>
            ) : (
              <><RefreshCw className="h-3.5 w-3.5" /> Fetch</>
            )}
          </button>
        </div>
        {paymentsError && (
          <div className="flex items-center gap-2 px-4 py-3 bg-red-500/10 text-red-400 text-sm">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span>{paymentsError}</span>
          </div>
        )}
        {payments && payments.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-zinc-500 border-b border-zinc-800">
                  <th className="px-4 py-2 font-medium">Payment</th>
                  <th className="px-4 py-2 font-medium">Status</th>
                  <th className="px-4 py-2 font-medium">Amount</th>
                  <th className="px-4 py-2 font-medium">Method</th>
                  <th className="px-4 py-2 font-medium">Email</th>
                  <th className="px-4 py-2 font-medium">Created</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/50">
                {payments.map((p) => (
                  <tr key={p.payment_id} className="text-zinc-300">
                    <td className="px-4 py-2 font-mono text-xs text-purple-400">{p.payment_id}</td>
                    <td className="px-4 py-2">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded ${
                        p.status === 'captured'
                          ? 'text-emerald-400 bg-emerald-500/10'
                          : p.status === 'failed'
                          ? 'text-red-400 bg-red-500/10'
                          : 'text-yellow-400 bg-yellow-500/10'
                      }`}>{p.status}</span>
                    </td>
                    <td className="px-4 py-2 text-white">{p.currency} {p.amount.toLocaleString('en-IN')}</td>
                    <td className="px-4 py-2 text-xs">{p.method || '—'}</td>
                    <td className="px-4 py-2 text-xs text-zinc-400">{p.email || '—'}</td>
                    <td className="px-4 py-2 text-xs text-zinc-500">{new Date(p.created_at * 1000).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          payments && (
            <div className="px-4 py-8 text-center text-zinc-500 text-sm">No payments found. Complete a test checkout or run a webhook test to see transactions here.</div>
          )
        )}
      </div>

      <div className="grid grid-cols-4 gap-4">
        <div className="bg-zinc-900 rounded-xl p-4 ring-1 ring-zinc-800">
          <div className="flex items-center gap-2 text-zinc-400 text-sm mb-1">
            <Zap className="h-4 w-4" /> Total Events
          </div>
          <p className="text-3xl font-bold text-white">{totalEvents}</p>
        </div>
        <div className="bg-zinc-900 rounded-xl p-4 ring-1 ring-zinc-800">
          <div className="flex items-center gap-2 text-emerald-400 text-sm mb-1">
            <CheckCircle2 className="h-4 w-4" /> Processed
          </div>
          <p className="text-3xl font-bold text-emerald-400">{processedCount}</p>
        </div>
        <div className="bg-zinc-900 rounded-xl p-4 ring-1 ring-zinc-800">
          <div className="flex items-center gap-2 text-yellow-400 text-sm mb-1">
            <Clock className="h-4 w-4" /> Pending
          </div>
          <p className="text-3xl font-bold text-yellow-400">{pendingCount}</p>
        </div>
        <div className="bg-zinc-900 rounded-xl p-4 ring-1 ring-zinc-800">
          <div className="flex items-center gap-2 text-red-400 text-sm mb-1">
            <AlertTriangle className="h-4 w-4" /> Error / Chargeback
          </div>
          <p className="text-3xl font-bold text-red-400">{errorCount}</p>
        </div>
      </div>

      <div className="grid grid-cols-5 gap-6">
        <div className="col-span-3 bg-zinc-900 rounded-xl ring-1 ring-zinc-800 overflow-hidden">
          <div className="px-4 py-3 border-b border-zinc-800 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-white">Webhook Event Feed</h2>
            <span className="text-xs text-zinc-500">{totalEvents} events</span>
          </div>
          <div className="divide-y divide-zinc-800/50 max-h-[520px] overflow-y-auto">
            {webhookEvents.length === 0 && (
              <div className="p-8 text-center text-zinc-500 text-sm">No webhook events yet. Click "Simulate Webhook" to create one.</div>
            )}
            {webhookEvents.map((event) => (
              <button
                key={event.id}
                onClick={() => setSelectedEvent(event)}
                className={`w-full text-left px-4 py-3 hover:bg-zinc-800/50 transition-colors flex items-center gap-3 ${
                  selectedEvent?.id === event.id ? 'bg-zinc-800/60' : ''
                }`}
              >
                <div className={`p-1.5 rounded-md ${
                  event.processed
                    ? 'bg-emerald-500/10'
                    : event.eventType === 'payment.failed' || event.eventType === 'chargeback.created'
                    ? 'bg-red-500/10'
                    : 'bg-yellow-500/10'
                }`}>
                  {event.processed ? (
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                  ) : event.eventType === 'payment.failed' || event.eventType === 'chargeback.created' ? (
                    <AlertTriangle className="h-3.5 w-3.5 text-red-400" />
                  ) : (
                    <Clock className="h-3.5 w-3.5 text-yellow-400" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono font-medium text-white bg-zinc-800 px-2 py-0.5 rounded">
                      {event.eventType}
                    </span>
                    {!event.processed && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-yellow-500/10 text-yellow-400">
                        pending
                      </span>
                    )}
                  </div>
                  <PayloadSummary payload={event.payload} />
                </div>
                <span className="text-xs text-zinc-500 whitespace-nowrap">{timeAgo(event.receivedAt)}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="col-span-2 bg-zinc-900 rounded-xl ring-1 ring-zinc-800 overflow-hidden">
          {selectedEvent ? (
            <div className="h-full flex flex-col">
              <div className="px-4 py-3 border-b border-zinc-800">
                <h2 className="text-sm font-semibold text-white">Event Detail</h2>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-xs font-mono text-purple-400">{selectedEvent.id}</span>
                  <span className="text-xs text-zinc-500">•</span>
                  <span className="text-xs text-zinc-500">{timeAgo(selectedEvent.receivedAt)}</span>
                </div>
              </div>
              <div className="px-4 py-3 border-b border-zinc-800 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-zinc-400">Event Type</span>
                  <span className="text-xs font-mono font-medium text-white bg-zinc-800 px-2 py-0.5 rounded">
                    {selectedEvent.eventType}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-zinc-400">Status</span>
                  <span className={`text-xs font-medium px-2 py-0.5 rounded ${
                    selectedEvent.processed ? 'text-emerald-400 bg-emerald-500/10' : 'text-yellow-400 bg-yellow-500/10'
                  }`}>
                    {selectedEvent.processed ? 'Processed' : 'Pending'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-zinc-400">Received At</span>
                  <span className="text-xs text-zinc-300">
                    {new Date(selectedEvent.receivedAt).toLocaleString()}
                  </span>
                </div>
              </div>
              <div className="flex-1 overflow-auto">
                <button
                  onClick={() => setExpandedPayload(expandedPayload === selectedEvent.id ? null : selectedEvent.id)}
                  className="w-full flex items-center justify-between px-4 py-2 text-xs font-medium text-zinc-400 hover:text-white transition-colors"
                >
                  <span>JSON Payload</span>
                  {expandedPayload === selectedEvent.id ? (
                    <ChevronDown className="h-3.5 w-3.5" />
                  ) : (
                    <ChevronRight className="h-3.5 w-3.5" />
                  )}
                </button>
                <pre className="px-4 pb-4 text-xs text-zinc-300 font-mono whitespace-pre-wrap break-all leading-relaxed">
                  {JSON.stringify(selectedEvent.payload, null, 2)}
                </pre>
              </div>
            </div>
          ) : (
            <div className="h-full flex items-center justify-center text-zinc-500 text-sm p-8">
              Select an event to view details
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
