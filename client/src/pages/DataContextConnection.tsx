import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { BarChart4, ChevronRight, Search, TableProperties, BarChart2, CheckCircle2 } from 'lucide-react';
import { api } from '../lib/appConfig';
import Layout from '../components/Layout';

interface TableRow {
  name: string;
  database: string;
}

interface Connection {
  id: string;
  name: string;
  type: string;
}

type Tab = 'overview' | 'tables' | 'metrics' | 'queries';

const DataContextConnection: React.FC = () => {
  const { connId } = useParams<{ connId: string }>();
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>('overview');
  const [connection, setConnection] = useState<Connection | null>(null);
  const [tables, setTables] = useState<TableRow[]>([]);
  const [tablesLoading, setTablesLoading] = useState(false);
  const [tableSearch, setTableSearch] = useState('');

  useEffect(() => {
    const fetchConn = async () => {
      try {
        const res = await api.get('/connections');
        const found = (res.data || []).find((c: Connection) => c.id === connId);
        setConnection(found || null);
      } catch (err) {
        console.error(err);
      }
    };
    fetchConn();
  }, [connId]);

  useEffect(() => {
    if (!connId) return;
    const fetchTables = async () => {
      setTablesLoading(true);
      try {
        const res = await api.get(`/connections/${connId}/tables`);
        setTables(res.data || []);
      } catch (err) {
        console.error(err);
      } finally {
        setTablesLoading(false);
      }
    };
    fetchTables();
  }, [connId]);

  const filteredTables = tables.filter((t) =>
    t.name.toLowerCase().includes(tableSearch.toLowerCase()),
  );

  const tabs: { key: Tab; label: string; count?: number }[] = [
    { key: 'overview', label: 'Overview' },
    { key: 'tables', label: 'Tables', count: tables.length },
    { key: 'metrics', label: 'Metrics', count: 0 },
    { key: 'queries', label: 'Verified Queries', count: 0 },
  ];

  return (
    <Layout>
      {/* Breadcrumb */}
      <div className="mb-8 flex items-center gap-2 text-sm text-[#555]">
        <button onClick={() => navigate('/data-context')} className="hover:text-white transition-colors">
          Data Context
        </button>
        <ChevronRight size={14} />
        <span className="text-white">{connection?.name || '...'}</span>
      </div>

      {/* Header */}
      <div className="mb-8 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <BarChart4 size={24} className="text-[#F06543]" />
          <h1 className="text-2xl font-bold text-white">{connection?.name || '—'}</h1>
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded-lg border border-[#222] bg-[#141414] px-3 py-1.5 text-[11px] text-[#555] font-semibold uppercase tracking-widest">
            No versions
          </span>
        </div>
      </div>

      {/* Tabs */}
      <div className="mb-8 flex items-center gap-0 border-b border-[#1A1A1A]">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex items-center gap-1.5 px-4 py-3 text-sm font-semibold transition-colors border-b-2 -mb-px ${
              tab === t.key
                ? 'border-[#F06543] text-white'
                : 'border-transparent text-[#555] hover:text-[#888]'
            }`}
          >
            {t.label}
            {t.count !== undefined && (
              <span className="rounded-full bg-[#222] px-1.5 py-0.5 text-[10px] text-[#666] font-bold">
                {t.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {tab === 'overview' && (
        <div className="space-y-6 max-w-2xl">
          <div>
            <h3 className="mb-2 text-sm font-semibold text-[#888]">Description</h3>
            <div className="rounded-lg border border-[#1A1A1A] bg-[#0D0D0D] px-4 py-3 text-sm text-[#555]">
              No description yet.
            </div>
          </div>
          <div>
            <div className="flex items-center gap-2 mb-2">
              <h3 className="text-sm font-semibold text-[#888]">Annotations</h3>
              <span className="rounded-full bg-[#1A1A1A] px-2 py-0.5 text-[10px] text-[#555] font-bold">0</span>
            </div>
            <p className="text-sm text-[#444]">No annotations yet.</p>
          </div>
        </div>
      )}

      {tab === 'tables' && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2 text-sm text-white font-semibold">
              Tables
              <span className="rounded-full bg-[#222] px-2 py-0.5 text-[11px] text-[#777] font-bold">
                {filteredTables.length}
              </span>
            </div>
            <div className="relative">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#555]" />
              <input
                value={tableSearch}
                onChange={(e) => setTableSearch(e.target.value)}
                placeholder="Search"
                className="rounded-lg border border-[#222] bg-[#141414] py-2 pl-8 pr-4 text-sm text-white outline-none placeholder:text-[#555] focus:border-[#F06543]/50 transition-colors w-48"
              />
            </div>
          </div>
          <div className="rounded-xl border border-[#222] bg-[#0D0D0D] overflow-hidden">
            <div className="grid grid-cols-[1fr_1.5fr_2fr] px-6 py-3 border-b border-[#1A1A1A]">
              <span className="text-[11px] font-bold uppercase tracking-widest text-[#555]">Database</span>
              <span className="text-[11px] font-bold uppercase tracking-widest text-[#555]">Table</span>
              <span className="text-[11px] font-bold uppercase tracking-widest text-[#555]">Description</span>
            </div>
            {tablesLoading ? (
              <div className="py-12 text-center text-[#555] text-sm">Loading tables...</div>
            ) : filteredTables.length === 0 ? (
              <div className="py-12 text-center text-[#555] text-sm">No tables found.</div>
            ) : (
              filteredTables.map((t) => (
                <div
                  key={t.name}
                  onClick={() => navigate(`/data-context/${connId}/tables/${t.name}`)}
                  className="grid grid-cols-[1fr_1.5fr_2fr] items-center px-6 py-3.5 border-b border-[#111] hover:bg-[#141414] cursor-pointer group transition-colors"
                >
                  <span className="text-sm text-[#555]">{t.database}</span>
                  <div className="flex items-center gap-2">
                    <TableProperties size={14} className="text-[#444] shrink-0" />
                    <span className="font-semibold text-white text-sm group-hover:text-[#F06543] transition-colors">
                      {t.name}
                    </span>
                  </div>
                  <span className="text-sm text-[#555]">No description yet.</span>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {(tab === 'metrics' || tab === 'queries') && (
        <div className="flex flex-col items-center justify-center py-24 text-[#444]">
          {tab === 'metrics' ? <BarChart2 size={40} className="mb-4 opacity-20" /> : <CheckCircle2 size={40} className="mb-4 opacity-20" />}
          <p className="text-sm">No {tab === 'metrics' ? 'metrics' : 'verified queries'} yet.</p>
        </div>
      )}
    </Layout>
  );
};

export default DataContextConnection;
