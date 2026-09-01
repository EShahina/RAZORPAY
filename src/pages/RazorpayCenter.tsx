import { useState } from 'react';
import { useStore } from '../hooks/useStore';
import { timeAgo } from '../utils/format';
import type { WebhookEvent } from '../types';
import {
  Webhook,
  Zap,
  CheckCircle2,
  Clock,
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  Plus,
  Wifi,
} from 'lucide-react';

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
            <h1 className="text-2xl font-bold text-white">Razorpay Webhook Center</h1>
            <p className="text-sm text-zinc-400">Monitor and simulate incoming webhook events</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 ring-1 ring-inset ring-emerald-500/25">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
            </span>
            <span className="text-xs font-medium text-emerald-400 flex items-center gap-1">
              <Wifi className="h-3 w-3" /> Connected
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
