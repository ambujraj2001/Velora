import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowUp, Sparkles } from 'lucide-react';
import { motion } from 'framer-motion';
import { api } from '../lib/appConfig';
import Layout from '../components/Layout';

const Home: React.FC = () => {
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!input.trim() || loading) return;

    setLoading(true);
    try {
      const res = await api.post('/chat', {
        userInput: input,
      });
      const convId = res.data.conversationId;
      if (convId) {
        navigate(`/c/${convId}`, {
          state: {
            initialFragments: res.data.fragments,
            initialUserMsg: input,
          },
        });
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const suggestions = [
    "Analyze Revenue Trends",
    "Find Top Customers",
    "Visualize Product Sales",
    "Check Growth Metrics"
  ];

  return (
    <Layout>
      {/* Background Decor */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-200 h-100 bg-[#F06543]/5 blur-[120px] rounded-full" />
      </div>

      <div className="relative flex flex-1 flex-col items-center justify-center -mt-24 z-10 px-6">
        <div className="w-full max-w-3xl flex flex-col items-center">
          {/* Heading */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="text-center mb-12"
          >
            <h1 className="flex flex-col gap-3">
              <span className="text-xl md:text-2xl text-[#666] font-medium tracking-tight">Hi, I'm <span className="text-[#F06543]">Velora</span>.</span>
              <span className="text-5xl md:text-7xl font-bold tracking-tight text-white/95">
                Ask your data anything.
              </span>
            </h1>
            <p className="mt-6 text-[#888] text-lg max-w-xl mx-auto leading-relaxed">
              Query your database, generate dashboards, and visualize insights — all with AI.
            </p>
          </motion.div>

          {/* Input Box */}
          <form onSubmit={handleSubmit} className="relative w-full group">
            {/* Focus Glow */}
            <div className="absolute -inset-0.5 rounded-[2.6rem] bg-linear-to-r from-[#F06543]/30 to-[#F06543]/10 opacity-0 blur-xl group-focus-within:opacity-40 transition-opacity duration-700" />
            
            <div className="relative flex min-h-40 flex-col rounded-[2.5rem] border border-[#222] bg-[#121212]/80 p-6 shadow-3xl backdrop-blur-2xl focus-within:border-[#F06543]/50 focus-within:bg-[#141414] transition-all duration-300">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="e.g. Show revenue trend for last 6 months"
                className="flex-1 resize-none bg-transparent p-4 text-xl md:text-2xl text-white outline-none placeholder:text-[#333] selection:bg-[#F06543]/30 leading-tight"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSubmit();
                  }
                }}
              />
              <div className="flex items-center justify-between px-4 pb-2 mt-4">
                <div className="flex items-center gap-2 text-[11px] uppercase font-bold tracking-[0.2em] text-[#444]">
                  <Sparkles size={14} className="text-[#F06543]/50" />
                  Type natural language or SQL
                </div>
                <button
                  type="submit"
                  disabled={loading || !input.trim()}
                  className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#F06543] text-white transition-all transform hover:scale-105 hover:bg-[#D45131] active:scale-95 disabled:opacity-20 disabled:hover:scale-100 shadow-2xl shadow-[#F06543]/20"
                >
                  {loading ? (
                    <div className="h-6 w-6 animate-spin rounded-full border-2 border-white/20 border-t-white" />
                  ) : (
                    <ArrowUp size={24} strokeWidth={3} />
                  )}
                </button>
              </div>
            </div>
          </form>

          {/* Suggestion Buttons */}
          <div className="mt-12 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 w-full">
            {suggestions.map((suggestion, i) => (
              <motion.button
                key={i}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.2 + (i * 0.1) }}
                onClick={() => setInput(suggestion)}
                className="group flex flex-col items-center justify-center rounded-2xl border border-white/5 bg-white/3 p-5 text-sm text-[#888] hover:bg-white/8 hover:border-white/10 hover:text-white transition-all duration-300 transform hover:-translate-y-1"
              >
                <span className="font-semibold text-center">{suggestion}</span>
              </motion.button>
            ))}
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default Home;
