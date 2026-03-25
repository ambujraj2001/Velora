import { useState, useEffect } from 'react';
import FragmentRenderer from '../components/FragmentRenderer';
import type { AnyFragment } from '../types';
import { api } from '../lib/appConfig';
import Layout from '../components/Layout';
import { LayoutDashboard, RefreshCw, Trash2, ChevronDown, ChevronRight } from 'lucide-react';

type DashboardRecord = {
  id: string;
  name: string;
  description?: string;
  fragments: AnyFragment[];
};

export default function Dashboards() {
  const [dashboards, setDashboards] = useState<DashboardRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState<Record<string, boolean>>({});
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const toggleExpand = (id: string) => {
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const fetchDashboards = async () => {
    try {
      const res = await api.get('/dashboards');
      setDashboards(res.data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboards();
  }, []);

  const handleRefresh = async (id: string) => {
    setRefreshing((prev) => ({ ...prev, [id]: true }));
    try {
      await api.post(`/dashboards/${id}/refresh`);
      await fetchDashboards();
    } catch (err) {
      console.error(err);
    } finally {
      setRefreshing((prev) => ({ ...prev, [id]: false }));
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this dashboard?')) return;
    try {
      await api.delete(`/dashboards/${id}`);
      await fetchDashboards();
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <Layout noPadding>
      <div className="p-8 lg:p-10">
        <header className="mb-10 flex flex-col gap-1">
        <div className="flex items-center gap-2 text-sm text-[#666]">
          <LayoutDashboard size={20} />
          <span>Dashboards</span>
        </div>
        <p className="text-[#888]">View and manage your saved analytical views.</p>
      </header>

      {loading ? (
        <div className="flex h-64 flex-col items-center justify-center text-[#444]">
          <RefreshCw className="mb-4 animate-spin" size={32} />
          <span>Loading dashboards...</span>
        </div>
      ) : dashboards.length === 0 ? (
        <div className="flex h-64 flex-col items-center justify-center rounded-2xl border border-dashed border-[#222] text-[#444]">
          <LayoutDashboard size={48} className="mb-4 opacity-20" />
          <p>No dashboards saved yet.</p>
        </div>
      ) : (
        <div className="grid gap-6">
          {dashboards.map((db) => (
            <div
              key={db.id}
              className={`rounded-2xl border border-[#222] bg-[#141414] transition-all overflow-hidden ${expanded[db.id] ? 'p-8' : 'p-4 px-6'}`}
            >
              <div className={`flex items-center justify-between ${expanded[db.id] ? 'mb-8' : ''}`}>
                <div 
                  className="flex items-center gap-4 cursor-pointer group"
                  onClick={() => toggleExpand(db.id)}
                >
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#222] text-[#F06543] group-hover:bg-[#333] transition-all">
                    {expanded[db.id] ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-white group-hover:text-[#F06543] transition-colors">{db.name}</h3>
                    {expanded[db.id] && db.description && <p className="mt-1 text-sm text-[#666]">{db.description}</p>}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => handleRefresh(db.id)}
                    disabled={refreshing[db.id]}
                    className="flex h-9 items-center gap-2 rounded-lg bg-[#222] px-4 text-xs font-bold text-white transition hover:bg-[#333] disabled:opacity-50"
                  >
                    <RefreshCw size={12} className={refreshing[db.id] ? 'animate-spin' : ''} />
                    {refreshing[db.id] ? 'Refreshing...' : 'Refresh'}
                  </button>
                  <button
                    onClick={() => handleDelete(db.id)}
                    className="flex h-9 items-center gap-2 rounded-lg bg-red-500/10 px-4 text-xs font-bold text-red-500 transition hover:bg-red-500/20"
                    title="Delete Dashboard"
                  >
                    <Trash2 size={12} />
                    Delete
                  </button>
                </div>
              </div>

              {expanded[db.id] && (
                <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 animate-in fade-in slide-in-from-top-2 duration-300">
                  {db.fragments.map((frag, idx: number) => (
                    <div key={idx} className="rounded-xl border border-white/5 bg-[#0D0D0D] overflow-hidden">
                      <FragmentRenderer fragment={frag} />
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
      </div>
    </Layout>
  );
}
