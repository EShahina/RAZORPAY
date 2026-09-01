import type { Transaction, Alert, SpikeData } from '../types';

export function detectSpike(
  recentTransactions: Transaction[],
  baselineTransactions: Transaction[],
  windowMinutes: number = 60,
  threshold: number = 2.0
): { isSpike: boolean; spikeData: SpikeData } {
  const recentHighRisk = recentTransactions.filter(t => t.riskScore >= 60).length;
  const baselineHighRisk = baselineTransactions.filter(t => t.riskScore >= 60).length;
  
  const baselineAvg = baselineHighRisk / 7; // 7-day average
  const normalRange: [number, number] = [
    Math.max(0, Math.floor(baselineAvg * 0.5)),
    Math.ceil(baselineAvg * 1.5)
  ];
  
  const spikePercent = baselineAvg > 0 ? (recentHighRisk / baselineAvg) * 100 : recentHighRisk > 0 ? 1000 : 0;
  const isSpike = spikePercent >= threshold * 100 && recentHighRisk > 0;
  
  return {
    isSpike,
    spikeData: {
      baselineCount: Math.round(baselineAvg),
      currentCount: recentHighRisk,
      spikePercent: Math.round(spikePercent),
      windowMinutes,
      normalRange,
    },
  };
}

export function createSpikeAlert(spikeData: SpikeData, transactionIds: string[], totalExposure: number): Alert {
  return {
    id: `ALERT-${Date.now()}`,
    title: `Fraud Spike Detected — ${spikeData.spikePercent}% above baseline`,
    description: `${spikeData.currentCount} high-risk transactions in ${spikeData.windowMinutes}min window (baseline: ${spikeData.baselineCount}). Immediate review recommended.`,
    severity: spikeData.spikePercent >= 300 ? 'critical' : 'warning',
    status: 'active',
    transactionIds,
    totalExposure,
    createdAt: new Date().toISOString(),
    spikeData,
  };
}
