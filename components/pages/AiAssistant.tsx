import React, { useState, useEffect, useRef } from 'react';
import { Send, Bot, User, Sparkles, AlertCircle } from 'lucide-react';
import { HierarchicalAccount, AccountType, JournalEntry } from '../../types';
import { accountsService } from '../../src/services/accounts.service';
import { journalsService } from '../../src/services/journals.service';
import { apiFetch } from '../../src/services/api';

// Interface for Chat Messages
interface Message {
  id: string;
  role: 'user' | 'model';
  text: string;
  timestamp: Date;
}

export const AiAssistant: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      role: 'model',
      text: 'Halo! Saya asisten keuangan AccessTansi. Saya telah mempelajari data keuangan terbaru Anda. Ada yang bisa saya bantu analisis hari ini? (Contoh: "Bagaimana profitabilitas bulan ini?" atau "Apa pengeluaran terbesar?")',
      timestamp: new Date()
    }
  ]);
  const [isConfigured, setIsConfigured] = useState<boolean | null>(null);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [financialContext, setFinancialContext] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // --- 0. CEK STATUS KONFIGURASI API KEY ---
  useEffect(() => {
    apiFetch<{ configured: boolean }>('/api/ai/status')
      .then(r => setIsConfigured(r.configured))
      .catch(() => setIsConfigured(false));
  }, []);

  // --- 1. BUILD CONTEXT FROM FINANCIAL DATA ---
  useEffect(() => {
    const buildContext = async () => {
      const [accounts, journals]: [HierarchicalAccount[], JournalEntry[]] = await Promise.all([
        accountsService.getAll().catch(() => []),
        journalsService.getAll().catch(() => []),
      ]);

      if (accounts.length === 0) {
        setFinancialContext("Data keuangan kosong. Beritahu user untuk mengisi Daftar Akun dan Jurnal terlebih dahulu.");
        return;
      }

      // Calculate Summaries (Similar to DashboardHome logic)
      let totalRev = 0;
      let totalExp = 0;
      let cashBalance = 0;
      const expenseCats: Record<string, number> = {};

      // Calculate Cash Balance (Assets starting with '111')
      // Note: Simplified logic. In real app, consider opening balance + movements.
      const accountBalances: Record<string, number> = {};
      accounts.forEach(acc => accountBalances[acc.id] = acc.balance); // Init with opening

      journals.forEach(journal => {
        if (journal.status !== 'POSTED') return;
        journal.lines.forEach(line => {
           const acc = accounts.find(a => a.id === line.accountId);
           if (!acc) return;

           // Update Balance
           const isDebitNormal = acc.type === AccountType.ASSET || acc.type === AccountType.EXPENSE;
           let delta = 0;
           if (isDebitNormal) delta = line.debit - line.credit;
           else delta = line.credit - line.debit;
           accountBalances[acc.id] = (accountBalances[acc.id] || 0) + delta;

           // P&L
           if (acc.type === AccountType.REVENUE) {
               totalRev += (line.credit - line.debit);
           } else if (acc.type === AccountType.EXPENSE) {
               const exp = line.debit - line.credit;
               totalExp += exp;
               expenseCats[acc.name] = (expenseCats[acc.name] || 0) + exp;
           }
        });
      });

      // Total Cash
      accounts.filter(a => a.code.startsWith('111')).forEach(a => {
          cashBalance += (accountBalances[a.id] || 0);
      });

      // Top Expenses
      const topExpenses = Object.entries(expenseCats)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 5)
        .map(([name, val]) => `- ${name}: ${new Intl.NumberFormat('id-ID').format(val)}`)
        .join('\n');

      // Recent Transactions
      const recentTx = journals
        .sort((a,b) => new Date(b.transactionDate).getTime() - new Date(a.transactionDate).getTime())
        .slice(0, 3)
        .map(j => `- ${j.transactionDate} (${j.referenceNumber}): ${j.description} (Rp ${new Intl.NumberFormat('id-ID').format(j.totalAmount)})`)
        .join('\n');

      const contextString = `
      CURRENT FINANCIAL DATA (Real-time):
      - Total Revenue (YTD): Rp ${new Intl.NumberFormat('id-ID').format(totalRev)}
      - Total Expense (YTD): Rp ${new Intl.NumberFormat('id-ID').format(totalExp)}
      - Net Profit: Rp ${new Intl.NumberFormat('id-ID').format(totalRev - totalExp)}
      - Cash & Bank Balance: Rp ${new Intl.NumberFormat('id-ID').format(cashBalance)}
      
      TOP 5 EXPENSES:
      ${topExpenses || 'No expenses recorded yet.'}
      
      LATEST TRANSACTIONS:
      ${recentTx || 'No transactions yet.'}
      `;

      setFinancialContext(contextString);
    };

    buildContext();
  }, []);

  // Scroll to bottom on new message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // --- 2. SEND TO GEMINI ---
  const handleSend = async () => {
    if (!inputValue.trim()) return;

    // Add User Message
    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      text: inputValue,
      timestamp: new Date()
    };
    setMessages(prev => [...prev, userMsg]);
    setInputValue('');
    setIsLoading(true);

    try {
      const systemInstruction = `
        You are AccessTansi AI, an expert financial consultant for a company.
        Your goal is to provide insightful, concise, and professional financial advice based on the provided data.

        RULES:
        1. Always answer in Indonesian (Bahasa Indonesia).
        2. Use the provided "CURRENT FINANCIAL DATA" to answer factually.
        3. If data is missing or zero, simply state it without making up numbers.
        4. Be encouraging but realistic. If profit is negative, suggest cost-cutting or revenue strategies.
        5. Format numbers clearly (e.g., "10 juta", "Rp 500.000").
      `;

      const prompt = `
        ${systemInstruction}

        ${financialContext}

        USER QUESTION: "${userMsg.text}"
      `;

      // Kirim ke backend — API key Gemini disimpan di server, tidak pernah terekspos ke browser
      const response = await apiFetch<{ text: string }>('/api/ai/chat', {
        method: 'POST',
        body: JSON.stringify({ prompt }),
      });

      const aiText = response.text || "Maaf, saya tidak dapat menghasilkan respon saat ini.";

      const aiMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'model',
        text: aiText,
        timestamp: new Date()
      };

      setMessages(prev => [...prev, aiMsg]);

    } catch (error: any) {
      console.error("AI Error:", error);
      const isNotConfigured = error?.message?.includes('belum dikonfigurasi');
      const errorMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'model',
        text: isNotConfigured
          ? "⚠️ API Key Google Gemini belum dikonfigurasi. Silakan masuk ke Pengaturan → API Keys, lalu tambahkan key dengan:\n• Service: Google Gemini\n• Key Name: API_KEY\n• Key Value: (API key Anda)"
          : "Maaf, terjadi kesalahan koneksi ke layanan AI. Pastikan API Key valid atau coba lagi nanti.",
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="h-[calc(100vh-8rem)] flex flex-col bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-100 bg-gray-50 flex items-center gap-3">
        <div className="w-10 h-10 bg-gradient-to-br from-primary-400 to-primary-600 rounded-lg flex items-center justify-center text-white shadow-sm">
          <Sparkles className="w-5 h-5" />
        </div>
        <div>
          <h2 className="font-bold text-gray-900">AccessTansi AI Assistant</h2>
          <p className="text-xs text-gray-500 flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
            Online • Powered by Google Gemini 2.5
          </p>
        </div>
      </div>

      {/* Chat Area */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-slate-50">
        {messages.map((msg) => (
          <div 
            key={msg.id} 
            className={`flex items-start gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}
          >
            {/* Avatar */}
            <div className={`
              w-8 h-8 rounded-full flex items-center justify-center shrink-0
              ${msg.role === 'user' ? 'bg-gray-200' : 'bg-primary-100 text-primary-600'}
            `}>
              {msg.role === 'user' ? <User className="w-5 h-5 text-gray-500" /> : <Bot className="w-5 h-5" />}
            </div>

            {/* Bubble */}
            <div className={`
              max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-sm
              ${msg.role === 'user' 
                ? 'bg-primary-600 text-white rounded-tr-none' 
                : 'bg-white text-gray-800 border border-gray-100 rounded-tl-none'}
            `}>
              {/* Render with simple whitespace handling for markdown-like lists */}
              <div className="whitespace-pre-wrap font-sans">{msg.text}</div>
              <div className={`text-[10px] mt-2 opacity-70 ${msg.role === 'user' ? 'text-primary-100' : 'text-gray-400'}`}>
                {msg.timestamp.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
              </div>
            </div>
          </div>
        ))}
        
        {isLoading && (
          <div className="flex items-start gap-3">
             <div className="w-8 h-8 rounded-full bg-primary-100 text-primary-600 flex items-center justify-center shrink-0">
                <Bot className="w-5 h-5" />
             </div>
             <div className="bg-white px-4 py-3 rounded-2xl rounded-tl-none border border-gray-100 shadow-sm flex items-center gap-2">
                <div className="w-2 h-2 bg-primary-400 rounded-full animate-bounce" style={{animationDelay: '0ms'}}></div>
                <div className="w-2 h-2 bg-primary-400 rounded-full animate-bounce" style={{animationDelay: '150ms'}}></div>
                <div className="w-2 h-2 bg-primary-400 rounded-full animate-bounce" style={{animationDelay: '300ms'}}></div>
             </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Banner jika API Key belum dikonfigurasi */}
      {isConfigured === false && (
        <div className="mx-4 mb-0 mt-2 p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <div className="text-xs text-amber-800">
            <strong>API Key belum dikonfigurasi.</strong> Masuk ke <strong>Pengaturan → API Keys</strong> dan tambahkan:
            <br />Service: <code className="bg-amber-100 px-1 rounded">Google Gemini</code> | Key Name: <code className="bg-amber-100 px-1 rounded">API_KEY</code>
          </div>
        </div>
      )}

      {/* Input Area */}
      <div className="p-4 bg-white border-t border-gray-100">
        <div className="relative">
          <textarea
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyPress}
            placeholder={isConfigured === false ? "API Key belum dikonfigurasi..." : "Tanyakan sesuatu tentang keuangan perusahaan..."}
            disabled={isConfigured === false}
            className="w-full pl-4 pr-12 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none resize-none h-14 max-h-32 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
          />
          <button
            onClick={handleSend}
            disabled={isLoading || !inputValue.trim() || isConfigured === false}
            className="absolute right-2 top-2 p-2 bg-primary-500 hover:bg-primary-600 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
        <p className="text-center text-xs text-gray-400 mt-2">
          AI dapat membuat kesalahan. Pastikan untuk selalu memverifikasi data penting.
        </p>
      </div>
    </div>
  );
};