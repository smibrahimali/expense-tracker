'use client';

import { useState, useEffect, useRef } from 'react';
import { todayLocal } from '../../utils/format';

type Message = {
  role: 'user' | 'ai';
  content: string;
  optionsVersion?: string | null;
};

export default function ChatLogger({ onExpenseAdded }: { onExpenseAdded?: () => void }) {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'ai',
      content: "Tell me what you spent. Example: 'I spent 4500 on internet today'.",
    },
  ]);
  const [input, setInput] = useState('');
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [optionsVersion, setOptionsVersion] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [voiceStatus, setVoiceStatus] = useState<string | null>(null);
  const recognitionRef = useRef<any>(null);
  const inFlightRef = useRef(false);
  const startingVoiceRef = useRef(false);
  const ignoreResultsRef = useRef(false);
  const mediaStreamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onresult = (event: any) => {
      if (ignoreResultsRef.current) return;
      let currentTranscript = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        currentTranscript += event.results[i][0].transcript;
      }
      setInput(currentTranscript);
    };

    recognition.onerror = (event: any) => {
      console.warn('Speech API Notice:', event.error);
      if (event.error === 'network') {
        setVoiceStatus('Speech network error — try Chrome or disable VPN.');
      } else if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
        setVoiceStatus('Microphone blocked. Allow mic access in the browser.');
      } else if (event.error === 'audio-capture' || event.error === 'NotFoundError') {
        setVoiceStatus('No microphone found.');
      } else if (event.error !== 'aborted' && event.error !== 'no-speech') {
        setVoiceStatus('Voice input failed. Try again.');
      }
      setIsListening(false);
      startingVoiceRef.current = false;
    };

    recognition.onend = () => {
      setIsListening(false);
      startingVoiceRef.current = false;
    };

    recognitionRef.current = recognition;

    return () => {
      try {
        recognition.onresult = null;
        recognition.onerror = null;
        recognition.onend = null;
        recognition.abort();
      } catch {
        /* ignore */
      }
      recognitionRef.current = null;
      mediaStreamRef.current?.getTracks().forEach((t) => t.stop());
      mediaStreamRef.current = null;
    };
  }, []);

  const stopMedia = () => {
    mediaStreamRef.current?.getTracks().forEach((t) => t.stop());
    mediaStreamRef.current = null;
  };

  const toggleListening = async () => {
    setVoiceStatus(null);
    if (!recognitionRef.current) {
      setVoiceStatus('Voice input is not supported in this browser. Try Chrome.');
      return;
    }
    if (!window.isSecureContext && !(window as any).webkitSpeechRecognition) {
      setVoiceStatus('Voice needs HTTPS (or localhost).');
      return;
    }

    if (isListening) {
      try {
        recognitionRef.current.stop();
      } catch {
        /* ignore */
      }
      stopMedia();
      setIsListening(false);
      return;
    }

    if (startingVoiceRef.current) return;
    startingVoiceRef.current = true;

    try {
      if (navigator.mediaDevices?.getUserMedia) {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        mediaStreamRef.current = stream;
      }
      ignoreResultsRef.current = false;
      setInput('');
      recognitionRef.current.start();
      setIsListening(true);
    } catch (err: any) {
      console.warn('Microphone access denied:', err);
      const name = err?.name || '';
      if (name === 'NotFoundError') setVoiceStatus('No microphone found.');
      else if (name === 'NotAllowedError') setVoiceStatus('Microphone access blocked.');
      else setVoiceStatus('Could not start microphone.');
      setIsListening(false);
    } finally {
      startingVoiceRef.current = false;
    }
  };

  const sendMessage = async (text: string) => {
    if (!text.trim() || inFlightRef.current) return;
    inFlightRef.current = true;

    if (isListening) {
      ignoreResultsRef.current = true;
      try {
        recognitionRef.current?.stop();
      } catch {
        /* ignore */
      }
      stopMedia();
      setIsListening(false);
    }

    setInput('');
    setMessages((prev) => [...prev, { role: 'user', content: text }]);
    setIsLoading(true);
    setVoiceStatus(null);

    try {
      const response = await fetch('/api/chat-logger', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          sessionId,
          localDate: todayLocal(),
        }),
      });

      const contentType = response.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) {
        throw new Error(
          response.status === 401
            ? 'Session expired — please sign in again.'
            : 'Unexpected server response. Try again.'
        );
      }

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Server responded with an error');

      const aiText = typeof data.message === 'string' ? data.message : 'Done.';
      const nextSession = data.sessionId ?? null;
      setSessionId(nextSession);
      if (data.optionsVersion) setOptionsVersion(data.optionsVersion);
      else if (!nextSession) setOptionsVersion(null);
      else if (aiText.includes('\nA)')) setOptionsVersion(nextSession);

      setMessages((prev) => [
        ...prev,
        {
          role: 'ai',
          content: aiText,
          optionsVersion: data.optionsVersion || (aiText.includes('\nA)') ? nextSession : null),
        },
      ]);

      if (data.status === 'incomplete') {
        setSessionId(data.sessionId);
      } else {
        setSessionId(null);
        setOptionsVersion(null);
        if (onExpenseAdded) onExpenseAdded();
      }
    } catch (error: any) {
      setMessages((prev) => [
        ...prev,
        { role: 'ai', content: `Error: ${error.message || 'Something went wrong'}` },
      ]);
    } finally {
      setIsLoading(false);
      inFlightRef.current = false;
    }
  };

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(input);
  };

  const latestOptionsVersion =
    optionsVersion ||
    [...messages].reverse().find((m) => m.role === 'ai' && m.optionsVersion)?.optionsVersion ||
    null;

  return (
    <div className="ef-panel p-4 sm:p-5 w-[min(100vw-2rem,24rem)] flex flex-col h-[420px]">
      <div className="flex items-center justify-between mb-4 pb-3 border-b border-[var(--ef-border)]">
        <div>
          <h3 className="text-sm font-semibold text-[var(--ef-ink)]">AI Logger</h3>
          <p className="text-xs text-[var(--ef-muted)] mt-0.5">Log or edit expenses by chat</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto space-y-3 mb-3 pr-1">
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div
              className={`px-3.5 py-2.5 rounded-2xl max-w-[88%] text-sm leading-relaxed ${
                msg.role === 'user'
                  ? 'bg-[var(--ef-accent)] text-white rounded-br-md'
                  : 'bg-white/5 text-[var(--ef-gray-800)] rounded-bl-md border border-[var(--ef-border)]'
              }`}
            >
              {msg.content.split('\n').map((line, lineIdx) => {
                const trimmedLine = line.trim();
                if (!trimmedLine) return null;

                const isOption = /^[A-H]\)/.test(trimmedLine);
                if (isOption && msg.role === 'ai') {
                  const letter = trimmedLine.charAt(0);
                  const active =
                    !!latestOptionsVersion &&
                    msg.optionsVersion === latestOptionsVersion &&
                    !isLoading;
                  return (
                    <button
                      key={lineIdx}
                      type="button"
                      onClick={() => active && sendMessage(letter)}
                      disabled={!active}
                      className="block w-full text-left mt-2 p-2.5 bg-white/5 hover:bg-white/10 border border-[var(--ef-border)] rounded-xl transition-colors text-[var(--ef-ink)] font-medium text-[13px] disabled:opacity-40 disabled:hover:bg-white/5 cursor-pointer disabled:cursor-not-allowed"
                    >
                      {trimmedLine}
                    </button>
                  );
                }

                return (
                  <span key={lineIdx} className={lineIdx > 0 ? 'block mt-1.5' : 'block'}>
                    {trimmedLine}
                  </span>
                );
              })}
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex justify-start">
            <div className="px-3.5 py-2 rounded-2xl bg-white/5 text-[var(--ef-muted)] text-xs font-medium animate-pulse rounded-bl-md border border-[var(--ef-border)]">
              Thinking…
            </div>
          </div>
        )}
      </div>

      {voiceStatus ? (
        <p role="status" className="text-xs text-[var(--ef-warning)] mb-2">
          {voiceStatus}
        </p>
      ) : null}

      <form onSubmit={handleSend} className="relative mt-auto">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={isListening ? 'Listening…' : 'Describe an expense…'}
          disabled={isLoading}
          maxLength={500}
          className={`ef-input pr-24 ${
            isListening ? 'border-[var(--ef-danger)] focus:border-[var(--ef-danger)]' : ''
          }`}
        />
        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
          <button
            type="button"
            onClick={toggleListening}
            disabled={isLoading}
            className={`w-8 h-8 flex items-center justify-center rounded-lg transition-colors disabled:opacity-50 cursor-pointer ${
              isListening
                ? 'bg-[var(--ef-danger)] text-white'
                : 'bg-white/5 text-[var(--ef-muted)] hover:bg-white/10 hover:text-[var(--ef-ink)]'
            }`}
            aria-label={isListening ? 'Stop listening' : 'Start voice input'}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
              <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
              <line x1="12" x2="12" y1="19" y2="22" />
            </svg>
          </button>
          <button
            type="submit"
            disabled={isLoading || !input.trim()}
            className="w-8 h-8 flex items-center justify-center bg-[var(--ef-accent)] text-white rounded-lg hover:bg-[var(--ef-accent-hover)] disabled:opacity-50 cursor-pointer transition-colors"
            aria-label="Send message"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="m22 2-7 20-4-9-9-4Z" />
              <path d="M22 2 11 13" />
            </svg>
          </button>
        </div>
      </form>
    </div>
  );
}
