import React from 'react';
import {
  HelpCircle,
  Database,
  Terminal,
  MessageSquare,
  ChevronRight,
  Copy,
  Check,
  ShieldCheck,
  Zap,
  Globe,
  Lock,
} from 'lucide-react';
import Layout from '../components/Layout';

const HelpSupport: React.FC = () => {
  const [copied, setCopied] = React.useState<string | null>(null);

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  };

  const credentials = [
    { label: 'Host', value: 'vjmzvtxtab.ap-south-1.aws.clickhouse.cloud' },
    { label: 'HTTP Port', value: '8443' },
    { label: 'Username', value: 'default' },
    { label: 'Password', value: 'quf3_tvWAYU1b' },
    { label: 'Database', value: 'default' },
    { label: 'SSL', value: 'Enabled (✅ Yes)' },
  ];

  const sampleQuestions = [
    'Which airline flew the most number of flights?',
    'What is the average delay time for DEL airport?',
    'Show me total passengers by airline as a bar chart',
    'Which routes carried the most passengers overall?',
    'List all delayed flights yesterday along with their gate numbers',
  ];

  return (
    <Layout>
      <div className="max-w-4xl mx-auto py-10">
        <header className="mb-12">
          <div className="flex items-center gap-3 text-[#F06543] mb-4">
            <div className="p-2 rounded-xl bg-[#F06543]/10">
              <HelpCircle size={28} />
            </div>
            <span className="text-xs font-black uppercase tracking-[0.3em]">Knowledge Base</span>
          </div>
          <h1 className="text-5xl font-black text-white tracking-tight mb-4">
            Getting Started with{' '}
            <span className="text-transparent bg-clip-text bg-linear-to-r from-[#F06543] to-[#FF8A70]">
              Velora
            </span>
          </h1>
          <p className="text-xl text-[#666] leading-relaxed max-w-2xl">
            Connect your analytical engines and start chatting with your data in minutes. Follow
            this guide to set up your first connection.
          </p>
        </header>

        <div className="grid gap-12">
          {/* Connection Guide */}
          <section>
            <div className="flex items-center gap-3 mb-6">
              <div className="h-1 bg-[#F06543] w-8 rounded-full" />
              <h2 className="text-2xl font-bold text-white tracking-tight">How to Connect</h2>
            </div>

            <div className="grid md:grid-cols-3 gap-6">
              {[
                {
                  icon: <Globe className="text-blue-400" />,
                  title: '1. Select Provider',
                  desc: 'Currently supporting ClickHouse. SQL Server & Snowflake coming soon.',
                },
                {
                  icon: <Lock className="text-purple-400" />,
                  title: '2. Input Credentials',
                  desc: 'Fill in your host, port, username, and password securely.',
                },
                {
                  icon: <Zap className="text-yellow-400" />,
                  title: '3. Test & Sync',
                  desc: 'Velora will automatically index your schema for optimized AI processing.',
                },
              ].map((step, i) => (
                <div
                  key={i}
                  className="p-6 rounded-2xl bg-[#111] border border-white/5 hover:border-[#F06543]/30 transition-all duration-300"
                >
                  <div className="mb-4">{step.icon}</div>
                  <h3 className="text-white font-bold mb-2">{step.title}</h3>
                  <p className="text-sm text-[#555] leading-relaxed">{step.desc}</p>
                </div>
              ))}
            </div>
          </section>

          {/* Sample Credentials */}
          <section>
            <div className="rounded-3xl bg-[#141414] border border-white/5 overflow-hidden shadow-2xl">
              <div className="p-8 border-b border-white/5 bg-linear-to-br from-white/5 to-transparent">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2 text-[#F06543]">
                    <Database size={20} />
                    <span className="text-xs font-black uppercase tracking-[0.2em]">
                      Sample Connection
                    </span>
                  </div>
                  <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-green-500/10 text-green-500 text-[10px] font-bold uppercase tracking-wider">
                    <ShieldCheck size={12} />
                    <span>Verified Safe</span>
                  </div>
                </div>
                <h2 className="text-3xl font-black text-white">ClickHouse Cloud Instance</h2>
              </div>

              <div className="p-0">
                <div className="grid grid-cols-1 md:grid-cols-2">
                  {credentials.map((cred, i) => (
                    <div
                      key={i}
                      className={`p-6 border-white/5 flex flex-col gap-1 hover:bg-white/2 group transition-colors ${i % 2 === 0 ? 'md:border-r' : ''} ${i < 4 ? 'border-b' : ''}`}
                    >
                      <span className="text-[10px] font-black uppercase tracking-widest text-[#444] group-hover:text-[#666] transition-colors">
                        {cred.label}
                      </span>
                      <div className="flex items-center justify-between gap-4">
                        <code className="text-white font-mono text-sm break-all">{cred.value}</code>
                        <button
                          onClick={() => handleCopy(cred.value, cred.label)}
                          className="shrink-0 p-2 rounded-lg hover:bg-white/5 text-[#444] hover:text-white transition-all"
                        >
                          {copied === cred.label ? (
                            <Check size={14} className="text-green-500" />
                          ) : (
                            <Copy size={14} />
                          )}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>

          {/* Table Schema & Questions */}
          <div className="grid md:grid-cols-2 gap-8">
            <section className="flex flex-col h-full">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2 rounded-xl bg-blue-500/10 text-blue-400">
                  <Terminal size={20} />
                </div>
                <h3 className="text-xl font-bold text-white tracking-tight">Active Table Schema</h3>
              </div>
              <div className="flex-1 rounded-2xl bg-[#080808] border border-white/5 p-6 font-mono text-[12px] text-[#666] leading-relaxed shadow-inner">
                <pre className="whitespace-pre-wrap selection:bg-[#F06543]/20">
                  {`CREATE TABLE airport_flights
(
    flight_id          UInt32,
    flight_no          String,
    airline            String,
    departure_airport  String,
    arrival_airport    String,
    scheduled_dep      DateTime,
    actual_dep         DateTime,
    scheduled_arr      DateTime,
    actual_arr         DateTime,
    delay_minutes      Int16,
    passengers         UInt16,
    flight_duration_min UInt16,
    ...
)
ORDER BY (scheduled_dep, flight_id);`}
                </pre>
              </div>
            </section>

            <section className="flex flex-col h-full">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2 rounded-xl bg-[#F06543]/10 text-[#F06543]">
                  <MessageSquare size={20} />
                </div>
                <h3 className="text-xl font-bold text-white tracking-tight">Sample Questions</h3>
              </div>
              <div className="flex-1 space-y-3">
                {sampleQuestions.map((q, i) => (
                  <div
                    key={i}
                    className="group p-4 rounded-xl bg-[#111] border border-white/5 hover:border-[#F06543]/20 hover:bg-[#151515] transition-all cursor-pointer flex items-center justify-between"
                    onClick={() => handleCopy(q, `q-${i}`)}
                  >
                    <span className="text-sm text-[#888] group-hover:text-white transition-colors">
                      {q}
                    </span>
                    {copied === `q-${i}` ? (
                      <Check size={14} className="text-green-500" />
                    ) : (
                      <ChevronRight size={14} className="text-[#333] group-hover:text-[#F06543]" />
                    )}
                  </div>
                ))}
              </div>
            </section>
          </div>

          <footer className="mt-12 p-8 rounded-3xl bg-linear-to-br from-[#F06543]/10 to-transparent border border-[#F06543]/20 flex flex-col md:flex-row items-center justify-between gap-6">
            <div>
              <h4 className="text-xl font-bold text-white mb-2">Still need help?</h4>
              <p className="text-[#666] text-sm leading-relaxed">
                Our infrastructure team is available 24/7 for complex schema tuning.
              </p>
            </div>
            <button className="px-8 py-3 rounded-xl bg-[#F06543] text-white font-bold text-sm transition-all hover:bg-[#D45131] hover:scale-105 active:scale-95 shadow-xl shadow-[#F06543]/20">
              Contact Support
            </button>
          </footer>
        </div>
      </div>
    </Layout>
  );
};

export default HelpSupport;
