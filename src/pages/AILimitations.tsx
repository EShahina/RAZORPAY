import {
  Shield,
  CheckCircle,
  AlertTriangle,
  Database,
  Scale,
  Users,
  MessageSquare,
} from 'lucide-react';

const capabilities = [
  'Scores payment risk based on transaction features',
  'Provides explainable factor contributions',
  'Detects fraud spikes in real-time',
  'Supports merchant decision workflows',
  'Generates financial impact estimates',
];

const limitations = [
  'Estimated metrics — not from production deployment',
  'No real Razorpay API integration (simulated)',
  'Static feature weights (not continuously learning)',
  'No PII detection or compliance features',
  'Cannot verify card ownership',
  'No network/graph analysis',
  'Limited to transaction-level features',
];

const dataSources = [
  'All data is simulated/demo',
  'Metrics are from documented evaluation pipeline',
  'No real customer data is used',
];

const ethicalConsiderations = [
  {
    icon: Scale,
    title: 'Bias Awareness',
    desc: 'The model may reflect biases present in training data. Regular audits are necessary to ensure equitable outcomes across demographic groups.',
  },
  {
    icon: Users,
    title: 'Fair Lending Considerations',
    desc: 'Risk scoring decisions can impact access to financial services. Disparate impact testing should be performed before any production deployment.',
  },
  {
    icon: Users,
    title: 'Human-in-the-Loop Requirement',
    desc: 'Automated decisions should always be subject to human review, especially for high-impact actions like blocking transactions or accounts.',
  },
  {
    icon: MessageSquare,
    title: 'Appeal Process for Blocked Transactions',
    desc: 'Any system that blocks financial transactions must provide a clear, accessible appeal process for legitimate customers who are incorrectly flagged.',
  },
];

export default function AILimitations() {
  return (
    <div className="min-h-screen bg-zinc-950 p-6 space-y-8">
      <div className="flex items-center gap-3">
        <div className="p-2 bg-amber-500/10 rounded-lg">
          <AlertTriangle className="h-6 w-6 text-amber-400" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-white">AI Limitations &amp; Transparency</h1>
          <p className="text-sm text-zinc-400">Honest disclosure of what this model can and cannot do</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-zinc-900 rounded-xl ring-1 ring-zinc-800 p-6">
          <div className="flex items-center gap-2 mb-5">
            <CheckCircle className="h-5 w-5 text-emerald-400" />
            <h2 className="text-lg font-semibold text-white">What This Model Does</h2>
          </div>
          <ul className="space-y-3">
            {capabilities.map((item) => (
              <li key={item} className="flex items-start gap-3">
                <CheckCircle className="h-4 w-4 text-emerald-400 mt-0.5 shrink-0" />
                <span className="text-sm text-zinc-300 leading-relaxed">{item}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="bg-zinc-900 rounded-xl ring-1 ring-zinc-800 p-6">
          <div className="flex items-center gap-2 mb-5">
            <AlertTriangle className="h-5 w-5 text-yellow-400" />
            <h2 className="text-lg font-semibold text-white">Known Limitations</h2>
          </div>
          <ul className="space-y-3">
            {limitations.map((item) => (
              <li key={item} className="flex items-start gap-3">
                <AlertTriangle className="h-4 w-4 text-yellow-400 mt-0.5 shrink-0" />
                <span className="text-sm text-zinc-300 leading-relaxed">{item}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="bg-zinc-900 rounded-xl ring-1 ring-zinc-800 p-6">
        <div className="flex items-center gap-2 mb-5">
          <Database className="h-5 w-5 text-cyan-400" />
          <h2 className="text-lg font-semibold text-white">Data Sources</h2>
        </div>
        <ul className="space-y-3">
          {dataSources.map((item) => (
            <li key={item} className="flex items-start gap-3">
              <div className="h-1.5 w-1.5 rounded-full bg-cyan-400 mt-1.5 shrink-0" />
              <span className="text-sm text-zinc-300 leading-relaxed">{item}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="bg-zinc-900 rounded-xl ring-1 ring-zinc-800 p-6">
        <div className="flex items-center gap-2 mb-5">
          <Scale className="h-5 w-5 text-purple-400" />
          <h2 className="text-lg font-semibold text-white">Ethical Considerations</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {ethicalConsiderations.map((item) => (
            <div key={item.title} className="bg-zinc-800/50 rounded-lg p-4 space-y-2">
              <div className="flex items-center gap-2">
                <item.icon className="h-4 w-4 text-purple-400" />
                <h3 className="text-sm font-semibold text-white">{item.title}</h3>
              </div>
              <p className="text-xs text-zinc-400 leading-relaxed">{item.desc}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-6 text-center space-y-3">
        <Shield className="h-8 w-8 text-zinc-600 mx-auto" />
        <p className="text-sm text-zinc-400 max-w-2xl mx-auto leading-relaxed">
          This is a hackathon demonstration. Production deployment would require regulatory compliance,
          security audit, and real data validation.
        </p>
      </div>
    </div>
  );
}
