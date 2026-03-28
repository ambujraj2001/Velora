import React, { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Database, ArrowLeft, ShieldCheck, FileText } from 'lucide-react';
import { api } from '../lib/appConfig';
import Layout from '../components/Layout';

const NewConnection: React.FC = () => {
  const [searchParams] = useSearchParams();
  const source = searchParams.get('source') || 'ClickHouse';
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  // Separate state for Database vs. CSV
  const [form, setForm] = useState({
    name: '',
    host: '',
    port: source === 'ClickHouse' ? '8443' : '5432',
    database: 'default',
    username: '',
    password: '',
    useSsl: true,
  });

  const [csvForm, setCsvForm] = useState({
    name: '',
    file_url: '',
    description: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    try {
      if (source === 'CSV') {
        // --- CSV VALIDATION ---
        if (!csvForm.name.trim() || !csvForm.file_url.trim() || !csvForm.description.trim()) {
          throw new Error('All fields (Name, URL, Description) are required.');
        }
        if (!csvForm.file_url.startsWith('https://')) {
          throw new Error('File URL must start with https://');
        }

        // --- CSV SUBMIT ---
        await api.post('/connections/csv', {
          name: csvForm.name,
          file_url: csvForm.file_url,
          description: csvForm.description,
        });
      } else {
        // --- DATABASE SUBMIT ---
        await api.post('/connections', {
          ...form,
          type: source.toLowerCase(),
          port: Number(form.port),
        });
      }
      navigate('/data-sources');
    } catch (err: unknown) {
      console.error(err);
      let errorMsg = 'Failed to save connection.';

      if (err instanceof Error) {
        errorMsg = err.message;
      }
      
      const axiosErr = err as { response?: { data?: { error?: string } } };
      if (axiosErr.response?.data?.error) {
        errorMsg = axiosErr.response.data.error;
      }

      setMessage(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  const isCsv = source === 'CSV';

  return (
    <Layout>
      <header className="mb-10">
        <button
          onClick={() => navigate('/data-sources')}
          className="mb-8 flex items-center gap-2 text-sm text-[#666] transition hover:text-[#999]"
        >
          <ArrowLeft size={16} />
          <span>Data Sources</span>
          <span>&gt;</span>
          <span className="text-[#999]">New</span>
        </button>

        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-[#FAF0E6] p-2 text-[#F06543] bg-opacity-10">
              {isCsv ? <FileText size={24} className="text-[#10B981]" /> : <Database size={24} />}
            </div>
            <h1 className="text-2xl font-bold text-white">New {source} Connection</h1>
          </div>
          <p className="mt-1 text-[#666]">
            {isCsv ? 'Connect a public remote CSV file.' : `Create a new connection to your ${source} database.`}
          </p>
        </div>
      </header>

      {/* Network Access Alert / CSV Hint */}
      {isCsv ? (
        <div className="mb-10 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-5">
          <div className="flex items-center gap-3">
            <div className="rounded-full bg-emerald-500/10 p-2 text-emerald-500">
              <FileText size={18} />
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-semibold text-white">Public Access</span>
              <p className="text-xs text-[#666]">
                Only public CSV URLs are supported. Ensure the file is accessible via HTTPS.
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div className="mb-10 rounded-xl border border-[#222] bg-[#141414] p-5">
          <div className="flex items-center gap-3">
            <div className="rounded-full bg-[#1A1A1A] p-2 text-[#444]">
              <ShieldCheck size={18} />
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-semibold text-white">Network access</span>
              <p className="text-xs text-[#666]">
                You may need to whitelist Velora's public IP before testing this connection.
              </p>
            </div>
            <div className="ml-auto flex items-center gap-2 rounded-lg bg-[#222] px-3 py-1.5 text-xs text-white">
              <span className="font-mono">13.234.4.18</span>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
                <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
              </svg>
            </div>
          </div>
        </div>
      )}

      <div className="max-w-2xl rounded-2xl border border-[#222] bg-[#141414] p-8 shadow-xl">
        <h2 className="mb-6 text-sm font-bold uppercase tracking-widest text-[#444]">
          {source} Connection Details
        </h2>

        <form onSubmit={handleSubmit} className="grid gap-6">
          {isCsv ? (
            // --- CSV FIELDS ---
            <>
              <label className="flex flex-col gap-2 text-xs font-bold uppercase tracking-widest text-[#444]">
                Connection Name
                <input
                  required
                  value={csvForm.name}
                  onChange={(e) => setCsvForm({ ...csvForm, name: e.target.value })}
                  className="rounded-xl border border-[#2A2A2A] bg-[#111] px-4 py-3 text-sm text-white outline-none focus:border-[#F06543]/50 transition-colors"
                  placeholder="Ex. Marketing Sales 2024"
                />
              </label>
              <label className="flex flex-col gap-2 text-xs font-bold uppercase tracking-widest text-[#444]">
                CSV Public URL
                <input
                  required
                  value={csvForm.file_url}
                  onChange={(e) => setCsvForm({ ...csvForm, file_url: e.target.value })}
                  className="rounded-xl border border-[#2A2A2A] bg-[#111] px-4 py-3 text-sm text-white outline-none focus:border-[#F06543]/50 transition-colors"
                  placeholder="https://example.com/data.csv"
                />
              </label>
              <label className="flex flex-col gap-2 text-xs font-bold uppercase tracking-widest text-[#444]">
                Description
                <textarea
                  required
                  rows={4}
                  value={csvForm.description}
                  onChange={(e) => setCsvForm({ ...csvForm, description: e.target.value })}
                  className="rounded-xl border border-[#2A2A2A] bg-[#111] px-4 py-3 text-sm text-white outline-none focus:border-[#F06543]/50 transition-colors resize-none"
                  placeholder="Describe what data this CSV contains..."
                />
              </label>
            </>
          ) : (
            // --- DATABASE FIELDS (Legacy) ---
            <>
              <div className="grid gap-4 md:grid-cols-2">
                <label className="flex flex-col gap-2 text-xs font-bold uppercase tracking-widest text-[#444]">
                  Connection Name
                  <input
                    required
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    className="rounded-xl border border-[#2A2A2A] bg-[#111] px-4 py-3 text-sm text-white outline-none focus:border-[#F06543]/50 transition-colors"
                    placeholder="Ex. Revenue Warehouse"
                  />
                </label>
                <label className="flex flex-col gap-2 text-xs font-bold uppercase tracking-widest text-[#444]">
                  Host
                  <input
                    required
                    value={form.host}
                    onChange={(e) => setForm({ ...form, host: e.target.value })}
                    className="rounded-xl border border-[#2A2A2A] bg-[#111] px-4 py-3 text-sm text-white outline-none focus:border-[#F06543]/50 transition-colors"
                    placeholder="clickhouse.company.com"
                  />
                </label>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <label className="flex flex-col gap-2 text-xs font-bold uppercase tracking-widest text-[#444]">
                  HTTP Port
                  <input
                    required
                    value={form.port}
                    onChange={(e) => setForm({ ...form, port: e.target.value })}
                    className="rounded-xl border border-[#2A2A2A] bg-[#111] px-4 py-3 text-sm text-white outline-none focus:border-[#F06543]/50 transition-colors"
                    placeholder="8443"
                  />
                </label>
                <label className="flex flex-col gap-2 text-xs font-bold uppercase tracking-widest text-[#444]">
                  Database (optional)
                  <input
                    value={form.database}
                    onChange={(e) => setForm({ ...form, database: e.target.value })}
                    className="rounded-xl border border-[#2A2A2A] bg-[#111] px-4 py-3 text-sm text-white outline-none focus:border-[#F06543]/50 transition-colors"
                    placeholder="default"
                  />
                </label>
              </div>

              <label className="flex flex-col gap-2 text-xs font-bold uppercase tracking-widest text-[#444]">
                Username
                <input
                  required
                  value={form.username}
                  onChange={(e) => setForm({ ...form, username: e.target.value })}
                  className="rounded-xl border border-[#2A2A2A] bg-[#111] px-4 py-3 text-sm text-white outline-none focus:border-[#F06543]/50 transition-colors"
                  placeholder="readonly_user"
                />
              </label>

              <label className="flex flex-col gap-2 text-xs font-bold uppercase tracking-widest text-[#444]">
                Password
                <input
                  required
                  type="password"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  className="rounded-xl border border-[#2A2A2A] bg-[#111] px-4 py-3 text-sm text-white outline-none focus:border-[#F06543]/50 transition-colors"
                  placeholder="••••••••"
                />
              </label>

              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="ssl"
                  checked={form.useSsl}
                  onChange={(e) => setForm({ ...form, useSsl: e.target.checked })}
                  className="h-4 w-4 rounded border-[#2A2A2A] bg-[#111] accent-[#F06543]"
                />
                <label htmlFor="ssl" className="text-sm font-medium text-[#888]">
                  Use SSL
                </label>
              </div>
            </>
          )}

          <div className="mt-4 flex items-center gap-3">
            <button
              type="submit"
              disabled={loading}
              className={`rounded-xl px-8 py-3.5 font-bold text-white transition disabled:opacity-50 ${
                isCsv ? 'bg-emerald-600 hover:bg-emerald-500' : 'bg-[#F06543] hover:bg-[#D45131]'
              }`}
            >
              {loading ? 'Saving...' : 'Save Connection'}
            </button>
            <button
              type="button"
              onClick={() => navigate('/data-sources')}
              className="rounded-xl bg-[#222] px-8 py-3.5 font-bold text-white transition hover:bg-[#333]"
            >
              Cancel
            </button>
          </div>

          {message && (
            <p className="rounded-lg bg-red-500/10 p-3 text-sm text-red-500 border border-red-500/20">
              {message}
            </p>
          )}
        </form>
      </div>
    </Layout>
  );
};

export default NewConnection;
