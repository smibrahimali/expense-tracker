'use client';
import { useState } from 'react';

type Message = { role: 'user' | 'ai'; content: string };

export default function ChatLogger({ userId, onExpenseAdded }: { userId: string; onExpenseAdded?: () => void }) {
  const [messages, setMessages] = useState<Message[]>([
    { role: 'ai', content: "Hi! Tell me what you bought. (e.g., 'I spent 4500 on the StormFiber bill today')" }
  ]);
  const [input, setInput] = useState('');
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Extracted core send logic so both the form and our new buttons can use it
  const sendMessage = async (text: string) => {
    if (!text.trim() || isLoading) return;

    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: text }]);
    setIsLoading(true);

    try {
      const response = await fetch('/api/chat-logger', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, sessionId, userId }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Server responded with an error");
      }

      setMessages(prev => [...prev, { role: 'ai', content: data.message }]);
      
      if (data.status === 'incomplete') {
        setSessionId(data.sessionId);
      } else {
        setSessionId(null); 
        if (onExpenseAdded) onExpenseAdded();
      }
    } catch (error: any) {
      setMessages(prev => [...prev, { role: 'ai', content: `❌ Error: ${error.message}` }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(input);
  };

  return (
    <div className="backdrop-blur-3xl bg-white/30 border border-white/40 shadow-2xl rounded-[24px] sm:rounded-[32px] p-5 sm:p-6 w-full max-w-md mx-auto flex flex-col h-[400px]">
      <h3 className="text-sm font-black uppercase tracking-widest text-zinc-900 drop-shadow-sm mb-4 border-b border-white/30 pb-3">
        🤖 AI Quick Logger
      </h3>
      
      <div className="flex-1 overflow-y-auto space-y-4 mb-4 pr-2 scrollbar-thin">
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`px-4 py-2.5 rounded-2xl max-w-[85%] text-sm font-bold shadow-sm ${
              msg.role === 'user' 
                ? 'bg-zinc-950 text-white rounded-br-sm' 
                : 'bg-white/60 border border-white/50 text-zinc-900 rounded-bl-sm'
            }`}>
              
              {/* Smart Message Parser */}
              {msg.content.split('\n').map((line, lineIdx) => {
                const trimmedLine = line.trim();
                if (!trimmedLine) return null;

                // Detect if the line is an option like "A) pizza..."
                const isOption = /^[A-H]\)/.test(trimmedLine);
                
                if (isOption && msg.role === 'ai') {
                  const letter = trimmedLine.charAt(0);
                  return (
                    <button
                      key={lineIdx}
                      onClick={() => sendMessage(letter)}
                      disabled={isLoading}
                      className="block w-full text-left mt-2 p-2.5 bg-white/40 hover:bg-white/80 border border-white/50 rounded-xl transition-all shadow-sm active:scale-[0.98] cursor-pointer text-zinc-900 font-bold text-[13px] disabled:opacity-50"
                    >
                      {trimmedLine}
                    </button>
                  );
                }

                // Regular text rendering
                return (
                  <span key={lineIdx} className={lineIdx > 0 ? "block mt-2" : "block"}>
                    {trimmedLine}
                  </span>
                );
              })}

            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex justify-start">
            <div className="px-4 py-2.5 rounded-2xl bg-white/60 border border-white/50 text-zinc-500 text-xs font-black animate-pulse rounded-bl-sm">
              Typing...
            </div>
          </div>
        )}
      </div>

      <form onSubmit={handleSend} className="relative mt-auto">
        <input 
          type="text" 
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type an expense..." 
          disabled={isLoading}
          className="w-full pl-4 pr-12 py-3.5 rounded-xl bg-white/60 text-zinc-950 placeholder:text-zinc-600 font-bold text-sm outline-none border border-white/40 shadow-sm focus:bg-white/80 focus:ring-2 focus:ring-orange-500/30 transition-all disabled:opacity-50"
        />
        <button 
          type="submit" 
          disabled={isLoading || !input.trim()}
          className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center bg-gradient-to-br from-[#B42910] to-[#F18535] text-white rounded-lg shadow-md hover:scale-105 transition-transform disabled:opacity-50 disabled:hover:scale-100 cursor-pointer"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/></svg>
        </button>
      </form>
    </div>
  );
}