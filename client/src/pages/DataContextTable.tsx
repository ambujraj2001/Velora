import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { TableProperties, ChevronRight, Search, GitFork } from 'lucide-react';
import { api } from '../lib/appConfig';
import Layout from '../components/Layout';

interface Column {
  name: string;
  type: string;
  default_type: string;
  comment: string;
}

interface Connection {
  id: string;
  name: string;
  database: string;
}

type Tab = 'overview' | 'columns' | 'relations';

const PAGE_SIZE = 10;

const DataContextTable: React.FC = () => {
  const { connId, tableName } = useParams<{ connId: string; tableName: string }>();
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>('overview');
  const [connection, setConnection] = useState<Connection | null>(null);
  const [columns, setColumns] = useState<Column[]>([]);
  const [columnsLoading, setColumnsLoading] = useState(false);
  const [colSearch, setColSearch] = useState('');
  const [page, setPage] = useState(1);

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
    if (!connId || !tableName) return;
    const fetchCols = async () => {
      setColumnsLoading(true);
      try {
        const res = await api.get(`/connections/${connId}/tables/${tableName}/columns`);
        setColumns(res.data || []);
      } catch (err) {
        console.error(err);
      } finally {
        setColumnsLoading(false);
      }
    };
    fetchCols();
  }, [connId, tableName]);

  const filteredCols = columns.filter((c) =>
    c.name.toLowerCase().includes(colSearch.toLowerCase()),
  );
  const totalPages = Math.max(1, Math.ceil(filteredCols.length / PAGE_SIZE));
  const pagedCols = filteredCols.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const tabs: { key: Tab; label: string; count?: number }[] = [
    { key: 'overview', label: 'Overview' },
    { key: 'columns', label: 'Columns', count: columns.length },
    { key: 'relations', label: 'Relations', count: 0 },
  ];

  return (
    <Layout>
      {/* Breadcrumb */}
      <div className="mb-8 flex items-center gap-2 text-sm text-[#555] flex-wrap">
        <button onClick={() => navigate('/data-context')} className="hover:text-white transition-colors">
          Data Context
        </button>
        <ChevronRight size={14} />
        <button onClick={() => navigate(`/data-context/${connId}`)} className="hover:text-white transition-colors flex items-center gap-1.5">
          <span className="text-[#F06543]">|||</span> {connection?.name || '...'}
        </button>
        <ChevronRight size={14} />
        <span className="text-[#555]">{connection?.database || 'default'}</span>
        <ChevronRight size={14} />
        <span className="text-white">{tableName}</span>
      </div>

      {/* Header */}
      <div className="mb-8 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <TableProperties size={22} className="text-[#888]" />
          <h1 className="text-2xl font-bold text-white">{tableName}</h1>
        </div>
        <span className="rounded-lg border border-[#222] bg-[#141414] px-3 py-1.5 text-[11px] text-[#555] font-semibold uppercase tracking-widest">
          No versions
        </span>
      </div>

      {/* Tabs */}
      <div className="mb-8 flex items-center gap-0 border-b border-[#1A1A1A]">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => { setTab(t.key); setPage(1); }}
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

      {/* Overview Tab */}
      {tab === 'overview' && (
        <div className="space-y-6 max-w-2xl">
          {[['Description', 'No description yet.'], ['Grain', 'No grain yet.'], ['Data Scope', 'No data scope yet.']].map(([label, placeholder]) => (
            <div key={label}>
              <h3 className="mb-2 text-sm font-semibold text-[#888]">{label}</h3>
              <div className="rounded-lg border border-[#1A1A1A] bg-[#0D0D0D] px-4 py-3 text-sm text-[#555]">
                {placeholder}
              </div>
            </div>
          ))}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <h3 className="text-sm font-semibold text-[#888]">Annotations</h3>
              <span className="rounded-full bg-[#1A1A1A] px-2 py-0.5 text-[10px] text-[#555] font-bold">0</span>
            </div>
            <p className="text-sm text-[#444]">No annotations yet.</p>
          </div>
        </div>
      )}

      {/* Columns Tab */}
      {tab === 'columns' && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2 text-sm text-white font-semibold">
              Columns
              <span className="rounded-full bg-[#222] px-2 py-0.5 text-[11px] text-[#777] font-bold">
                {filteredCols.length}
              </span>
            </div>
            <div className="relative">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#555]" />
              <input
                value={colSearch}
                onChange={(e) => { setColSearch(e.target.value); setPage(1); }}
                placeholder="Search"
                className="rounded-lg border border-[#222] bg-[#141414] py-2 pl-8 pr-4 text-sm text-white outline-none placeholder:text-[#555] focus:border-[#F06543]/50 transition-colors w-48"
              />
            </div>
          </div>
          <div className="rounded-xl border border-[#222] bg-[#0D0D0D] overflow-hidden">
            <div className="grid grid-cols-[2fr_1.5fr_2fr] px-6 py-3 border-b border-[#1A1A1A]">
              <span className="text-[11px] font-bold uppercase tracking-widest text-[#555]">Name</span>
              <span className="text-[11px] font-bold uppercase tracking-widest text-[#555]">Type</span>
              <span className="text-[11px] font-bold uppercase tracking-widest text-[#555]">Description</span>
            </div>
            {columnsLoading ? (
              <div className="py-12 text-center text-[#555] text-sm">Loading columns...</div>
            ) : pagedCols.length === 0 ? (
              <div className="py-12 text-center text-[#555] text-sm">No columns found.</div>
            ) : (
              pagedCols.map((col) => (
                <div
                  key={col.name}
                  className="grid grid-cols-[2fr_1.5fr_2fr] items-center px-6 py-3.5 border-b border-[#111]"
                >
                  <span className="font-semibold text-white text-sm">{col.name}</span>
                  <span className="text-sm text-[#F06543]/80 font-mono">{col.type}</span>
                  <span className="text-sm text-[#555]">
                    {col.comment || 'No description yet.'}
                  </span>
                </div>
              ))
            )}
          </div>
          {/* Pagination */}
          {filteredCols.length > PAGE_SIZE && (
            <div className="mt-4 flex items-center justify-between text-sm text-[#555]">
              <span>
                Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filteredCols.length)} of {filteredCols.length}
              </span>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="hover:text-white disabled:opacity-30 transition-colors"
                >
                  Previous
                </button>
                <span className="text-[#444]">Page {page} of {totalPages}</span>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="hover:text-[#F06543] disabled:opacity-30 transition-colors font-semibold"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Relations Tab */}
      {tab === 'relations' && (
        <div className="flex flex-col items-center justify-center py-24 text-[#444]">
          <GitFork size={40} className="mb-4 opacity-20" />
          <p className="text-sm">No relations defined yet.</p>
        </div>
      )}
    </Layout>
  );
};

export default DataContextTable;
