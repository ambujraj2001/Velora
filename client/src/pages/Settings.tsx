import React, { useState, useEffect } from 'react';
import { Settings2, ChevronDown, Plus, Send, X } from 'lucide-react';
import { api } from '../lib/appConfig';
import Layout from '../components/Layout';

interface TeamMember {
  id: string;
  email: string;
  name: string | null;
  role: string;
  status: string;
  created_at: string;
}

const QUERY_MODES = [
  { value: 'ask_every_time', label: 'Ask every time' },
  { value: 'run_without_asking', label: 'Run without asking' },
];

const Settings: React.FC = () => {
  const [queryMode, setQueryMode] = useState('ask_every_time');
  const [modeOpen, setModeOpen] = useState(false);
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [emails, setEmails] = useState<string[]>(['']);
  const [saving, setSaving] = useState(false);
  const [inviting, setInviting] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [settingsRes, teamRes] = await Promise.all([
          api.get('/settings'),
          api.get('/settings/team'),
        ]);
        setQueryMode(settingsRes.data?.query_run_mode || 'ask_every_time');
        setTeam(teamRes.data || []);
      } catch (err) {
        console.error(err);
      }
    };
    fetchData();
  }, []);

  const handleModeChange = async (mode: string) => {
    setQueryMode(mode);
    setModeOpen(false);
    setSaving(true);
    try {
      await api.put('/settings', { query_run_mode: mode });
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const addEmailField = () => setEmails([...emails, '']);
  const removeEmailField = (idx: number) => setEmails(emails.filter((_, i) => i !== idx));
  const updateEmail = (idx: number, val: string) => {
    const copy = [...emails];
    copy[idx] = val;
    setEmails(copy);
  };

  const handleInvite = async () => {
    const valid = emails.filter((e) => e.trim().length > 0);
    if (valid.length === 0) return;
    setInviting(true);
    try {
      await api.post('/settings/invite', { emails: valid });
      setEmails(['']);
      // Refresh team
      const teamRes = await api.get('/settings/team');
      setTeam(teamRes.data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setInviting(false);
    }
  };

  const formatDate = (d: string) => {
    const date = new Date(d);
    return date.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  return (
    <Layout>
      <header className="mb-10 flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <Settings2 size={22} className="text-[#888]" />
          <h1 className="text-2xl font-bold text-white">Settings</h1>
        </div>
      </header>

      {/* Agent Section */}
      <section className="mb-8 rounded-xl border border-[#222] bg-[#141414] p-6">
        <h2 className="mb-5 text-sm font-bold text-white">Agent</h2>
        <div className="flex items-center gap-4">
          <span className="text-sm font-semibold text-[#888]">Query Run Mode</span>
          <div className="relative">
            <button
              onClick={() => setModeOpen(!modeOpen)}
              className="flex items-center gap-2 rounded-lg border border-[#333] bg-[#1A1A1A] px-4 py-2 text-sm text-white transition-colors hover:border-[#444] min-w-50 justify-between"
            >
              {QUERY_MODES.find((m) => m.value === queryMode)?.label}
              <ChevronDown size={14} className={`text-[#555] transition-transform ${modeOpen ? 'rotate-180' : ''}`} />
            </button>
            {modeOpen && (
              <div className="absolute left-0 top-full z-20 mt-1 w-full overflow-hidden rounded-lg border border-[#333] bg-[#1A1A1A] shadow-xl">
                {QUERY_MODES.map((m) => (
                  <button
                    key={m.value}
                    onClick={() => handleModeChange(m.value)}
                    className={`flex w-full items-center gap-2 px-4 py-2.5 text-sm transition-colors hover:bg-[#222] ${
                      queryMode === m.value ? 'text-white' : 'text-[#888]'
                    }`}
                  >
                    {queryMode === m.value && <span className="text-[#F06543]">✓</span>}
                    {m.label}
                  </button>
                ))}
              </div>
            )}
          </div>
          {saving && <span className="text-xs text-[#555]">Saving...</span>}
        </div>
      </section>

      {/* Team Section */}
      <section className="mb-8 rounded-xl border border-[#222] bg-[#141414] p-6">
        <h2 className="mb-5 text-sm font-bold text-white">Team</h2>
        <div className="overflow-hidden rounded-lg border border-[#222]">
          <div className="grid grid-cols-[2fr_1fr_1fr_1.5fr] px-5 py-3 border-b border-[#1A1A1A] bg-[#0D0D0D]">
            <span className="text-[10px] font-bold uppercase tracking-widest text-[#555]">Person</span>
            <span className="text-[10px] font-bold uppercase tracking-widest text-[#555]">Role</span>
            <span className="text-[10px] font-bold uppercase tracking-widest text-[#555]">Status</span>
            <span className="text-[10px] font-bold uppercase tracking-widest text-[#555]">Added</span>
          </div>
          {team.length === 0 ? (
            <div className="py-8 text-center text-sm text-[#444]">No team members yet.</div>
          ) : (
            team.map((m) => (
              <div key={m.id} className="grid grid-cols-[2fr_1fr_1fr_1.5fr] items-center px-5 py-3.5 border-b border-[#111] last:border-b-0">
                <div className="flex flex-col">
                  <span className="text-sm font-semibold text-white">{m.name || m.email.split('@')[0]}</span>
                  <span className="text-xs text-[#555]">{m.email}</span>
                </div>
                <span className="text-sm text-[#888]">{m.role}</span>
                <span
                  className={`inline-flex w-fit items-center rounded px-2 py-0.5 text-xs font-bold ${
                    m.status === 'Active'
                      ? 'bg-emerald-500/10 text-emerald-500'
                      : 'bg-amber-500/10 text-amber-500'
                  }`}
                >
                  {m.status}
                </span>
                <span className="text-sm text-[#555]">{formatDate(m.created_at)}</span>
              </div>
            ))
          )}
        </div>
      </section>

      {/* Invite Section */}
      <section className="rounded-xl border border-[#222] bg-[#141414] p-6">
        <h2 className="mb-5 text-sm font-bold text-white">Invite Teammates</h2>
        <div className="rounded-lg border border-[#222] bg-[#0D0D0D] p-5">
          <span className="mb-3 block text-xs font-bold uppercase tracking-widest text-[#555]">Emails</span>
          <div className="space-y-3">
            {emails.map((email, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <input
                  value={email}
                  onChange={(e) => updateEmail(idx, e.target.value)}
                  placeholder="teammate@gmail.com"
                  className="flex-1 rounded-lg border border-[#222] bg-[#141414] px-4 py-2.5 text-sm text-white outline-none placeholder:text-[#444] focus:border-[#F06543]/50 transition-colors"
                />
                {emails.length > 1 && (
                  <button onClick={() => removeEmailField(idx)} className="text-[#444] hover:text-red-500 transition-colors p-1">
                    <X size={16} />
                  </button>
                )}
              </div>
            ))}
          </div>
          <div className="mt-4 flex items-center gap-3">
            <button
              onClick={addEmailField}
              className="flex items-center gap-1.5 rounded-lg border border-[#333] bg-[#1A1A1A] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#222]"
            >
              <Plus size={14} />
              Add another
            </button>
            <button
              onClick={handleInvite}
              disabled={inviting}
              className="flex items-center gap-1.5 rounded-lg bg-[#F06543]/90 px-4 py-2 text-sm font-semibold text-white transition-all hover:bg-[#F06543] active:scale-95 disabled:opacity-50"
            >
              <Send size={14} />
              {inviting ? 'Sending...' : 'Send Invites'}
            </button>
          </div>
        </div>
      </section>
    </Layout>
  );
};

export default Settings;
