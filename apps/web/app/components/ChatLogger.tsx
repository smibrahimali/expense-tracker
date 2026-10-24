'use client';
import { useState, useEffect, useRef } from 'react';

type Message = { role: 'user' | 'ai'; content: string };

export default function ChatLogger({ userId, onExpenseAdded }: { userId: string; onExpenseAdded?: () => void }) {
  const [messages, setMessages] = useState<Message[]>([
    { role: 'ai', content: "Hi! Tell me what you bought. (e.g., 'I spent 4500 on the StormFiber bill today')" }
  ]);
  const [input, setInput] = useState('');
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        const recognition = new SpeechRecognition();
        recognition.continuous = false;
        recognition.interimResults = true;
        recognition.lang = 'en-US';

        recognition.onresult = (event: any) => {
          let currentTranscript = '';
          for (let i = event.resultIndex; i < event.results.length; i++) {
            currentTranscript += event.results[i][0].transcript;
          }
          setInput(currentTranscript);
        };

        // UPDATED: Graceful error handling prevents Next.js red screen
        recognition.onerror = (event: any) => {
          console.warn("Speech API Notice:", event.error);
          
          if (event.error === 'network') {
            alert("Speech recognition failed: Browser couldn't reach transcription servers. Please try using Google Chrome or disable your VPN.");
          } else if (event.error === 'not-allowed') {
            alert("Microphone access blocked. Please allow mic permissions in your browser URL bar.");
          }
          
          setIsListening(false);
        };

        recognition.onend = () => {
          setIsListening(false);
        };

        recognitionRef.current = recognition;
      }
    }
  }, []);

  const toggleListening = () => {
    if (!recognitionRef.current) {
      alert("Your browser does not support Voice-to-Text. Please try Chrome or Safari.");
      return;
    }
    
    if (isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    } else {
      setInput(''); // Clear input for a fresh voice recording
      recognitionRef.current.start();
      setIsListening(true);
    }
  };

  const sendMessage = async (text: string) => {
    if (!text.trim() || isLoading) return;

    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
    }

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
              {msg.content.split('\n').map((line, lineIdx) => {
                const trimmedLine = line.trim();
                if (!trimmedLine) return null;

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
        {/* Adjusted padding to pr-20 to make room for both buttons */}
        <input 
          type="text" 
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={isListening ? "Listening..." : "Type an expense..."}
          disabled={isLoading}
          className={`w-full pl-4 pr-24 py-3.5 rounded-xl text-zinc-950 placeholder:text-zinc-600 font-bold text-sm outline-none border shadow-sm transition-all disabled:opacity-50 ${isListening ? 'bg-red-50/80 border-red-200 focus:ring-red-500/30' : 'bg-white/60 border-white/40 focus:bg-white/80 focus:ring-2 focus:ring-orange-500/30'}`}
        />
        
        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
          {/* Voice Record Button */}
          <button 
            type="button" 
            onClick={toggleListening}
            disabled={isLoading}
            className={`w-8 h-8 flex items-center justify-center rounded-lg shadow-md transition-all disabled:opacity-50 cursor-pointer ${
              isListening 
                ? 'bg-red-500 text-white animate-pulse' 
                : 'bg-white/80 text-zinc-600 hover:bg-zinc-100 hover:scale-105'
            }`}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/>
              <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
              <line x1="12" x2="12" y1="19" y2="22"/>
            </svg>
          </button>

          {/* Send Button */}
          <button 
            type="submit" 
            disabled={isLoading || !input.trim()}
            className="w-8 h-8 flex items-center justify-center bg-gradient-to-br from-[#B42910] to-[#F18535] text-white rounded-lg shadow-md hover:scale-105 transition-transform disabled:opacity-50 disabled:hover:scale-100 cursor-pointer"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/></svg>
          </button>
        </div>
      </form>
    </div>
  );
} 