import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Database, ChevronRight, Compass, Cloud } from 'lucide-react';
import { api } from '../lib/appConfig';
import Layout from '../components/Layout';

interface Connection {
  id: string;
  name: string;
  type: string;
  status: 'connected' | 'disconnected' | 'error';
}

const DataSources: React.FC = () => {
  const [connections, setConnections] = useState<Connection[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchConnections = async () => {
      try {
        const res = await api.get('/connections');
        setConnections(res.data || []);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchConnections();
  }, []);

  const availableSources = [
    { type: 'ClickHouse', icon: <Database />, color: '#F06543' },
    { type: 'Snowflake', icon: <Cloud />, color: '#29B6F6' },
    { type: 'PostgreSQL', icon: <Database />, color: '#336791' },
  ];

  return (
    <Layout>
      <header className="mb-10 flex items-center justify-between">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2 text-sm text-[#666]">
            <Database size={20} />
            <span>Data Sources</span>
          </div>
          <p className="text-[#888]">Manage your connections and add new sources.</p>
        </div>
      </header>

      {/* Network Access Alert (Mocked from Screenshot) */}
      <div className="mb-8 rounded-xl border border-[#222] bg-[#141414] p-5">
        <div className="flex items-center gap-3">
          <div className="rounded-full bg-[#1A1A1A] p-2 text-[#444]">
            <Compass size={18} />
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-semibold text-white">Network access</span>
            <p className="text-xs text-[#666]">
              You may need to whitelist Velora's public IP before testing this connection.
            </p>
          </div>
          <div className="ml-auto flex items-center gap-2 rounded-lg bg-[#222] px-3 py-1.5 text-xs text-white">
            <span className="font-mono">13.234.4.18</span>
            <ChevronRight size={14} />
          </div>
        </div>
      </div>

      <section className="mb-10">
        <h2 className="mb-4 text-sm font-bold uppercase tracking-widest text-[#444]">
          Connected Sources
        </h2>
        <div className="rounded-xl border border-[#222] bg-[#141414] overflow-hidden">
          {loading ? (
            <div className="p-10 text-center text-[#666]">Loading...</div>
          ) : connections.length > 0 ? (
            <div className="divide-y divide-[#222]">
              {connections.map((conn) => (
                <div
                  key={conn.id}
                  className="flex items-center justify-between p-4 px-6 hover:bg-[#1A1A1A] group cursor-pointer"
                >
                  <div className="flex items-center gap-4">
                    <div className="h-2 w-2 rounded-full bg-emerald-500" />
                    <span className="font-medium">{conn.name}</span>
                    <span className="text-xs text-[#666] capitalize">{conn.type}</span>
                  </div>
                  <div className="flex items-center gap-2 text-emerald-500 text-xs font-semibold px-2 py-1 rounded bg-emerald-500/10">
                    <div className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                    Connected
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-10 text-center text-[#666]">No connections yet. Add one below.</div>
          )}
        </div>
      </section>

      <section>
        <h2 className="mb-4 text-sm font-bold uppercase tracking-widest text-[#444]">
          Available Data Sources
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {availableSources.map((source) => {
            const isSupported = source.type === 'ClickHouse';
            return (
              <button
                key={source.type}
                disabled={!isSupported}
                onClick={() => isSupported && navigate(`/data-sources/new?source=${source.type}`)}
                className={`group relative flex items-center gap-4 rounded-xl border p-5 text-left transition-all ${
                  isSupported
                    ? 'border-[#222] bg-[#141414] hover:bg-[#1A1A1A] cursor-pointer'
                    : 'border-[#1A1A1A] bg-[#0A0A0A] cursor-not-allowed grayscale opacity-60'
                }`}
              >
                <div
                  className={`rounded-lg bg-white/5 p-3 ${isSupported ? 'text-[#F06543]' : 'text-zinc-600'}`}
                >
                  {source.icon}
                </div>
                <div className="flex flex-col">
                  <span className={`font-semibold ${isSupported ? 'text-white' : 'text-zinc-500'}`}>
                    {source.type}
                  </span>
                  {!isSupported && (
                    <span className="text-[10px] uppercase font-bold tracking-widest text-zinc-600">
                      Coming Soon
                    </span>
                  )}
                </div>
                {!isSupported && (
                  <div className="absolute inset-0 flex items-center justify-center rounded-xl bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity">
                    <span className="text-[11px] font-bold uppercase tracking-widest text-white px-3 py-1 bg-[#222] rounded-full">
                      Coming Soon
                    </span>
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </section>
    </Layout>
  );
};

export default DataSources;
