import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Grid3x3, Search, BarChart4, ChevronRight } from 'lucide-react';
import { api } from '../lib/appConfig';
import Layout from '../components/Layout';

interface Connection {
  id: string;
  name: string;
  type: string;
  host: string;
  database: string;
}

const DataContext: React.FC = () => {
  const [connections, setConnections] = useState<Connection[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    const fetch = async () => {
      try {
        const res = await api.get('/connections');
        setConnections(res.data || []);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetch();
  }, []);

  const filtered = connections.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <Layout>
      <header className="mb-10 flex flex-col gap-1">
        <div className="flex items-center gap-2 text-sm text-[#666]">
          <Grid3x3 size={18} />
          <span>Data Context</span>
        </div>
        <p className="text-[#888]">Browse context and definitions for your connected data assets.</p>
      </header>

      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2 text-sm text-white font-semibold">
          Connections
          <span className="ml-1 rounded-full bg-[#222] px-2 py-0.5 text-[11px] text-[#888] font-bold">
            {filtered.length}
          </span>
        </div>
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#555]" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search"
            className="rounded-lg border border-[#222] bg-[#141414] py-2 pl-9 pr-4 text-sm text-white outline-none placeholder:text-[#555] focus:border-[#F06543]/50 transition-colors w-56"
          />
        </div>
      </div>

      <div className="rounded-xl border border-[#222] bg-[#0D0D0D] overflow-hidden">
        <div className="grid grid-cols-[2fr_3fr] px-6 py-3 border-b border-[#1A1A1A]">
          <span className="text-[11px] font-bold uppercase tracking-widest text-[#555]">Name</span>
          <span className="text-[11px] font-bold uppercase tracking-widest text-[#555]">Description</span>
        </div>
        {loading ? (
          <div className="py-16 text-center text-[#555] text-sm">Loading connections...</div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center text-[#555] text-sm">No connections found.</div>
        ) : (
          filtered.map((conn) => (
            <div
              key={conn.id}
              onClick={() => navigate(`/data-context/${conn.id}`)}
              className="grid grid-cols-[2fr_3fr] items-center px-6 py-4 border-b border-[#141414] hover:bg-[#141414] cursor-pointer group transition-colors"
            >
              <div className="flex items-center gap-3">
                <BarChart4 size={18} className="text-[#F06543] shrink-0" />
                <span className="font-semibold text-white text-sm group-hover:text-[#F06543] transition-colors">
                  {conn.name}
                </span>
                <ChevronRight size={14} className="text-[#444] opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
              <span className="text-sm text-[#555]">No description yet.</span>
            </div>
          ))
        )}
      </div>
    </Layout>
  );
};

export default DataContext;
