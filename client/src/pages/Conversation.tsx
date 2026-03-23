import { useEffect, useRef, useState } from 'react';
import { useLocation, useParams } from 'react-router-dom';
import { Send, Loader2, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import axios from 'axios';
import type { AnyFragment } from '../types';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { api } from '../lib/appConfig';
import Layout from '../components/Layout';
import FragmentRenderer from '../components/FragmentRenderer';


type Message = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  fragments: AnyFragment[];
};

type LocationState = {
  initialFragments?: AnyFragment[];
};

export default function Conversation() {
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [connectionId, setConnectionId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const initialFragments = (location.state as LocationState | null)?.initialFragments;

  useEffect(() => {
    const fetchMessages = async () => {
      if (!id) return;

      try {
        const res = await api.get(`/conversations/${id}/messages`);
        
        // Some messages might have the connection context (from Supabase it is snake_case)
        const firstWithConn = res.data?.find((m: { connection_id?: string; connectionId?: string }) => m.connection_id || m.connectionId);
        if (firstWithConn) setConnectionId(firstWithConn.connection_id || firstWithConn.connectionId);


        const normalized: Message[] = Array.isArray(res.data)


          ? res.data.map((m: { id?: string; role?: string; content?: string; fragments?: AnyFragment[] }, idx: number) => ({
              id: m.id || `${id}-${idx}`,
              role: (m.role === 'user' ? 'user' : 'assistant') as 'user' | 'assistant',
              content: m.content || '',
              fragments: m.fragments || [],
            }))
          : [];

        if (normalized.length > 0) {
          setMessages(normalized);
        } else if (initialFragments?.length) {
          setMessages([
            {
              id: `${id}-initial`,
              role: 'assistant',
              content: '',
              fragments: initialFragments,
            },
          ]);
        }
      } catch (err) {
        console.error(err);
      }
    };

    fetchMessages();
  }, [id, initialFragments]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const sendMessage = async () => {
    if (!input.trim() || loading || !id) return;

    const userMsg = input;
    setInput('');
    setLoading(true);

    const tempMsg: Message = {
      id: `${Date.now()}-user`,
      role: 'user',
      content: userMsg,
      fragments: [],
    };
    setMessages((prev) => [...prev, tempMsg]);

    try {
      const res = await api.post('/chat', {
        conversationId: id,
        userInput: userMsg,
      });

      if (res.data.connectionId) setConnectionId(res.data.connectionId);

      setMessages((prev) => [
        ...prev,
        {
          id: `${Date.now()}-assistant`,
          role: 'assistant',
          content: '',
          fragments: res.data.fragments || [],
        },
      ]);

    } catch (err) {
      console.error(err);
      setMessages((prev) => [
        ...prev,
        {
          id: `${Date.now()}-error`,
          role: 'assistant',
          content: axios.isAxiosError(err) ? err.response?.data?.error || 'Failed to connect.' : 'An error occurred.',
          fragments: [],
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Layout noPadding>
      <div className="flex h-full flex-col">

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-8 scrollbar-hide">
          <div className="mx-auto max-w-4xl space-y-10">
            <AnimatePresence mode="popLayout">
              {messages.map((msg) => (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  key={msg.id}
                  className="flex w-full flex-col mt-4"
                >
                  <div className={`flex w-full gap-4 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                    {/* Icon section */}
                    <div className="flex-shrink-0 w-9 h-9">
                        {msg.role === 'assistant' ? (
                            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#1A1A1A] text-[#F06543] border border-white/5 shadow-xl">
                               <Sparkles size={18} />
                            </div>
                        ) : (
                            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#F06543]/10 text-[#F06543] border border-[#F06543]/20 shadow-xl">
                               <span className="text-[10px] font-black italic">YOU</span>
                            </div>
                        )}
                    </div>
                    
                    {/* Content Section */}
                    <div className={`flex flex-col gap-2 max-w-[80%] ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                        {msg.content && (
                          <div
                            className={`rounded-2xl px-6 py-4 shadow-2xl relative text-[15px] leading-relaxed border transition-all ${
                              msg.role === 'user'
                                ? 'bg-linear-to-br from-[#F06543] to-[#D45131] border-white/10 text-white shadow-[#F06543]/30'
                                : 'bg-[#121212] border-white/5 text-zinc-100 shadow-black'
                            }`}
                          >
                            <ReactMarkdown remarkPlugins={[remarkGfm]}>
                              {msg.content}
                            </ReactMarkdown>
                          </div>
                        )}

                        {msg.fragments && msg.fragments.length > 0 && (
                          <div className="mt-2 flex w-full flex-col gap-6 w-full max-w-full overflow-visible">
                            {msg.fragments.map((frag, idx) => (
                              <div key={idx} className="overflow-hidden rounded-2xl border border-white/5 bg-[#0A0A0A] shadow-2xl w-full">
                                <FragmentRenderer fragment={frag} connectionId={connectionId} />
                              </div>
                            ))}
                          </div>
                        )}
                    </div>
                  </div>
                </motion.div>

              ))}
            </AnimatePresence>

            {loading && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-start gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#222] text-[#F06543] border border-[#333]">
                    <Sparkles size={16} className="animate-pulse" />
                </div>
                <div className="flex items-center gap-3 rounded-2xl bg-[#141414]/50 px-5 py-3 text-sm text-[#666] border border-[#222]/50">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Velora is thinking...</span>
                </div>
              </motion.div>
            )}
            <div ref={messagesEndRef} className="h-4" />
          </div>
        </div>

        {/* Input area */}
        <div className="border-t border-white/5 bg-[#0D0D0D]/80 px-6 py-6 backdrop-blur-xl">


          <form 
            onSubmit={(e) => { e.preventDefault(); sendMessage(); }}
            className="mx-auto max-w-4xl"
          >
            <div className="relative flex items-center gap-2 rounded-2xl border border-[#333] bg-[#141414] p-2 pr-3 shadow-2xl focus-within:border-[#F06543]/50 transition-all">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    sendMessage();
                  }
                }}
                placeholder="Ask follow-up questions..."
                className="max-h-48 flex-1 resize-none bg-transparent p-3 text-sm text-white outline-none placeholder:text-[#444]"
                rows={1}
                disabled={loading}
              />
              <button
                type="submit"
                disabled={loading || !input.trim()}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#F06543] text-white transition-all hover:bg-[#D45131] disabled:opacity-20 transform active:scale-95"
              >
                <Send size={18} strokeWidth={2.5} />
              </button>
            </div>
            <div className="mt-3 text-center text-[10px] text-[#444] uppercase tracking-widest font-bold">
              Powered by Velora Intelligence
            </div>
          </form>
        </div>
      </div>
    </Layout>
  );
}
