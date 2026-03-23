import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowUp } from "lucide-react";
import { motion } from "framer-motion";
import { api } from "../lib/appConfig";
import Layout from "../components/Layout";

const Home: React.FC = () => {
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || loading) return;

    setLoading(true);
    try {
      const res = await api.post("/chat", {
        userInput: input,
      });
      const convId = res.data.conversationId;
      if (convId) {
        navigate(`/c/${convId}`, {
          state: { initialFragments: res.data.fragments },
        });
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Layout>
      <div className="relative flex flex-1 flex-col items-center justify-center -mt-20">
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          className="flex flex-col items-center gap-12 w-full max-w-3xl"
        >
          <h2 className="text-4xl md:text-5xl font-bold tracking-tight text-white/90">
            How can I help you today?
          </h2>

          <form onSubmit={handleSubmit} className="relative w-full group">
            <div className="absolute inset-0 rounded-2xl bg-linear-to-br from-[#F06543] to-[#FF8A70] blur-2xl opacity-5 group-focus-within:opacity-15 transition-opacity duration-500" />
            <div className="relative flex min-h-35 flex-col rounded-[2.5rem] border border-[#222] bg-[#141414] p-6 shadow-2xl backdrop-blur-sm focus-within:border-[#F06543]/40 transition-colors">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask anything..."
                className="flex-1 resize-none bg-transparent p-4 text-xl outline-none placeholder:text-[#333] selection:bg-[#F06543]/30"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSubmit(e);
                  }
                }}
              />
              <div className="flex items-center justify-between px-4 pb-2">
                <div className="text-[10px] uppercase font-bold tracking-wider text-[#333]">
                  Supports SQL & Charts
                </div>
                <button
                  type="submit"
                  disabled={loading || !input.trim()}
                  className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#F06543] text-white transition-all transform hover:scale-105 active:scale-95 disabled:opacity-30 disabled:hover:scale-100"
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

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 w-full">
            {[
              "Total Revenue Trend",
              "Top Customers",
              "Product Sales",
              "Growth Rate",
            ].map((suggestion, i) => (
              <button
                key={i}
                onClick={() => setInput(suggestion)}
                className="rounded-xl border border-[#1A1A1A] bg-[#111] p-3 text-xs text-[#555] hover:bg-[#1A1A1A] hover:text-[#888] transition-colors"
              >
                {suggestion}
              </button>
            ))}
          </div>
        </motion.div>
      </div>
    </Layout>
  );
};

export default Home;
