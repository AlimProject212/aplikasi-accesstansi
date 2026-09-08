
import React, { useState, useEffect } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell
} from 'recharts';
import { TrendingUp, TrendingDown, DollarSign, Wallet, Activity, PieChart as PieIcon, ArrowUpRight, ArrowDownRight, Scale, Percent, Zap } from 'lucide-react';
import { HierarchicalAccount, AccountType, JournalEntry } from '../../types';
import { accountsService } from '../../src/services/accounts.service';
import { journalsService } from '../../src/services/journals.service';
import { periodsService } from '../../src/services/settings.service';

// --- UTILS ---
const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('id-ID', { 
    style: 'currency', 
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(amount);
};

const formatShortCurrency = (amount: number) => {
  if (Math.abs(amount) >= 1000000000) return `Rp ${(amount / 1000000000).toFixed(1)} M`;
  if (Math.abs(amount) >= 1000000) return `Rp ${(amount / 1000000).toFixed(1)} jt`;
  return formatCurrency(amount);
};

// Colors for Charts
const COLORS = ['#10B981', '#3B82F6', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899'];

export const DashboardHome: React.FC = () => {
  const [summary, setSummary] = useState({
    revenue: 0,
    cogs: 0, // Cost of Goods Sold / Beban Langsung
    expense: 0, // Operating Expense
    netProfit: 0,
    cash: 0
  });

  const [chartData, setChartData] = useState<any[]>([]);
  const [expenseComposition, setExpenseComposition] = useState<any[]>([]);
  
  // Ratios State
  const [ratios, setRatios] = useState({
    // Liquidity
    currentRatio: 0,
    cashRatio: 0,
    workingCapital: 0,
    
    // Profitability
    grossProfitMargin: 0,
    netProfitMargin: 0,
    returnOnEquity: 0, // ROE
    returnOnAssets: 0, // ROA
    
    // Solvency
    debtToEquity: 0,
    debtRatio: 0,
    assetToEquity: 0,
    
    // Activity
    assetTurnover: 0
  });

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    Promise.all([
      accountsService.getAll(),
      journalsService.getAll(),
      periodsService.getAll(),
    ]).then(([rawAccounts, journals, periods]) => {
    // 1. Process Data
    const accounts: HierarchicalAccount[] = rawAccounts;

    // 2. Process Data for Summary Cards & Charts
    let totalRev = 0;
    let totalCogs = 0;
    let totalOpExp = 0;
    let totalCash = 0;

    // Helper to track monthly totals
    const monthlyStats: Record<string, { revenue: number, expense: number }> = {};
    // Helper to track expense categories
    const expenseCats: Record<string, number> = {};

    // Map existing balances from COA (Opening balances)
    const accountBalances: Record<string, number> = {};
    accounts.forEach(acc => {
      accountBalances[acc.id] = acc.balance;
    });

    const activePeriod = (periods.find(p => p.isActive)?.year) || new Date().getFullYear().toString();

    // Process Journals
    journals.forEach(journal => {
      if (journal.status !== 'POSTED') return;
      
      // Filter by active period year
      if (!journal.transactionDate.startsWith(activePeriod)) return;

      const monthKey = journal.transactionDate.substring(0, 7); // YYYY-MM
      if (!monthlyStats[monthKey]) monthlyStats[monthKey] = { revenue: 0, expense: 0 };

      journal.lines.forEach(line => {
        const acc = accounts.find(a => a.id === line.accountId);
        if (!acc) return;

        // Update Running Balance for Asset/Liab/Equity calculation
        const isDebitNormal = acc.type === AccountType.ASSET || acc.type === AccountType.EXPENSE;
        let delta = 0;
        if (isDebitNormal) delta = line.debit - line.credit;
        else delta = line.credit - line.debit;
        
        accountBalances[acc.id] = (accountBalances[acc.id] || 0) + delta;

        // Aggregate Revenue & Expense for Period (Journals only)
        const firstDigit = acc.code.charAt(0);
        const isRevenue = firstDigit === '4' || firstDigit === '7';
        const isExpense = ['5', '6', '8', '9'].includes(firstDigit);

        if (isRevenue) {
           const revAmount = line.credit - line.debit; 
           monthlyStats[monthKey].revenue += revAmount;
           totalRev += revAmount;
        } else if (isExpense) {
           const expAmount = line.debit - line.credit;
           
           // Split COGS (Usually code 51...) vs OPEX (52...)
           // Note: In Service Template, 51 is Salaries (Direct Cost), so it works as Gross Margin logic too
           if (acc.code.startsWith('51')) {
               totalCogs += expAmount;
           } else {
               totalOpExp += expAmount;
           }

           monthlyStats[monthKey].expense += expAmount;
           expenseCats[acc.name] = (expenseCats[acc.name] || 0) + expAmount;
        }
      });
    });

    // Calculate Cash Total (Current Snapshot)
    const cashAccounts = accounts.filter(a => a.code.startsWith('111'));
    cashAccounts.forEach(acc => {
       totalCash += (accountBalances[acc.id] || 0);
    });

    // B. Prepare Chart Data (Sort by Month)
    const barData = Object.keys(monthlyStats).sort().map(month => ({
      name: month, 
      Pendapatan: monthlyStats[month].revenue,
      Beban: monthlyStats[month].expense
    }));

    // C. Prepare Pie Data (Top 5 Expenses)
    const pieData = Object.keys(expenseCats).map(name => ({
      name,
      value: expenseCats[name]
    })).sort((a,b) => b.value - a.value);

    let finalPieData = pieData;
    if (pieData.length > 5) {
      const top5 = pieData.slice(0, 5);
      const others = pieData.slice(5).reduce((sum, item) => sum + item.value, 0);
      finalPieData = [...top5, { name: 'Lainnya', value: others }];
    }

    // D. Calculate Ratios
    
    // 1. Assets
    let currentAssets = 0;
    accounts.filter(a => a.code.startsWith('11') && !a.isHeader).forEach(a => currentAssets += (accountBalances[a.id] || 0));
    
    let totalAssets = 0;
    accounts.filter(a => a.type === AccountType.ASSET && !a.isHeader).forEach(a => totalAssets += (accountBalances[a.id] || 0));

    // 2. Liabilities
    let currentLiabilities = 0;
    accounts.filter(a => a.code.startsWith('21') && !a.isHeader).forEach(a => currentLiabilities += (accountBalances[a.id] || 0));

    let totalLiab = 0;
    accounts.filter(a => a.type === AccountType.LIABILITY && !a.isHeader).forEach(a => totalLiab += (accountBalances[a.id] || 0));

    // 3. Equity
    let totalEquityRaw = 0;
    accounts.filter(a => a.type === AccountType.EQUITY && !a.isHeader).forEach(a => totalEquityRaw += (accountBalances[a.id] || 0));
    
    const netProfit = totalRev - (totalCogs + totalOpExp);
    const totalEquity = totalEquityRaw + netProfit; // Add Current Earnings to Equity

    // --- RATIO FORMULAS ---
    
    // Liquidity
    const currentRatio = currentLiabilities > 0 ? (currentAssets / currentLiabilities) : 0;
    const cashRatio = currentLiabilities > 0 ? (totalCash / currentLiabilities) : 0;
    const workingCapital = currentAssets - currentLiabilities;

    // Profitability
    const grossProfit = totalRev - totalCogs;
    const grossProfitMargin = totalRev > 0 ? (grossProfit / totalRev) * 100 : 0;
    const netProfitMargin = totalRev > 0 ? (netProfit / totalRev) * 100 : 0;
    const returnOnEquity = totalEquity > 0 ? (netProfit / totalEquity) * 100 : 0;
    const returnOnAssets = totalAssets > 0 ? (netProfit / totalAssets) * 100 : 0;

    // Solvency
    const debtToEquity = totalEquity > 0 ? (totalLiab / totalEquity) : 0;
    const debtRatio = totalAssets > 0 ? (totalLiab / totalAssets) * 100 : 0;
    const assetToEquity = totalEquity > 0 ? (totalAssets / totalEquity) : 0;

    // Activity
    const assetTurnover = totalAssets > 0 ? (totalRev / totalAssets) : 0;

    setSummary({
      revenue: totalRev,
      cogs: totalCogs,
      expense: totalOpExp + totalCogs,
      netProfit: netProfit,
      cash: totalCash
    });
    setChartData(barData);
    setExpenseComposition(finalPieData);
    setRatios({
      currentRatio,
      cashRatio,
      workingCapital,
      grossProfitMargin,
      netProfitMargin,
      returnOnEquity,
      returnOnAssets,
      debtToEquity,
      debtRatio,
      assetToEquity,
      assetTurnover
    });
    setLoading(false);
    }).catch(() => {
      setLoadError(true);
      setLoading(false);
    });
  }, []);

  // --- HELPER: GET REMARKS ---
  const getRatioAnalysis = (type: string, val: number) => {
    switch (type) {
      case 'CURRENT_RATIO':
        if (val >= 2) return "Posisi likuiditas sangat kuat. Aman untuk ekspansi.";
        if (val >= 1) return "Likuiditas cukup aman. Arus kas stabil.";
        return "Likuiditas ketat. Waspada gagal bayar jangka pendek.";
      case 'CASH_RATIO':
        if (val >= 0.5) return "Cadangan kas sangat memadai.";
        return "Saldo kas relatif minim terhadap utang lancar.";
      case 'GPM':
        if (val > 40) return "Efisiensi HPP sangat baik. Margin tinggi.";
        if (val > 20) return "Margin standar industri.";
        return "Margin tipis. Periksa harga jual atau biaya bahan.";
      case 'NPM':
        if (val > 15) return "Profitabilitas luar biasa.";
        if (val > 5) return "Perusahaan menghasilkan laba stabil.";
        if (val > 0) return "Laba tipis. Perketat beban operasional.";
        return "Perusahaan merugi. Segera evaluasi model bisnis.";
      case 'ROE':
         if (val > 15) return "Pengembalian investasi pemegang saham sangat baik.";
         return "Return investasi standar.";
      case 'DER':
        if (val < 1) return "Struktur modal sehat (Dominasi ekuitas).";
        if (val <= 2) return "Leverage moderat. Masih dalam batas aman.";
        return "Risiko finansial tinggi. Ketergantungan utang besar.";
      default:
        return "Kinerja dalam pemantauan.";
    }
  };

  if (loading) return <div className="p-10 text-center text-gray-500">Memuat Dashboard...</div>;
  if (loadError) return (
    <div className="p-10 text-center">
      <div className="text-red-500 font-semibold mb-2">Gagal memuat data dashboard</div>
      <p className="text-sm text-gray-500">Periksa koneksi ke server, lalu <button onClick={() => window.location.reload()} className="underline text-primary-500">muat ulang halaman</button>.</p>
    </div>
  );

  return (
    <div className="space-y-8 pb-10">
      
      {/* HEADER */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
           <h1 className="text-2xl font-bold text-gray-900">Dashboard Keuangan</h1>
           <p className="text-gray-500 text-sm mt-1">Ringkasan performa bisnis dan kesehatan finansial (YTD).</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg px-4 py-2 text-sm font-medium text-gray-600 shadow-sm flex items-center gap-2">
           <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
           Data Terkini
        </div>
      </div>

      {/* SUMMARY CARDS */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <SummaryCard 
            title="Total Pendapatan" 
            amount={summary.revenue} 
            icon={DollarSign} 
            color="emerald" 
            subText="Gross Revenue"
        />
        <SummaryCard 
            title="Total Beban" 
            amount={summary.expense} 
            icon={TrendingDown} 
            color="red" 
            subText="COGS + Opex"
        />
        <SummaryCard 
            title="Laba Bersih" 
            amount={summary.netProfit} 
            icon={Activity} 
            color="blue" 
            subText={`NPM: ${ratios.netProfitMargin.toFixed(1)}%`}
        />
        <SummaryCard 
            title="Saldo Kas" 
            amount={summary.cash} 
            icon={Wallet} 
            color="orange" 
            subText="Liquid Assets"
        />
      </div>

      {/* CHARTS ROW */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
         {/* BAR CHART */}
         <div className="lg:col-span-2 bg-white p-6 rounded-xl border border-gray-100 shadow-sm">
            <h3 className="text-lg font-bold text-gray-800 mb-6 flex items-center gap-2">
                <BarChartIcon className="w-5 h-5 text-gray-500" />
                Tren Pendapatan vs Beban
            </h3>
            <div className="h-80 w-full">
                {chartData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                            data={chartData}
                            margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                        >
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                            <XAxis 
                                dataKey="name" 
                                axisLine={false} 
                                tickLine={false} 
                                tick={{fill: '#6B7280', fontSize: 12}} 
                                dy={10}
                            />
                            <YAxis 
                                axisLine={false} 
                                tickLine={false} 
                                tick={{fill: '#6B7280', fontSize: 12}}
                                tickFormatter={(value) => `Rp${value/1000}k`}
                            />
                            <RechartsTooltip 
                                cursor={{fill: '#F3F4F6'}}
                                contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}
                                formatter={(value: number) => formatCurrency(value)}
                            />
                            <Legend wrapperStyle={{ paddingTop: '20px' }} />
                            <Bar dataKey="Pendapatan" fill="#10B981" radius={[4, 4, 0, 0]} barSize={30} />
                            <Bar dataKey="Beban" fill="#EF4444" radius={[4, 4, 0, 0]} barSize={30} />
                        </BarChart>
                    </ResponsiveContainer>
                ) : (
                    <div className="h-full flex flex-col items-center justify-center text-gray-400">
                        <BarChartIcon className="w-10 h-10 mb-2 opacity-50" />
                        <p>Belum ada data transaksi</p>
                    </div>
                )}
            </div>
         </div>

         {/* PIE CHART */}
         <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm">
            <h3 className="text-lg font-bold text-gray-800 mb-6 flex items-center gap-2">
                <PieIcon className="w-5 h-5 text-gray-500" />
                Komposisi Beban
            </h3>
            <div className="h-80 w-full">
                {expenseComposition.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                            <Pie
                                data={expenseComposition}
                                cx="50%"
                                cy="50%"
                                innerRadius={60}
                                outerRadius={80}
                                paddingAngle={5}
                                dataKey="value"
                            >
                                {expenseComposition.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                ))}
                            </Pie>
                            <RechartsTooltip formatter={(value: number) => formatCurrency(value)} />
                            <Legend 
                                layout="horizontal" 
                                verticalAlign="bottom" 
                                align="center"
                                wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }}
                            />
                        </PieChart>
                    </ResponsiveContainer>
                ) : (
                    <div className="h-full flex flex-col items-center justify-center text-gray-400">
                         <PieIcon className="w-10 h-10 mb-2 opacity-50" />
                         <p>Belum ada data beban</p>
                    </div>
                )}
            </div>
         </div>
      </div>

      {/* RATIO ANALYTICS SECTION */}
      <div>
         <div className="flex items-center gap-2 mb-4">
             <Scale className="w-5 h-5 text-gray-800" />
             <h3 className="text-lg font-bold text-gray-800">Analisis Rasio Keuangan</h3>
         </div>
         
         <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            
            {/* LIKUIDITAS */}
            <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm">
                <div className="flex items-center gap-2 mb-4 pb-2 border-b border-gray-100">
                    <div className="p-1.5 bg-blue-50 rounded text-blue-600"><Wallet className="w-4 h-4"/></div>
                    <h4 className="font-bold text-gray-800">Likuiditas</h4>
                </div>
                <div className="space-y-5">
                    <RatioRow 
                        label="Current Ratio" 
                        value={ratios.currentRatio.toFixed(2)} 
                        desc="Aset Lancar / Kewajiban Lancar" 
                        status={ratios.currentRatio >= 2 ? 'good' : ratios.currentRatio >= 1 ? 'ok' : 'bad'}
                        remark={getRatioAnalysis('CURRENT_RATIO', ratios.currentRatio)}
                    />
                    <RatioRow 
                        label="Cash Ratio" 
                        value={ratios.cashRatio.toFixed(2)} 
                        desc="Kas / Kewajiban Lancar" 
                        status={ratios.cashRatio >= 0.5 ? 'good' : 'ok'}
                        remark={getRatioAnalysis('CASH_RATIO', ratios.cashRatio)}
                    />
                    <div className="flex justify-between items-start">
                        <div>
                            <p className="text-sm font-semibold text-gray-700">Modal Kerja</p>
                            <p className="text-xs text-gray-400">Aset Lancar - Kewajiban Lancar</p>
                            <p className="text-[10px] italic text-green-600 mt-0.5">
                                {ratios.workingCapital > 0 ? "Modal kerja positif. Operasional aman." : "Defisit modal kerja. Risiko operasional."}
                            </p>
                        </div>
                        <p className="font-mono font-bold text-gray-900">{formatShortCurrency(ratios.workingCapital)}</p>
                    </div>
                </div>
            </div>

            {/* PROFITABILITAS */}
            <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm">
                <div className="flex items-center gap-2 mb-4 pb-2 border-b border-gray-100">
                    <div className="p-1.5 bg-emerald-50 rounded text-emerald-600"><Percent className="w-4 h-4"/></div>
                    <h4 className="font-bold text-gray-800">Profitabilitas</h4>
                </div>
                <div className="space-y-5">
                    <RatioRow 
                        label="Gross Profit Margin" 
                        value={`${ratios.grossProfitMargin.toFixed(1)}%`} 
                        desc="Laba Kotor / Pendapatan" 
                        status={ratios.grossProfitMargin > 30 ? 'good' : 'ok'}
                        remark={getRatioAnalysis('GPM', ratios.grossProfitMargin)}
                    />
                    <RatioRow 
                        label="Net Profit Margin" 
                        value={`${ratios.netProfitMargin.toFixed(1)}%`} 
                        desc="Laba Bersih / Pendapatan" 
                        status={ratios.netProfitMargin > 15 ? 'good' : ratios.netProfitMargin > 0 ? 'ok' : 'bad'}
                        remark={getRatioAnalysis('NPM', ratios.netProfitMargin)}
                    />
                     <RatioRow 
                        label="Return on Equity (ROE)" 
                        value={`${ratios.returnOnEquity.toFixed(1)}%`} 
                        desc="Laba Bersih / Ekuitas" 
                        status={ratios.returnOnEquity > 10 ? 'good' : 'ok'}
                        remark={getRatioAnalysis('ROE', ratios.returnOnEquity)}
                    />
                     <RatioRow 
                        label="Return on Assets (ROA)" 
                        value={`${ratios.returnOnAssets.toFixed(1)}%`} 
                        desc="Laba Bersih / Aset" 
                        status={ratios.returnOnAssets > 5 ? 'good' : 'ok'}
                        remark={ratios.returnOnAssets > 5 ? "Aset produktif menghasilkan laba." : "Pemanfaatan aset perlu dioptimalkan."}
                    />
                </div>
            </div>

            {/* SOLVABILITAS & AKTIVITAS */}
            <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm">
                <div className="flex items-center gap-2 mb-4 pb-2 border-b border-gray-100">
                    <div className="p-1.5 bg-orange-50 rounded text-orange-600"><Zap className="w-4 h-4"/></div>
                    <h4 className="font-bold text-gray-800">Solvabilitas & Aktivitas</h4>
                </div>
                <div className="space-y-5">
                    <RatioRow 
                        label="Debt to Equity (DER)" 
                        value={ratios.debtToEquity.toFixed(2)} 
                        desc="Total Utang / Modal" 
                        status={ratios.debtToEquity < 1 ? 'good' : ratios.debtToEquity < 2 ? 'ok' : 'bad'}
                        remark={getRatioAnalysis('DER', ratios.debtToEquity)}
                    />
                    <RatioRow 
                        label="Asset to Equity" 
                        value={`${ratios.assetToEquity.toFixed(2)}x`} 
                        desc="Total Aset / Modal" 
                        status={'ok'}
                        remark="Tingkat leverage aset terhadap modal."
                    />
                    <RatioRow 
                        label="Debt Ratio" 
                        value={`${ratios.debtRatio.toFixed(1)}%`} 
                        desc="Total Utang / Total Aset" 
                        status={ratios.debtRatio < 50 ? 'good' : 'ok'}
                        remark={ratios.debtRatio < 50 ? "Aset didanai mayoritas oleh modal sendiri." : "Aset didanai mayoritas oleh utang."}
                    />
                    <RatioRow 
                        label="Asset Turnover" 
                        value={`${ratios.assetTurnover.toFixed(2)}x`} 
                        desc="Pendapatan / Total Aset" 
                        status={'ok'}
                        remark="Kecepatan perputaran aset menjadi pendapatan."
                    />
                </div>
            </div>
         </div>
      </div>
    </div>
  );
};

