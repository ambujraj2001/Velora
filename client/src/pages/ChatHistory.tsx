import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { MessageSquare, Calendar, ChevronRight, Trash2, Search, Filter } from 'lucide-react';
import { api } from '../lib/appConfig';
import Layout from '../components/Layout';
import { format } from 'date-fns';

interface Chat {
  id: string;
  title: string;
  created_at: string;
  last_message?: string;
}

const ChatHistory: React.FC = () => {
  const [chats, setChats] = useState<Chat[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    const fetchChats = async () => {
      try {
        const res = await api.get('/conversations');
        setChats(res.data || []);
      } catch (err) {
        console.error('Fetch chats error:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchChats();
  }, []);

  const handleDeleteChat = async (id: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm('Are you sure you want to delete this conversation?')) return;
    try {
      await api.delete(`/conversations/${id}`);
      setChats(prev => prev.filter(c => c.id !== id));
    } catch (err) {
      console.error('Delete chat error:', err);
    }
  };

  const filteredChats = chats.filter(chat => 
    (chat.title || 'Untitled Chat').toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <Layout>
      <header className="mb-10 flex items-center justify-between">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2 text-sm text-[#666]">
            <MessageSquare size={20} />
            <span>Conversation History</span>
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Your Chats</h1>
          <p className="text-[#888]">Relive your past insights and data explorations.</p>
        </div>
      </header>

      {/* Search & Filter Bar */}
      <div className="mb-8 flex gap-4">
        <div className="relative flex-1 group">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-[#444] group-focus-within:text-[#F06543] transition-colors" size={18} />
          <input 
            type="text" 
            placeholder="Search conversations..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-xl border border-[#222] bg-[#141414] py-3 pl-12 pr-4 text-white placeholder-[#444] outline-none transition-all focus:border-[#F06543] focus:ring-1 focus:ring-[#F06543]"
          />
        </div>
        <button className="flex items-center gap-2 rounded-xl border border-[#222] bg-[#141414] px-5 text-[#888] hover:bg-[#1A1A1A] hover:text-white transition-all">
          <Filter size={18} />
          <span className="text-sm font-medium">Filter</span>
        </button>
      </div>

      <div className="grid gap-4">
        {loading ? (
          <div className="flex h-64 items-center justify-center rounded-2xl border border-[#222] bg-[#141414]/40">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#F06543] border-t-transparent" />
          </div>
        ) : filteredChats.length > 0 ? (
          filteredChats.map((chat) => (
            <div 
              key={chat.id}
              onClick={() => navigate(`/c/${chat.id}`)}
              className="group relative flex cursor-pointer items-center justify-between rounded-2xl border border-[#222] bg-[#0F0F0F] p-5 shadow-sm transition-all hover:border-[#F06543]/40 hover:bg-[#141414] hover:shadow-[0_8px_30px_rgb(0,0,0,0.12)]"
            >
              <div className="flex items-center gap-5">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#1A1A1A] text-[#F06543] group-hover:bg-[#F06543] group-hover:text-white transition-colors">
                  <MessageSquare size={22} />
                </div>
                <div className="flex flex-col">
                  <h3 className="font-bold text-white group-hover:text-[#F06543] transition-colors">{chat.title || 'Untitled Chat'}</h3>
                  <div className="mt-1 flex items-center gap-3 text-xs text-[#666]">
                    <div className="flex items-center gap-1">
                      <Calendar size={12} />
                      <span>{format(new Date(chat.created_at), 'MMM d, yyyy')}</span>
                    </div>
                    <span>•</span>
                    <span>ClickHouse</span>
                  </div>
                </div>
              </div>
              
              <div className="flex items-center gap-4">
                <button 
                  onClick={(e) => handleDeleteChat(chat.id, e)}
                  className="rounded-lg p-2 text-[#444] opacity-0 transition-all hover:bg-red-500/10 hover:text-red-500 group-hover:opacity-100"
                >
                  <Trash2 size={18} />
                </button>
                <ChevronRight className="text-[#333] group-hover:translate-x-1 group-hover:text-[#F06543] transition-all" />
              </div>

              {/* Glowing Background Overlay */}
              <div className="absolute inset-0 -z-10 bg-linear-to-br from-[#F06543]/0 to-[#F06543]/5 opacity-0 group-hover:opacity-100 transition-opacity rounded-2xl" />

            </div>
          ))
        ) : (
          <div className="flex flex-col items-center justify-center py-20 text-[#666]">
            <div className="mb-4 rounded-full bg-[#141414] p-6">
              <MessageSquare size={48} strokeWidth={1} />
            </div>
            <p className="text-lg font-medium">No results found</p>
            <p className="text-sm">Try a different search term or start a new chat.</p>
          </div>
        )}
      </div>
    </Layout>
  );
};

export default ChatHistory;
