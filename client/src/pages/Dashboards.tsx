import { useState, useEffect } from 'react';
import FragmentRenderer from '../components/FragmentRenderer';
import type { AnyFragment } from '../types';
import { api } from '../lib/appConfig';
import Layout from '../components/Layout';
import { LayoutDashboard, RefreshCw } from 'lucide-react';

type DashboardRecord = {
  id: string;
  name: string;
  description?: string;
  fragments: AnyFragment[];
};

export default function Dashboards() {
  const [dashboards, setDashboards] = useState<DashboardRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDashboards = async () => {
      try {
        const res = await api.get('/dashboard');
        setDashboards(res.data || []);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchDashboards();
  }, []);

  const handleRefresh = async (id: string) => {
    try {
      await api.post(`/dashboard/${id}/refresh`);
      // Re-fetch or update state
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <Layout>
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
        <div className="grid gap-8">
          {dashboards.map((db) => (
            <div
              key={db.id}
              className="rounded-2xl border border-[#222] bg-[#141414] p-8 shadow-xl"
            >
              <div className="mb-8 flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-bold text-white">{db.name}</h3>
                  <p className="mt-1 text-sm text-[#666]">{db.description}</p>
                </div>
                <button
                  onClick={() => handleRefresh(db.id)}
                  className="flex items-center gap-2 rounded-lg bg-[#222] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#333]"
                >
                  <RefreshCw size={14} />
                  Refresh
                </button>
              </div>
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                {db.fragments.map((frag, idx: number) => (
                  <div key={idx} className="rounded-xl border border-[#222] bg-[#0D0D0D] p-6">
                    <FragmentRenderer fragment={frag} />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </Layout>
  );
}