// --- SUB COMPONENTS ---

const SummaryCard = ({ title, amount, icon: Icon, color, subText }: any) => {
    const colorClasses: Record<string, string> = {
        emerald: 'bg-emerald-50 text-emerald-600 group-hover:text-emerald-700',
        red: 'bg-red-50 text-red-600 group-hover:text-red-700',
        blue: 'bg-blue-50 text-blue-600 group-hover:text-blue-700',
        orange: 'bg-orange-50 text-orange-600 group-hover:text-orange-700'
    };

    return (
        <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition-all group">
           <div className="flex justify-between items-start mb-4">
              <div>
                 <p className="text-sm font-medium text-gray-500 mb-1">{title}</p>
                 <h3 className={`text-2xl font-bold text-gray-900 transition-colors`}>
                    {formatShortCurrency(amount)}
                 </h3>
              </div>
              <div className={`p-3 rounded-lg ${colorClasses[color]}`}>
                 <Icon className="w-6 h-6" />
              </div>
           </div>
           <div className={`flex items-center text-xs font-medium w-fit px-2 py-1 rounded ${colorClasses[color]}`}>
              {subText}
           </div>
        </div>
    );
};

const RatioRow = ({ label, value, desc, status, remark }: { label: string, value: string, desc: string, status: 'good' | 'ok' | 'bad', remark?: string }) => {
    const statusColor = {
        good: 'text-emerald-600',
        ok: 'text-blue-600',
        bad: 'text-red-600'
    };

    const bgStatus = {
        good: 'bg-emerald-50',
        ok: 'bg-blue-50',
        bad: 'bg-red-50'
    }

    return (
        <div className="flex justify-between items-start">
            <div>
                <p className="text-sm font-semibold text-gray-700">{label}</p>
                <p className="text-xs text-gray-400">{desc}</p>
                {remark && (
                    <div className={`mt-1 text-[10px] italic font-medium px-1.5 py-0.5 rounded w-fit ${statusColor[status]} ${bgStatus[status]}`}>
                        "{remark}"
                    </div>
                )}
            </div>
            <span className={`text-lg font-mono font-bold ${statusColor[status]}`}>
                {value}
            </span>
        </div>
    );
};

// Icon wrapper for usage
const BarChartIcon = (props: any) => (
    <svg 
      xmlns="http://www.w3.org/2000/svg" 
      width="24" 
      height="24" 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth="2" 
      strokeLinecap="round" 
      strokeLinejoin="round" 
      {...props}
    >
      <line x1="12" y1="20" x2="12" y2="10"></line>
      <line x1="18" y1="20" x2="18" y2="4"></line>
      <line x1="6" y1="20" x2="6" y2="16"></line>
    </svg>
);
