
import React, { useState, useEffect, useRef } from 'react';
import { HierarchicalAccount, AccountType, JournalEntry, CashFlowCategory, CompanyProfile, Contact, JournalLine, AccountBudget } from '../../types';
import { useUI } from '../../src/context/UIContext';
import { AuthUser } from '../../src/context/AuthContext';
import { accountsService } from '../../src/services/accounts.service';
import { journalsService } from '../../src/services/journals.service';
import { contactsService } from '../../src/services/contacts.service';
import { settingsService, budgetsService, periodsService } from '../../src/services/settings.service';
import { 
  FileText, Printer, Download, Search, Calendar, Filter, ChevronDown, 
  ChevronRight, ArrowLeft, X, TrendingUp, Scale, PieChart, 
  CreditCard, Users, BookOpen, Layers, Info, Building, RefreshCw, Activity, Zap, ArrowUp, ArrowDown, Clock, ArrowRight, Target,
  LayoutList, Columns2, ShieldCheck, ClipboardCheck, FileSpreadsheet
} from 'lucide-react';
import * as XLSX from 'xlsx';

// --- UTILS ---
const formatCurrency = (amount: number) => {
  const absAmount = Math.abs(amount);
  const formatted = new Intl.NumberFormat('id-ID', { 
    style: 'currency', 
    currency: 'IDR', 
    minimumFractionDigits: 0, 
    maximumFractionDigits: 0 
  }).format(absAmount);
  return amount < 0 ? `(${formatted})` : formatted;
};

const formatNumber = (num: number) => {
  if (num === 0) return '0';
  const absNum = Math.abs(num);
  const formatted = new Intl.NumberFormat('id-ID').format(absNum);
  return num < 0 ? `-${formatted}` : formatted;
};

const formatDateIndo = (dateStr: string) => { 
  if (!dateStr) return ''; 
  const date = new Date(dateStr); 
  return new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }).format(date); 
};

const formatDateShort = (dateStr: string) => { 
  if (!dateStr) return ''; 
  const date = new Date(dateStr); 
  const day = String(date.getDate()).padStart(2, '0'); 
  const month = String(date.getMonth() + 1).padStart(2, '0'); 
  const year = String(date.getFullYear()).slice(-2); 
  return `${day}-${month}-${year}`; 
};

const formatAccountCode = (code: string) => { 
  const clean = code.replace(/\D/g, ''); 
  if (clean.length > 8) return clean.slice(0, 8); 
  if (clean.length <= 3) return clean; 
  if (clean.length <= 5) return `${clean.slice(0, 3)}-${clean.slice(3)}`; 
  return `${clean.slice(0, 3)}-${clean.slice(3, 5)}-${clean.slice(5, 8)}`; 
};

type ReportType = 'NERACA' | 'NERACA_PERBANDINGAN' | 'LABA_RUGI' | 'LABA_RUGI_PERBANDINGAN' | 'ARUS_KAS' | 'NERACA_SALDO' | 'BUKU_BESAR' | 'BUKU_BESAR_SEMUA' | 'PERUBAHAN_EKUITAS' | 'TAX_SUMMARY' | 'HUTANG' | 'PIUTANG' | 'AGING_PIUTANG' | 'AGING_HUTANG' | 'BUDGET_VS_ACTUAL';

interface ReportCardProps {
    title: string;
    desc: string;
    type: ReportType;
    icon?: React.ElementType;
    color?: string;
    children?: React.ReactNode;
}

// --- PRINT UTILITY ---
function openPrintTab(innerContent: string, title: string, landscape = false, excelDataUrl = '', excelFileName = '') {
  const allCss = Array.from(document.styleSheets).flatMap((ss) => {
    try { return Array.from(ss.cssRules).map((r) => r.cssText); }
    catch { return ss.href ? [`@import url("${ss.href}");`] : []; }
  }).join('\n');

  const pageSize = landscape ? 'A4 landscape' : 'A4 portrait';
  const maxW = landscape ? '272mm' : '210mm';
  const excelBtn = excelDataUrl
    ? `<a href="${excelDataUrl}" download="${excelFileName}" class="nbtn nbtn-excel" style="text-decoration:none">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
        Export Excel
      </a>`
    : '';

  // Use Blob URL — much more reliable than document.write() for large HTML
  const html = `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Preview: ${title}</title>
  <style>${allCss}</style>
  <style>
    @page { size: ${pageSize}; margin: 14mm 14mm 20mm 14mm; }
    @media print {
      .no-print { display: none !important; }
      body { margin: 0 !important; background: white !important; padding: 0 !important; }
      .page-wrap { padding: 0 !important; }
      .paper { box-shadow: none !important; margin: 0 !important; max-width: 100% !important; padding: 14mm !important; border-radius: 0 !important; }
      * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
    }
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body { background: #e5e7eb; font-family: 'Inter', Arial, sans-serif; min-height: 100vh; color: #1e293b; }
    .navbar {
      position: sticky; top: 0; z-index: 9999; height: 56px; background: #111827;
      display: flex; align-items: center; justify-content: space-between;
      padding: 0 20px; box-shadow: 0 1px 0 rgba(255,255,255,0.05), 0 4px 16px rgba(0,0,0,0.5);
    }
    .navbar-left { display: flex; align-items: center; gap: 10px; }
    .nav-back {
      width: 36px; height: 36px; border-radius: 50%; border: none;
      background: transparent; color: #9ca3af; cursor: pointer;
      display: flex; align-items: center; justify-content: center;
    }
    .nav-back:hover { background: rgba(255,255,255,0.08); color: white; }
    .nav-divider { width: 1px; height: 20px; background: #374151; }
    .nav-title { color: white; font-weight: 700; font-size: 14px; }
    .navbar-right { display: flex; align-items: center; gap: 8px; }
    .nbtn {
      height: 34px; padding: 0 14px; border-radius: 7px; border: none;
      cursor: pointer; font-size: 12.5px; font-weight: 700;
      display: inline-flex; align-items: center; gap: 6px;
    }
    .nbtn-excel { background: #065f46; color: white; }
    .nbtn-excel:hover { background: #047857; }
    .nbtn-print { background: #b91c1c; color: white; }
    .nbtn-print:hover { background: #991b1b; }
    .nbtn-close { background: #374151; color: #d1d5db; }
    .nbtn-close:hover { background: #4b5563; color: white; }
    .page-wrap { padding: 36px 24px 72px; min-height: calc(100vh - 56px); }
    .paper {
      max-width: ${maxW}; margin: 0 auto; background: white;
      padding: 52px 56px 60px; border-radius: 3px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.06), 0 4px 12px rgba(0,0,0,0.08), 0 16px 48px rgba(0,0,0,0.07);
    }
  </style>
</head>
<body>
  <nav class="navbar no-print">
    <div class="navbar-left">
      <button class="nav-back" onclick="window.close()">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>
      </button>
      <div class="nav-divider"></div>
      <span class="nav-title">Preview: ${title}</span>
    </div>
    <div class="navbar-right">
      ${excelBtn}
      <button class="nbtn nbtn-print" onclick="window.print()">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
        Cetak / PDF
      </button>
      <button class="nbtn nbtn-close" onclick="window.close()">Tutup</button>
    </div>
  </nav>
  <div class="page-wrap">
    <div class="paper">${innerContent}</div>
  </div>
</body>
</html>`;

  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  window.open(url, '_blank');
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}

export const Reports: React.FC<{ user?: AuthUser | null }> = ({ user }) => {
    const isKaryawan = user?.role === 'KARYAWAN';
    const { toast } = useUI();
    const printAreaRef = useRef<HTMLDivElement>(null);
    // FILTER STATE - initialized to current year, updated in useEffect when active period loaded
    const currentYear = new Date().getFullYear().toString();
    const [startDate, setStartDate] = useState(`${currentYear}-01-01`);
    const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
    const [cashFlowMethod, setCashFlowMethod] = useState<'DIRECT' | 'INDIRECT'>('INDIRECT');
    const [neracaLayout, setNeracaLayout] = useState<'STAFEL' | 'SKONTRO'>('STAFEL');
    
    // SIGNATURE STATE
    const [signPlace, setSignPlace] = useState('Jakarta');
    const [signDate, setSignDate] = useState(() => new Date().toISOString().split('T')[0]);
    const [signName, setSignName] = useState('Eko Prasetyo');
    const [signTitle, setSignTitle] = useState('Direktur Keuangan');

    // DATA STATE
    const [activeReport, setActiveReport] = useState<ReportType | null>(null);
    const [reportData, setReportData] = useState<any>(null);
    const [accounts, setAccounts] = useState<HierarchicalAccount[]>([]);
    const [journals, setJournals] = useState<JournalEntry[]>([]);
    const [companyProfile, setCompanyProfile] = useState<CompanyProfile | null>(null);
    const [contacts, setContacts] = useState<Contact[]>([]);
    
    const [activePeriodYear, setActivePeriodYear] = useState<string>('');

    // Ledger/Sub-ledger State
    const [ledgerAccount, setLedgerAccount] = useState<HierarchicalAccount | null>(null);

    // DRILL DOWN STATE
    const [drillDownJournal, setDrillDownJournal] = useState<JournalEntry | null>(null);

    // AUTO-OPEN new tab when report is ready; then close overlay so user stays on main page
    const [autoOpenTab, setAutoOpenTab] = useState(false);
    useEffect(() => {
        if (!autoOpenTab || !activeReport || !reportData) return;
        const timer = setTimeout(() => {
            if (printAreaRef.current) {
                const isLandscape = (neracaLayout === 'SKONTRO' && activeReport === 'NERACA')
                    || activeReport === 'PERUBAHAN_EKUITAS'
                    || activeReport === 'TAX_SUMMARY';
                // Pre-generate Excel as data URL so new tab has Export Excel button
                let excelDataUrl = '';
                let excelFileName = '';
                try {
                    const wb = buildExcelWb(activeReport, reportData);
                    const base64 = XLSX.write(wb, { bookType: 'xlsx', type: 'base64' });
                    excelDataUrl = `data:application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;base64,${base64}`;
                    excelFileName = `AccessTansi_${activeReport}_${formatDateShort(endDate)}.xlsx`;
                } catch (_) { /* Excel generation optional */ }
                openPrintTab(
                    printAreaRef.current.innerHTML,
                    activeReport.replace(/_/g, ' '),
                    isLandscape,
                    excelDataUrl,
                    excelFileName
                );
            }
            setAutoOpenTab(false);
            setActiveReport(null);   // close overlay → user stays on Pusat Laporan
            setReportData(null);
        }, 450);
        return () => clearTimeout(timer);
    }, [autoOpenTab, activeReport, reportData, neracaLayout]);

    useEffect(() => {
        Promise.all([
            accountsService.getAll(),
            journalsService.getAll(),
            settingsService.getProfile(),
            contactsService.getAll(),
            periodsService.getAll(),
        ]).then(([allAccounts, allJournals, profile, allContacts, periods]) => {
            setAccounts(allAccounts);
            setJournals(allJournals);
            setCompanyProfile(profile);
            setContacts(allContacts);

            // Untuk KARYAWAN: langsung set ledgerAccount ke akun pribadi mereka
            if (isKaryawan && user?.linkedAccountId) {
                const linkedAcc = allAccounts.find((a: HierarchicalAccount) => a.id === user.linkedAccountId);
                if (linkedAcc) setLedgerAccount(linkedAcc);
            }

            // Pre-fill signature fields from company profile
            if (profile.signerName)  setSignName(profile.signerName);
            if (profile.signerTitle) setSignTitle(profile.signerTitle);
            if (profile.city)        setSignPlace(profile.city);

            // Set filter dates from active period
            const active = periods.find(p => p.isActive);
            if (active) {
                const thisYear = new Date().getFullYear().toString();
                setStartDate(`${active.year}-01-01`);
                setEndDate(active.year !== thisYear ? `${active.year}-12-31` : new Date().toISOString().split('T')[0]);
                setActivePeriodYear(active.year);
            }
        }).catch(err => console.error('Gagal memuat data laporan:', err));
    }, []);

    // --- CALCULATION LOGIC ---

    const calculateAccountBalanceRange = (account: HierarchicalAccount, dateRange: {start: string, end: string}, cumulative: boolean) => {
        let balance = cumulative ? account.balance : 0; 
        
        journals.forEach(j => {
            if (j.status !== 'POSTED') return;
            const inRange = cumulative 
                ? j.transactionDate <= dateRange.end 
                : (j.transactionDate >= dateRange.start && j.transactionDate <= dateRange.end);
            
            if (inRange) {
                j.lines.forEach(line => {
                    if (line.accountId === account.id) {
                        const isDebitNormal = account.type === AccountType.ASSET || account.type === AccountType.EXPENSE;
                        if (isDebitNormal) balance += (line.debit - line.credit);
                        else balance += (line.credit - line.debit);
                    }
                });
            }
        });
        return balance;
    };

    const calculateNetIncome = (start: string, end: string) => {
        const allRev = accounts.filter(a => (a.type === AccountType.REVENUE || a.code.charAt(0) === '4' || a.code.charAt(0) === '7') && !a.isHeader);
        const allExp = accounts.filter(a => (a.type === AccountType.EXPENSE || ['5', '6', '8', '9'].includes(a.code.charAt(0))) && !a.isHeader);
        
        const totalRev = allRev.reduce((s, a) => s + calculateAccountBalanceRange(a, {start, end}, false), 0);
        const totalExp = allExp.reduce((s, a) => s + calculateAccountBalanceRange(a, {start, end}, false), 0);
        
        return totalRev - totalExp;
    };

    const calculateRollupData = (targetTypes: AccountType[], maxLevel: number, dateRange?: {start: string, end: string}) => {
        const range = dateRange || { start: startDate, end: endDate };
        
        const accountBalances = new Map<string, number>();
        accounts.forEach(acc => {
            if (!acc.isHeader) {
                accountBalances.set(acc.code, calculateAccountBalanceRange(acc, range, true));
            } else {
                accountBalances.set(acc.code, 0);
            }
        });

        const sortedCoa = [...accounts].sort((a, b) => b.level - a.level);
        const rollupBalances = new Map(accountBalances);

        sortedCoa.forEach(acc => {
            if (acc.level > 1) {
                const clean = acc.code.replace(/\D/g, '');
                let parentCode = '';
                if (acc.level === 5) parentCode = clean.substring(0, 5).padEnd(8, '0');
                else if (acc.level === 4) parentCode = clean.substring(0, 3).padEnd(8, '0');
                else if (acc.level === 3) parentCode = clean.substring(0, 2).padEnd(8, '0');
                else if (acc.level === 2) parentCode = clean.substring(0, 1).padEnd(8, '0');

                const currentVal = rollupBalances.get(acc.code) || 0;
                const parentVal = rollupBalances.get(parentCode) || 0;
                rollupBalances.set(parentCode, parentVal + currentVal);
            }
        });

        return accounts
            .filter(acc => targetTypes.includes(acc.type) && acc.level <= maxLevel)
            .map(acc => ({
                ...acc,
                balance: rollupBalances.get(acc.code) || 0
            }))
            .sort((a, b) => a.code.localeCompare(b.code));
    };

    // --- GENERATORS ---

    const handlePreview = async (type: ReportType) => {
        let data: any = null;

        if (type === 'TAX_SUMMARY') {
            const getTaxBalance = (prefix: string) => {
                const targetAccs = accounts.filter(a => a.code.startsWith(prefix) && !a.isHeader);
                return targetAccs.reduce((s, a) => s + calculateAccountBalanceRange(a, {start: startDate, end: endDate}, false), 0);
            };

            const pph21Val = Math.abs(getTaxBalance('21301001'));
            const pph23Val = Math.abs(getTaxBalance('21301002'));
            const pph23Dpp = pph23Val / 0.02;

            const ppnMasukan = Math.abs(getTaxBalance('115')); 
            const ppnKeluaran = Math.abs(getTaxBalance('214')); 
            
            const dppMasukan = ppnMasukan / 0.11;
            const dppKeluaran = ppnKeluaran / 0.11;

            data = {
                withholding: [
                    { label: 'PPh Pasal 21 (Pajak Karyawan)', dpp: 0, rate: 'Progressive', amount: pph21Val },
                    { label: 'PPh Pasal 23 (Jasa/Sewa)', dpp: pph23Dpp, rate: '2%', amount: pph23Val },
                ],
                ppn: {
                    masukan: ppnMasukan,
                    keluaran: ppnKeluaran,
                    dppMasukan,
                    dppKeluaran,
                    net: ppnKeluaran - ppnMasukan,
                    status: (ppnKeluaran - ppnMasukan) >= 0 ? 'Kurang Bayar' : 'Lebih Bayar'
                }
            };
        }
        else if (type === 'PERUBAHAN_EKUITAS') {
            const currYear = new Date(endDate).getFullYear();
            const prevYear = currYear - 1;
            const prevEnd = `${prevYear}-12-31`;
            const prevStart = `${prevYear}-01-01`;

            const getEquityComp = (prefix: string) => {
                const targetAccs = accounts.filter(a => a.code.startsWith(prefix) && !a.isHeader);
                const cur = targetAccs.reduce((s, a) => s + calculateAccountBalanceRange(a, {start: '1900-01-01', end: endDate}, true), 0);
                const prev = targetAccs.reduce((s, a) => s + calculateAccountBalanceRange(a, {start: '1900-01-01', end: prevEnd}, true), 0);
                const diff = targetAccs.reduce((s, a) => s + calculateAccountBalanceRange(a, {start: startDate, end: endDate}, false), 0);
                return { cur, prev, diff };
            };

            const modalDisetor = getEquityComp('311');
            const saldoLaba = getEquityComp('31301001');
            const labaBerjalan = { 
                cur: calculateNetIncome(startDate, endDate), 
                prev: calculateNetIncome(prevStart, prevEnd), 
                diff: calculateNetIncome(startDate, endDate) 
            };
            const deviden = getEquityComp('312');

            data = {
                currYear,
                prevYear,
                rows: [
                    { label: 'Modal Disetor', ...modalDisetor },
                    { label: 'Saldo Laba', ...saldoLaba },
                    { label: 'Laba Rugi Tahun Berjalan', ...labaBerjalan, prev: 0 }, 
                    { label: 'Deviden', ...deviden }
                ]
            };
            
            const totalCur = data.rows.reduce((s:number, r:any) => s + r.cur, 0);
            const totalPrev = data.rows.reduce((s:number, r:any) => s + r.prev, 0);
            const totalDiff = data.rows.reduce((s:number, r:any) => s + r.diff, 0);
            data.total = { cur: totalCur, prev: totalPrev, diff: totalDiff };
        }
        else if (type === 'BUDGET_VS_ACTUAL') {
            const budgetsRaw = await budgetsService.getAll();
            const budgets: AccountBudget[] = budgetsRaw;
            const budgetMap = new Map(budgets.map(b => [b.accountId, b.annualAmount]));

            const expenseAccounts = accounts.filter(a => a.type === AccountType.EXPENSE && !a.isHeader);
            
            data = expenseAccounts.map(acc => {
                const actual = calculateAccountBalanceRange(acc, { start: startDate, end: endDate }, false);
                const annualBudget = budgetMap.get(acc.id) || 0;
                const periodBudget = annualBudget; 
                const variance = periodBudget - actual;
                const pct = periodBudget > 0 ? (actual / periodBudget * 100) : 0;
                
                return {
                    id: acc.id,
                    code: acc.code,
                    name: acc.name,
                    budget: periodBudget,
                    actual: actual,
                    variance,
                    pct
                };
            }).filter(item => item.budget > 0 || item.actual > 0).sort((a,b) => b.actual - a.actual);
        }
        else if (type === 'AGING_PIUTANG' || type === 'AGING_HUTANG') {
            const isAR = type === 'AGING_PIUTANG';
            const prefix = isAR ? '112' : '211';
            const targetDate = new Date(endDate);
            
            const buckets: Record<string, { contact: Contact | null, total: number, b1: number, b2: number, b3: number, b4: number }> = {};

            journals.forEach(j => {
                if (j.status !== 'POSTED' || j.transactionDate > endDate) return;
                
                j.lines.forEach(l => {
                    const acc = accounts.find(a => a.id === l.accountId);
                    if (acc && acc.code.startsWith(prefix) && !acc.isHeader) {
                        const cid = l.contactId || 'unknown';
                        if (!buckets[cid]) {
                            const contact = contacts.find(c => c.id === cid) || null;
                            buckets[cid] = { contact, total: 0, b1: 0, b2: 0, b3: 0, b4: 0 };
                        }

                        const movement = isAR ? (l.debit - l.credit) : (l.credit - l.debit);
                        const transDate = new Date(j.transactionDate);
                        const diffDays = Math.floor((targetDate.getTime() - transDate.getTime()) / (1000 * 3600 * 24));

                        buckets[cid].total += movement;
                        if (diffDays <= 30) buckets[cid].b1 += movement;
                        else if (diffDays <= 60) buckets[cid].b2 += movement;
                        else if (diffDays <= 90) buckets[cid].b3 += movement;
                        else buckets[cid].b4 += movement;
                    }
                });
            });

            data = Object.values(buckets).filter(b => b.total !== 0).sort((a, b) => (a.contact?.name || 'Z').localeCompare(b.contact?.name || 'Z'));
        }
        else if (type === 'LABA_RUGI_PERBANDINGAN') {
            const currStart = new Date(startDate);
            const currEnd = new Date(endDate);
            const diffTime = currEnd.getTime() - currStart.getTime();
            const prevEnd = new Date(currStart.getTime() - 86400000);
            const prevStart = new Date(prevEnd.getTime() - diffTime);

            const ps = prevStart.toISOString().split('T')[0];
            const pe = prevEnd.toISOString().split('T')[0];

            const getPLData = (s: string, e: string) => {
                const revenues = accounts.filter(a => a.type === AccountType.REVENUE && !a.isHeader)
                    .map(a => ({ ...a, balance: calculateAccountBalanceRange(a, {start: s, end: e}, false) }));
                const expenses = accounts.filter(a => a.type === AccountType.EXPENSE && !a.isHeader)
                    .map(a => ({ ...a, balance: calculateAccountBalanceRange(a, {start: s, end: e}, false) }));
                const totalRev = revenues.reduce((sum, a) => sum + a.balance, 0);
                const totalExp = expenses.reduce((sum, a) => sum + a.balance, 0);
                return { revenues, expenses, totalRev, totalExp, net: totalRev - totalExp };
            };

            const current = getPLData(startDate, endDate);
            const previous = getPLData(ps, pe);

            data = {
                current, previous,
                prevPeriod: `${formatDateShort(ps)} - ${formatDateShort(pe)}`,
                currPeriod: `${formatDateShort(startDate)} - ${formatDateShort(endDate)}`
            };
        }
        else if (type === 'NERACA_PERBANDINGAN') {
            const currEnd = endDate;
            const prevEnd = new Date(new Date(currEnd).getFullYear() - 1, 11, 31).toISOString().split('T')[0];

            const getBSData = (end: string) => {
                const assets = calculateRollupData([AccountType.ASSET], 3, {start: '1900-01-01', end});
                const liab = calculateRollupData([AccountType.LIABILITY], 3, {start: '1900-01-01', end});
                const eq = calculateRollupData([AccountType.EQUITY], 3, {start: '1900-01-01', end});
                const net = calculateNetIncome('1900-01-01', end);
                const totalA = assets.filter(a => a.level === 1).reduce((s, a) => s + a.balance, 0);
                const totalL = liab.filter(a => a.level === 1).reduce((s, a) => s + a.balance, 0);
                const totalE = eq.filter(a => a.level === 1).reduce((s, a) => s + a.balance, 0) + net;
                return { assets, liab, eq, totalA, totalL, totalE, net };
            };

            data = {
                current: getBSData(currEnd),
                previous: getBSData(prevEnd),
                prevLabel: `Per ${formatDateShort(prevEnd)}`,
                currLabel: `Per ${formatDateShort(currEnd)}`
            };
        }
        else if (type === 'BUKU_BESAR_SEMUA') {
            const prevDate = new Date(new Date(startDate).getTime() - 86400000).toISOString().split('T')[0];
            const allDetailAccounts = accounts.filter(a => !a.isHeader).sort((a, b) => a.code.localeCompare(b.code));
            
            const ledgerData = allDetailAccounts.map(acc => {
                const openingBalance = calculateAccountBalanceRange(acc, {start: '1900-01-01', end: prevDate}, true);
                const transactions = journals.filter(j => j.status === 'POSTED' && j.transactionDate >= startDate && j.transactionDate <= endDate)
                    .flatMap(j => j.lines.filter(l => l.accountId === acc.id).map(l => ({ 
                        ...l, 
                        date: j.transactionDate, 
                        ref: j.referenceNumber, 
                        desc: l.description || j.description 
                    })))
                    .sort((a, b) => a.date.localeCompare(b.date));
                
                return { account: acc, openingBalance, transactions };
            }).filter(item => item.openingBalance !== 0 || item.transactions.length > 0);

            data = { accounts: ledgerData };
        }
        else if (type === 'ARUS_KAS') {
            const getCashFlowData = (method: 'DIRECT' | 'INDIRECT') => {
                const cashAccounts = accounts.filter(a => a.code.startsWith('111'));
                const cashIds = new Set(cashAccounts.map(a => a.id));
                const prevDate = new Date(new Date(startDate).getTime() - 86400000).toISOString().split('T')[0];
                const initialCash = cashAccounts.reduce((s, a) => s + calculateAccountBalanceRange(a, {start: '1900-01-01', end: prevDate}, true), 0);
                const endingCash = cashAccounts.reduce((s, a) => s + calculateAccountBalanceRange(a, {start: '1900-01-01', end: endDate}, true), 0);

                if (method === 'DIRECT') {
                    let opReceipts = 0; let opPayments = 0; let invMovements = 0; let finMovements = 0;
                    journals.forEach(j => {
                        if (j.status !== 'POSTED' || j.transactionDate < startDate || j.transactionDate > endDate) return;
                        const cashLine = j.lines.find(l => cashIds.has(l.accountId));
                        if (!cashLine) return;
                        j.lines.forEach(l => {
                            if (cashIds.has(l.accountId)) return;
                            const acc = accounts.find(a => a.id === l.accountId);
                            if (!acc) return;
                            if (acc.type === AccountType.REVENUE || acc.code.startsWith('112')) opReceipts += (l.credit - l.debit);
                            else if (acc.type === AccountType.EXPENSE || acc.code.startsWith('211')) opPayments += (l.debit - l.credit);
                            else if (acc.code.startsWith('12')) invMovements += (l.credit - l.debit);
                            else if (acc.code.startsWith('22') || acc.code.startsWith('3')) finMovements += (l.credit - l.debit);
                        });
                    });
                    return { method: 'DIRECT', initialCash, endingCash, operating: [{ label: 'Penerimaan dari Pelanggan', amount: opReceipts }, { label: 'Pembayaran Beban & Pemasok', amount: -opPayments }], investing: [{ label: 'Aktivitas Investasi Aset Tetap', amount: invMovements }], financing: [{ label: 'Aktivitas Pendanaan & Ekuitas', amount: finMovements }] };
                } else {
                    const netIncome = calculateNetIncome(startDate, endDate);
                    const depreciation = accounts.filter(a => a.code.startsWith('514')).reduce((s, a) => s + calculateAccountBalanceRange(a, {start: startDate, end: endDate}, false), 0);
                    const getDelta = (prefix: string) => {
                        const startBal = accounts.filter(a => a.code.startsWith(prefix) && !a.isHeader).reduce((s, a) => s + calculateAccountBalanceRange(a, {start: '1900-01-01', end: prevDate}, true), 0);
                        const endBal = accounts.filter(a => a.code.startsWith(prefix) && !a.isHeader).reduce((s, a) => s + calculateAccountBalanceRange(a, {start: '1900-01-01', end: endDate}, true), 0);
                        return endBal - startBal;
                    };
                    const deltaAR = getDelta('112'); const deltaAP = getDelta('211'); const deltaInventory = getDelta('113');
                    return { method: 'INDIRECT', initialCash, endingCash, operating: [{ label: 'Laba Bersih Tahun Berjalan', amount: netIncome }, { label: 'Penyesuaian: Beban Penyusutan', amount: depreciation }, { label: 'Perubahan Piutang Usaha', amount: -deltaAR }, { label: 'Perubahan Persediaan', amount: -deltaInventory }, { label: 'Perubahan Utang Usaha', amount: deltaAP }], investing: [{ label: 'Mutasi Aset Tetap', amount: -getDelta('12') }], financing: [{ label: 'Mutasi Modal & Utang J. Panjang', amount: getDelta('22') + getDelta('31') }] };
                }
            };
            data = getCashFlowData(cashFlowMethod);
        }
        else if (type === 'NERACA_SALDO') {
            const openDate = new Date(new Date(startDate).getTime() - 86400000).toISOString().split('T')[0];
            data = accounts.filter(a => !a.isHeader).map(acc => {
                const opening = calculateAccountBalanceRange(acc, { start: '1900-01-01', end: openDate }, true);
                let mutasiDebit = 0, mutasiCredit = 0;
                journals.forEach(j => {
                    if(j.status === 'POSTED' && j.transactionDate >= startDate && j.transactionDate <= endDate) {
                        j.lines.forEach(l => {
                            if(l.accountId === acc.id) {
                                mutasiDebit += l.debit;
                                mutasiCredit += l.credit;
                            }
                        });
                    }
                });
                const isDebitNormal = acc.type === AccountType.ASSET || acc.type === AccountType.EXPENSE;
                let ending = isDebitNormal ? (opening + mutasiDebit - mutasiCredit) : (opening + mutasiCredit - mutasiDebit);
                return { ...acc, opening, mutasiDebit, mutasiCredit, ending };
            }).filter(row => row.opening !== 0 || row.mutasiDebit !== 0 || row.mutasiCredit !== 0).sort((a,b) => a.code.localeCompare(b.code));
        }
        else if (type === 'NERACA') {
            const assets = calculateRollupData([AccountType.ASSET], 3);
            const liabilities = calculateRollupData([AccountType.LIABILITY], 3);
            const equities = calculateRollupData([AccountType.EQUITY], 3);
            const netIncome = calculateNetIncome('1900-01-01', endDate);
            data = { assets, liabilities, equities, netIncome, totalAssets: assets.filter(a => a.level === 1).reduce((s, a) => s + a.balance, 0), totalLiabilities: liabilities.filter(a => a.level === 1).reduce((s, a) => s + a.balance, 0), totalEquity: equities.filter(a => a.level === 1).reduce((s, a) => s + a.balance, 0) };
        }
        else if (type === 'LABA_RUGI') {
            // Ambil semua anak-cucu (isHeader:false) dari sebuah akun level-3 berdasarkan prefix 3 digit kode
            const getLeafChildren = (parent: HierarchicalAccount) => {
                const prefix = parent.code.substring(0, 3);
                return accounts.filter(a => a.code.startsWith(prefix) && a.code !== parent.code && !a.isHeader);
            };
            const revenues = accounts
                .filter(a => a.type === AccountType.REVENUE && a.level === 3)
                .map(a => {
                    const leaves = getLeafChildren(a);
                    const balance = leaves.reduce((sum, child) =>
                        sum + calculateAccountBalanceRange(child, {start: startDate, end: endDate}, false), 0);
                    return { ...a, balance };
                })
                .filter(a => a.balance !== 0);
            const expenses = accounts
                .filter(a => a.type === AccountType.EXPENSE && a.level === 3)
                .map(a => {
                    const leaves = getLeafChildren(a);
                    const balance = leaves.reduce((sum, child) =>
                        sum + calculateAccountBalanceRange(child, {start: startDate, end: endDate}, false), 0);
                    return { ...a, balance };
                })
                .filter(a => a.balance !== 0);
            const totalRevenue = revenues.reduce((s, a) => s + a.balance, 0);
            const totalExpense = expenses.reduce((s, a) => s + a.balance, 0);
            data = { revenues, expenses, totalRevenue, totalExpense, netIncome: totalRevenue - totalExpense };
        }
        else if (type === 'BUKU_BESAR') {
            if (!ledgerAccount) { toast("Pilih akun terlebih dahulu.", 'warning'); return; }
            const prevDate = new Date(new Date(startDate).getTime() - 86400000).toISOString().split('T')[0];
            const openingBalance = calculateAccountBalanceRange(ledgerAccount, {start: '1900-01-01', end: prevDate}, true);
            const transactions = journals.filter(j => j.status === 'POSTED' && j.transactionDate >= startDate && j.transactionDate <= endDate).flatMap(j => j.lines.filter(l => l.accountId === ledgerAccount.id).map(l => ({ ...l, date: j.transactionDate, ref: j.referenceNumber, desc: l.description || j.description }))).sort((a, b) => a.date.localeCompare(b.date));
            data = { account: ledgerAccount, openingBalance, transactions };
        }

        setReportData(data);
        setActiveReport(type);
        setAutoOpenTab(true);
    };

    const handleDrillDown = (reference: string) => {
        const found = journals.find(j => j.referenceNumber === reference);
        if (found) {
            setDrillDownJournal(found);
        } else {
            toast("Data jurnal tidak ditemukan.", 'warning');
        }
    };

    // Shared Excel workbook builder (used by button + new-tab export)
    const buildExcelWb = (rType: string, rData: any) => {
        const wb = XLSX.utils.book_new();
        let wsData: any[][] = [
            [companyProfile?.name || 'ACCESSTANSI CORP'],
            [rType.replace(/_/g, ' ')],
            [`Periode: ${formatDateShort(startDate)} s/d ${formatDateShort(endDate)}`],
            [],
        ];

        if (rType === 'NERACA') {
            wsData.push(['Keterangan', 'Saldo (IDR)']);
            rData.assets.forEach((a: any) => wsData.push([a.name, a.balance]));
            wsData.push(['TOTAL ASET', rData.totalAssets]);
            wsData.push([]);
            wsData.push(['KEWAJIBAN']);
            rData.liabilities.forEach((l: any) => wsData.push([l.name, l.balance]));
            wsData.push(['TOTAL KEWAJIBAN', rData.totalLiabilities]);
            wsData.push([]);
            wsData.push(['EKUITAS']);
            rData.equities.forEach((e: any) => wsData.push([e.name, e.balance]));
            wsData.push(['Laba Tahun Berjalan', rData.netIncome]);
            wsData.push(['TOTAL EKUITAS', rData.totalEquity + rData.netIncome]);
            wsData.push(['TOTAL PASIVA', Math.abs(rData.totalLiabilities) + Math.abs(rData.totalEquity) + rData.netIncome]);
        } else if (rType === 'LABA_RUGI') {
            wsData.push(['Keterangan', 'Nilai (IDR)']);
            wsData.push(['PENDAPATAN']);
            rData.revenues.forEach((r: any) => wsData.push([r.name, Math.abs(r.balance)]));
            wsData.push(['Total Pendapatan', Math.abs(rData.totalRevenue)]);
            wsData.push([]);
            wsData.push(['BEBAN']);
            rData.expenses.forEach((e: any) => wsData.push([e.name, e.balance]));
            wsData.push(['Total Beban', rData.totalExpense]);
            wsData.push([]);
            wsData.push(['LABA / (RUGI) BERSIH', rData.netIncome]);
        } else if (rType === 'TAX_SUMMARY') {
            wsData.push(['REKAPITULASI PPh POTONG PUNGUT']);
            wsData.push(['Jenis Pajak', 'DPP (Estimasi)', 'Tarif', 'Nilai Pajak Terhutang']);
            rData.withholding.forEach((w: any) => wsData.push([w.label, w.dpp, w.rate, w.amount]));
            wsData.push([]);
            wsData.push(['REKAPITULASI PPN']);
            wsData.push(['Keterangan', 'Nilai (IDR)']);
            wsData.push(['PPN Keluaran (Penjualan)', rData.ppn.keluaran]);
            wsData.push(['PPN Masukan (Pembelian)', rData.ppn.masukan]);
            wsData.push(['Net Selisih PPN', rData.ppn.net]);
            wsData.push(['Status Pajak', rData.ppn.status]);
        } else if (rType === 'BUKU_BESAR_SEMUA') {
            wsData.push(['Akun', 'Tanggal', 'No. Bukti', 'Keterangan', 'Debit', 'Kredit', 'Saldo']);
            rData.accounts.forEach((item: any) => {
                let rb = item.openingBalance;
                wsData.push([`${item.account.code} - ${item.account.name}`, startDate, '-', 'Saldo Awal', 0, 0, rb]);
                item.transactions.forEach((t: any) => {
                    const isDebitNormal = item.account.type === AccountType.ASSET || item.account.type === AccountType.EXPENSE;
                    if (isDebitNormal) rb += (t.debit - t.credit); else rb += (t.credit - t.debit);
                    wsData.push(['', t.date, t.ref, t.desc, t.debit, t.credit, rb]);
                });
                wsData.push([]);
            });
        } else if (rType === 'ARUS_KAS') {
            wsData.push(['Kategori', 'Keterangan', 'Nilai (IDR)']);
            wsData.push(['Operasional']);
            rData.operating.forEach((o: any) => wsData.push(['', o.label, o.amount]));
            wsData.push(['Investasi']);
            rData.investing.forEach((i: any) => wsData.push(['', i.label, i.amount]));
            wsData.push(['Pendanaan']);
            rData.financing.forEach((f: any) => wsData.push(['', f.label, f.amount]));
            wsData.push([]);
            wsData.push(['Saldo Kas Awal', rData.initialCash]);
            wsData.push(['Kenaikan / (Penurunan) Net', rData.endingCash - rData.initialCash]);
            wsData.push(['Saldo Kas Akhir', rData.endingCash]);
        } else if (rType === 'NERACA_SALDO') {
            wsData.push(['Kode', 'Nama Akun', 'Saldo Awal', 'Mutasi (D)', 'Mutasi (K)', 'Saldo Akhir']);
            rData.forEach((r: any) => wsData.push([r.code, r.name, r.opening, r.mutasiDebit, r.mutasiCredit, r.ending]));
        } else if (rType === 'AGING_PIUTANG' || rType === 'AGING_HUTANG') {
            wsData.push(['Kontak', '0 - 30 Hari', '31 - 60 Hari', '61 - 90 Hari', '> 90 Hari', 'Total']);
            rData.forEach((r: any) => wsData.push([r.contact?.name || 'Tanpa Kontak', r.b1, r.b2, r.b3, r.b4, r.total]));
        } else if (rType === 'BUDGET_VS_ACTUAL') {
            wsData.push(['Nama Akun', 'Anggaran', 'Realisasi', 'Selisih', '%']);
            rData.forEach((r: any) => wsData.push([r.name, r.budget, r.actual, r.variance, r.pct]));
        } else if (rType === 'PERUBAHAN_EKUITAS') {
            wsData.push(['Keterangan', String(rData.currYear), 'Penambahan/(Pengurangan)', String(rData.prevYear)]);
            rData.rows.forEach((r: any) => wsData.push([r.label, r.cur, r.diff, r.prev]));
            wsData.push(['TOTAL EKUITAS', rData.total.cur, rData.total.diff, rData.total.prev]);
        }
        const ws = XLSX.utils.aoa_to_sheet(wsData);
        XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
        return wb;
    };

    const handleExportExcel = () => {
        if (!activeReport || !reportData) return;
        const wb = buildExcelWb(activeReport, reportData);
        XLSX.writeFile(wb, `AccessTansi_${activeReport}_${formatDateShort(endDate)}.xlsx`);
    };

    useEffect(() => {
        if (activeReport === 'ARUS_KAS') handlePreview('ARUS_KAS');
    }, [cashFlowMethod]);

    useEffect(() => {
        if (activeReport === 'BUKU_BESAR' && ledgerAccount) {
            handlePreview('BUKU_BESAR');
        }
    }, [ledgerAccount, startDate, endDate]);

    const ReportCard: React.FC<ReportCardProps> = ({ title, desc, type, icon: Icon, color, children }) => (
        <div className="bg-white p-5 rounded-xl border border-gray-100 hover:border-primary-200 shadow-sm hover:shadow-md transition-all group flex flex-col justify-between h-full">
            <div>
                <div className="flex items-center gap-3 mb-3">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${color ? color : 'bg-gray-100 text-gray-600'}`}>
                        {Icon ? <Icon className="w-5 h-5" /> : <FileText className="w-5 h-5" />}
                    </div>
                    <h3 className="font-bold text-gray-900 group-hover:text-primary-700 transition-colors">{title}</h3>
                </div>
                <p className="text-sm text-gray-500 leading-relaxed mb-4 min-h-[40px]">{desc}</p>
                {children}
            </div>
            <div className="mt-2 pt-4 border-t border-gray-50 flex items-center justify-between">
                <span className="text-xs text-gray-400 font-medium px-2 py-1 bg-gray-50 rounded">Audit Ready</span>
                <button onClick={() => handlePreview(type)} className="flex items-center gap-1.5 text-sm font-bold text-white bg-primary-500 hover:bg-primary-600 px-4 py-2 rounded-lg transition-colors shadow-sm">
                    <Search className="w-4 h-4" /> Preview
                </button>
            </div>
        </div>
    );

    return (
        <div className="space-y-8 pb-20">
            <div className="sticky top-0 z-20 bg-white/95 backdrop-blur-sm border-b border-gray-200 py-4 -mx-4 px-4 md:-mx-8 md:px-8 shadow-sm">
                <div className="max-w-7xl mx-auto flex flex-col md:flex-row gap-6 items-center justify-between">
                    <div className="flex items-center gap-4">
                        <div>
                            <h2 className="text-2xl font-bold text-gray-900">Pusat Laporan</h2>
                            <p className="text-sm text-gray-500">Hasil analisis keuangan real-time dari buku besar.</p>
                        </div>
                        {activePeriodYear && (
                            <div className="hidden sm:flex items-center gap-2 px-3 py-1 bg-primary-50 border border-primary-100 rounded-full">
                                <div className="w-1.5 h-1.5 rounded-full bg-primary-500 animate-pulse"></div>
                                <span className="text-[10px] font-bold text-primary-700 uppercase tracking-wider">Tahun Buku {activePeriodYear}</span>
                            </div>
                        )}
                    </div>
                    <div className="flex flex-wrap gap-2 items-center">
                        <div className="flex items-center bg-gray-50 p-1.5 rounded-lg border border-gray-200">
                            <Calendar className="w-4 h-4 text-gray-400 ml-2 mr-1" />
                            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="bg-transparent border-none text-sm font-medium text-gray-700 focus:ring-0 w-32" />
                            <span className="text-gray-400">-</span>
                            <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="bg-transparent border-none text-sm font-medium text-gray-700 focus:ring-0 w-32" />
                        </div>
                        <button
                            onClick={() => {
                                const year = activePeriodYear || new Date().getFullYear().toString();
                                setStartDate(`${year}-01-01`);
                                const thisYear = new Date().getFullYear().toString();
                                setEndDate(activePeriodYear && activePeriodYear !== thisYear ? `${activePeriodYear}-12-31` : new Date().toISOString().split('T')[0]);
                            }}
                            className="p-2 text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
                            title="Reset ke Periode Aktif"
                        >
                            <RefreshCw className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            </div>

            {activePeriodYear && (startDate.substring(0, 4) !== activePeriodYear || endDate.substring(0, 4) !== activePeriodYear) && (
                <div className="max-w-7xl mx-auto bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-center gap-3 text-xs text-amber-700 shadow-sm">
                    <Info className="w-4 h-4" />
                    <span className="font-medium">Catatan: Anda sedang melihat laporan di luar Tahun Buku yang aktif ({activePeriodYear}).</span>
                </div>
            )}

            {/* KARYAWAN hanya lihat Buku Besar akun pribadi */}
            {isKaryawan ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    <ReportCard title="Buku Besar Satuan" desc={`Riwayat mutasi transaksi akun Anda.`} type="BUKU_BESAR" icon={BookOpen} color="bg-indigo-50 text-indigo-600">
                        {ledgerAccount ? (
                            <p className="text-xs font-medium text-indigo-700 bg-indigo-50 rounded px-2 py-1 mt-1">{ledgerAccount.code} - {ledgerAccount.name}</p>
                        ) : (
                            <p className="text-xs text-red-500 mt-1">Akun belum dikonfigurasi. Hubungi admin.</p>
                        )}
                    </ReportCard>
                </div>
            ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <ReportCard title="Neraca" desc="Posisi Aset, Kewajiban, dan Modal perusahaan." type="NERACA" icon={Scale} color="bg-primary-50 text-primary-600" />
                <ReportCard title="Laba Rugi" desc="Laporan Laba Rugi dan Penghasilan Komprehensif Lain" type="LABA_RUGI" icon={TrendingUp} color="bg-primary-50 text-primary-600" />
                <ReportCard title="Arus Kas" desc="Aliran kas masuk dan keluar dari operasional, investasi, dan pendanaan." type="ARUS_KAS" icon={Activity} color="bg-primary-50 text-primary-600">
                    <div className="flex gap-1 bg-gray-100 p-1 rounded-lg mb-2">
                        <button
                            onClick={(e) => { e.stopPropagation(); setCashFlowMethod('INDIRECT'); }}
                            className={`flex-1 px-2 py-1.5 rounded text-xs font-bold transition-all ${cashFlowMethod === 'INDIRECT' ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
                        >Tidak Langsung</button>
                        <button
                            onClick={(e) => { e.stopPropagation(); setCashFlowMethod('DIRECT'); }}
                            className={`flex-1 px-2 py-1.5 rounded text-xs font-bold transition-all ${cashFlowMethod === 'DIRECT' ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
                        >Langsung</button>
                    </div>
                </ReportCard>

                <ReportCard title="Perubahan Ekuitas" desc="Laporan historis perubahan modal dan saldo laba." type="PERUBAHAN_EKUITAS" icon={Layers} color="bg-indigo-50 text-indigo-600" />
                <ReportCard title="Rekapitulasi Pajak" desc="Ringkasan saldo akun PPh dan PPN untuk pelaporan SPT." type="TAX_SUMMARY" icon={ShieldCheck} color="bg-amber-50 text-amber-600" />

                <ReportCard title="Neraca Perbandingan" desc="Bandingkan posisi keuangan periode ini dengan tahun sebelumnya." type="NERACA_PERBANDINGAN" icon={Scale} color="bg-emerald-50 text-emerald-600" />
                <ReportCard title="Laba Rugi Perbandingan" desc="Analisis kenaikan/penurunan performa dibanding periode lalu." type="LABA_RUGI_PERBANDINGAN" icon={TrendingUp} color="bg-emerald-50 text-emerald-600" />

                <ReportCard title="Budget vs Realisasi" desc="Evaluasi pengeluaran aktual terhadap anggaran yang direncanakan." type="BUDGET_VS_ACTUAL" icon={Target} color="bg-purple-50 text-purple-600" />

                <ReportCard title="Aging Piutang" desc="Analisis umur piutang pelanggan untuk manajemen penagihan." type="AGING_PIUTANG" icon={Clock} color="bg-orange-50 text-orange-600" />
                <ReportCard title="Aging Hutang" desc="Jadwal jatuh tempo hutang ke vendor/pemasok." type="AGING_HUTANG" icon={Clock} color="bg-orange-50 text-orange-600" />

                <ReportCard title="Neraca Saldo" desc="Daftar saldo akhir seluruh akun (Trial Balance)." type="NERACA_SALDO" icon={Layers} color="bg-blue-50 text-blue-600" />
                <ReportCard title="Buku Besar (Semua)" desc="Laporan historis mutasi transaksi seluruh akun." type="BUKU_BESAR_SEMUA" icon={BookOpen} color="bg-indigo-50 text-indigo-600" />

                <ReportCard title="Buku Besar Satuan" desc="Historis mutasi transaksi per akun detail." type="BUKU_BESAR" icon={BookOpen} color="bg-indigo-50 text-indigo-600">
                    <select value={ledgerAccount?.id || ''} onChange={(e) => setLedgerAccount(accounts.find(a => a.id === e.target.value) || null)} className="w-full mt-2 text-xs border border-gray-200 rounded-lg p-2 outline-none focus:border-indigo-500">
                        <option value="">-- Pilih Akun --</option>
                        {accounts.filter(a => !a.isHeader).sort((a,b)=>a.code.localeCompare(b.code)).map(a => (
                            <option key={a.id} value={a.id}>{a.code} - {a.name}</option>
                        ))}
                    </select>
                </ReportCard>
            </div>
            )}

            {activeReport && reportData && (
                <div className={`fixed inset-0 z-50 bg-white overflow-auto${autoOpenTab ? ' opacity-0 pointer-events-none' : ''}`}>
                    <div className="sticky top-0 z-30 bg-gray-900 text-white px-6 py-4 flex justify-between items-center print:hidden shadow-lg">
                        <div className="flex items-center gap-4">
                            <button onClick={() => setActiveReport(null)} className="p-2 hover:bg-gray-800 rounded-full"><ArrowLeft className="w-5 h-5"/></button>
                            <h3 className="font-bold">Preview: {activeReport.replace(/_/g, ' ')}</h3>
                            
                            {activeReport === 'ARUS_KAS' && (
                                <div className="flex gap-2 ml-6 bg-gray-800 p-1 rounded-lg">
                                    <button onClick={() => setCashFlowMethod('INDIRECT')} className={`px-3 py-1 rounded text-xs font-bold transition ${cashFlowMethod === 'INDIRECT' ? 'bg-primary-500 text-white' : 'text-gray-400 hover:text-white'}`}>Metode Tidak Langsung</button>
                                    <button onClick={() => setCashFlowMethod('DIRECT')} className={`px-3 py-1 rounded text-xs font-bold transition ${cashFlowMethod === 'DIRECT' ? 'bg-primary-500 text-white' : 'text-gray-400 hover:text-white'}`}>Metode Langsung</button>
                                </div>
                            )}

                            {activeReport === 'NERACA' && (
                                <div className="flex gap-2 ml-6 bg-gray-800 p-1 rounded-lg">
                                    <button 
                                        onClick={() => setNeracaLayout('STAFEL')} 
                                        className={`flex items-center gap-1.5 px-3 py-1 rounded text-xs font-bold transition ${neracaLayout === 'STAFEL' ? 'bg-primary-500 text-white' : 'text-gray-400 hover:text-white'}`}
                                    >
                                        <LayoutList className="w-3.5 h-3.5" /> Stafel
                                    </button>
                                    <button 
                                        onClick={() => setNeracaLayout('SKONTRO')} 
                                        className={`flex items-center gap-1.5 px-3 py-1 rounded text-xs font-bold transition ${neracaLayout === 'SKONTRO' ? 'bg-primary-500 text-white' : 'text-gray-400 hover:text-white'}`}
                                    >
                                        <Columns2 className="w-3.5 h-3.5" /> Skontro
                                    </button>
                                </div>
                            )}

                            {activeReport === 'BUKU_BESAR' && (
                                <div className="flex items-center gap-2 ml-6 bg-gray-800 px-3 py-1.5 rounded-lg border border-gray-700">
                                    <BookOpen className="w-3.5 h-3.5 text-primary-400" />
                                    <span className="text-[10px] font-bold text-gray-500 uppercase hidden sm:inline">Ganti Akun:</span>
                                    <select 
                                        value={ledgerAccount?.id || ''} 
                                        onChange={(e) => {
                                            const acc = accounts.find(a => a.id === e.target.value) || null;
                                            setLedgerAccount(acc);
                                        }} 
                                        className="bg-transparent border-none text-xs font-bold text-white focus:ring-0 cursor-pointer min-w-[120px] max-w-[200px] lg:max-w-[300px] truncate"
                                    >
                                        {accounts.filter(a => !a.isHeader).sort((a,b)=>a.code.localeCompare(b.code)).map(a => (
                                            <option key={a.id} value={a.id} className="bg-gray-900 text-white">
                                                {a.code} - {a.name}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            )}
                        </div>
                        <div className="flex gap-2">
                            <button onClick={handleExportExcel} className="bg-emerald-600 hover:bg-emerald-700 px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition-colors">
                                <FileSpreadsheet className="w-4 h-4"/> Export Excel
                            </button>
                            <button
                                onClick={() => {
                                    const isLandscape = (neracaLayout === 'SKONTRO' && activeReport === 'NERACA')
                                        || activeReport === 'PERUBAHAN_EKUITAS'
                                        || activeReport === 'TAX_SUMMARY';
                                    openPrintTab(
                                        printAreaRef.current?.innerHTML || '',
                                        activeReport ? activeReport.replace(/_/g, ' ') : 'Laporan',
                                        isLandscape
                                    );
                                }}
                                className="bg-primary-500 hover:bg-primary-600 px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition-colors"
                            >
                                <Printer className="w-4 h-4"/> Cetak / PDF
                            </button>
                            <button onClick={() => setActiveReport(null)} className="bg-gray-700 hover:bg-gray-800 px-4 py-2 rounded-lg text-sm font-bold transition-colors">Tutup</button>
                        </div>
                    </div>

                    <div ref={printAreaRef} id="printable-area" className={`${(neracaLayout === 'SKONTRO' && activeReport === 'NERACA') || activeReport === 'PERUBAHAN_EKUITAS' || activeReport === 'TAX_SUMMARY' ? 'max-w-[297mm]' : 'max-w-[210mm]'} mx-auto p-12 bg-white min-h-screen shadow-2xl my-8 print:shadow-none print:my-0`}>
                        <div className="border-b-2 border-gray-800 pb-6 mb-8">
                            <div className={`flex items-center ${companyProfile?.logoUrl ? 'gap-4' : 'justify-center'}`}>
                                {companyProfile?.logoUrl && (
                                    <img src={companyProfile.logoUrl} alt="Logo" className="object-contain flex-shrink-0" style={{height:'52px',width:'52px',objectFit:'contain',flexShrink:0}} />
                                )}
                                <div className={companyProfile?.logoUrl ? 'text-left' : 'text-center'}>
                                    <h1 className="text-xl font-bold uppercase tracking-widest">{companyProfile?.name || 'ACCESSTANSI CORP'}</h1>
                                    <p className="text-xs text-gray-600 mt-0.5">{companyProfile?.address}{companyProfile?.city ? `, ${companyProfile.city}` : ''}</p>
                                    <p className="text-xs text-gray-500">{companyProfile?.phone ? `Tel: ${companyProfile.phone}` : ''}{companyProfile?.phone && companyProfile?.email ? ' | ' : ''}{companyProfile?.email ? `Email: ${companyProfile.email}` : ''}</p>
                                </div>
                            </div>
                            <div className="text-center mt-5">
                                <h2 className="text-lg font-bold uppercase underline decoration-2 underline-offset-8">
                                    {activeReport.replace(/_/g, ' ')}
                                </h2>
                                <p className="text-sm mt-1.5 font-medium text-gray-700">Periode: {formatDateIndo(startDate)} s/d {formatDateIndo(endDate)}</p>
                            </div>
                        </div>

                        <div className="min-h-[500px]">
                            {activeReport === 'TAX_SUMMARY' && (
                                <div className="space-y-12">
                                    {/* WITHHOLDING TAXES */}
                                    <section>
                                        <div className="flex items-center gap-2 mb-4">
                                            <ClipboardCheck className="w-5 h-5 text-gray-600" />
                                            <h4 className="font-bold uppercase text-sm border-b border-black flex-1">Rekapitulasi PPh Potong Pungut</h4>
                                        </div>
                                        <table className="w-full text-xs border-collapse">
                                            <thead>
                                                <tr className="bg-gray-50 border-y border-gray-800">
                                                    <th className="p-2 text-left">Jenis Pajak</th>
                                                    <th className="p-2 text-right">DPP (Estimasi)</th>
                                                    <th className="p-2 text-center">Tarif</th>
                                                    <th className="p-2 text-right">Nilai Pajak Terhutang</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-gray-100">
                                                {reportData.withholding.map((row: any, i: number) => (
                                                    <tr key={i}>
                                                        <td className="p-2 font-medium">{row.label}</td>
                                                        <td className="p-2 text-right font-mono">{row.dpp > 0 ? formatNumber(row.dpp) : '-'}</td>
                                                        <td className="p-2 text-center">{row.rate}</td>
                                                        <td className="p-2 text-right font-mono font-bold">{formatNumber(row.amount)}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </section>

                                    {/* VALUE ADDED TAX */}
                                    <section>
                                        <div className="flex items-center gap-2 mb-4">
                                            <Layers className="w-5 h-5 text-gray-600" />
                                            <h4 className="font-bold uppercase text-sm border-b border-black flex-1">Rekapitulasi PPN (Pajak Pertambahan Nilai)</h4>
                                        </div>
                                        <div className="grid grid-cols-2 gap-8">
                                            <table className="w-full text-xs border-collapse">
                                                <tbody>
                                                    <tr className="border-b border-gray-200"><td className="p-2 text-gray-500">PPN Keluaran (Penjualan)</td><td className="p-2 text-right font-mono font-bold text-red-600">{formatNumber(reportData.ppn.keluaran)}</td></tr>
                                                    <tr className="border-b border-gray-200"><td className="p-2 text-gray-500">PPN Masukan (Pembelian)</td><td className="p-2 text-right font-mono font-bold text-emerald-600">{formatNumber(reportData.ppn.masukan)}</td></tr>
                                                    <tr className="bg-gray-100"><td className="p-2 font-bold uppercase">Net Selisih PPN</td><td className="p-2 text-right font-mono font-bold text-lg">{formatNumber(reportData.ppn.net)}</td></tr>
                                                </tbody>
                                            </table>
                                            <div className="border-2 border-dashed border-gray-200 rounded-xl p-4 flex flex-col justify-center items-center text-center">
                                                <p className="text-[10px] uppercase font-bold text-gray-400 mb-1">Status Pajak Periode Ini</p>
                                                <h5 className={`text-xl font-black uppercase ${reportData.ppn.status === 'Kurang Bayar' ? 'text-red-600' : 'text-emerald-600'}`}>
                                                    {reportData.ppn.status}
                                                </h5>
                                                <p className="text-[10px] text-gray-500 mt-2 italic">Asumsi tarif PPN 11% digunakan untuk kalkulasi estimasi DPP.</p>
                                            </div>
                                        </div>
                                    </section>

                                    <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
                                        <div className="flex gap-2 mb-1">
                                            <ShieldCheck className="w-4 h-4 text-amber-600" />
                                            <span className="text-xs font-bold text-amber-800 uppercase">Catatan Kepatuhan Pajak:</span>
                                        </div>
                                        <p className="text-[10px] text-amber-700 leading-relaxed">
                                            Laporan ini merupakan rekapitulasi berdasarkan saldo akun di Buku Besar. Pastikan seluruh faktur pajak telah diinput ke aplikasi e-Faktur/e-Bupot DJP. Selisih mungkin terjadi jika ada penyesuaian non-kas atau pembulatan di portal pajak.
                                        </p>
                                    </div>
                                </div>
                            )}

                            {activeReport === 'PERUBAHAN_EKUITAS' && (
                                <table className="w-full text-xs border-collapse">
                                    <thead>
                                        <tr className="border-b-2 border-black">
                                            <th className="py-2 text-left w-64">Keterangan</th>
                                            <th className="py-2 text-right w-40">{reportData.currYear}</th>
                                            <th className="py-2 text-right w-40">Penambahan / (Pengurangan)</th>
                                            <th className="py-2 text-right w-40">{reportData.prevYear}</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                        {reportData.rows.map((row: any, i: number) => (
                                            <tr key={i} className="hover:bg-gray-50">
                                                <td className="py-3 font-medium text-gray-700">{row.label}</td>
                                                <td className="py-3 text-right font-mono">{formatNumber(row.cur)}</td>
                                                <td className="py-3 text-right font-mono text-gray-500">{formatNumber(row.diff)}</td>
                                                <td className="py-3 text-right font-mono">{formatNumber(row.prev)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                    <tfoot className="border-t-2 border-black bg-gray-50">
                                        <tr className="font-bold text-sm">
                                            <td className="p-3 text-gray-900 uppercase">Jumlah Ekuitas</td>
                                            <td className="p-3 text-right font-mono">{formatNumber(reportData.total.cur)}</td>
                                            <td className="p-3 text-right font-mono text-gray-600">{formatNumber(reportData.total.diff)}</td>
                                            <td className="p-3 text-right font-mono">{formatNumber(reportData.total.prev)}</td>
                                        </tr>
                                    </tfoot>
                                </table>
                            )}

                            {activeReport === 'BUDGET_VS_ACTUAL' && (
                                <table className="w-full text-xs border-collapse border border-gray-800">
                                    <thead className="bg-gray-100">
                                        <tr>
                                            <th className="border border-gray-400 p-2 text-left">Nama Akun Beban</th>
                                            <th className="border border-gray-400 p-2 text-right">Anggaran (Budget)</th>
                                            <th className="border border-gray-400 p-2 text-right">Realisasi (Actual)</th>
                                            <th className="border border-gray-400 p-2 text-right">Selisih (Variance)</th>
                                            <th className="border border-gray-400 p-2 text-center w-24">Status %</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {reportData.map((row: any) => (
                                            <tr key={row.id}>
                                                <td className="border border-gray-300 p-2 font-medium">{row.name}</td>
                                                <td className="border border-gray-300 p-2 text-right font-mono">{formatNumber(row.budget)}</td>
                                                <td className="border border-gray-300 p-2 text-right font-mono">{formatNumber(row.actual)}</td>
                                                <td className={`border border-gray-300 p-2 text-right font-mono font-bold ${row.variance >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                                                    {formatNumber(row.variance)}
                                                </td>
                                                <td className="border border-gray-300 p-2 text-center">
                                                    <div className="flex flex-col gap-1">
                                                        <span className={`text-[10px] font-bold ${row.pct > 100 ? 'text-red-600' : row.pct > 80 ? 'text-orange-500' : 'text-emerald-600'}`}>
                                                            {row.pct.toFixed(1)}%
                                                        </span>
                                                        <div className="w-full bg-gray-100 h-1.5 rounded-full overflow-hidden">
                                                            <div 
                                                                className={`h-full ${row.pct > 100 ? 'bg-red-500' : row.pct > 80 ? 'bg-orange-400' : 'bg-emerald-500'}`} 
                                                                style={{ width: `${Math.min(row.pct, 100)}%` }}
                                                            ></div>
                                                        </div>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                    <tfoot className="bg-gray-100 font-bold">
                                        <tr>
                                            <td className="border border-gray-400 p-2 text-right">TOTAL BEBAN</td>
                                            <td className="border border-gray-400 p-2 text-right font-mono">{formatNumber(reportData.reduce((s:number,r:any)=>s+r.budget,0))}</td>
                                            <td className="border border-gray-400 p-2 text-right font-mono">{formatNumber(reportData.reduce((s:number,r:any)=>s+r.actual,0))}</td>
                                            <td className="border border-gray-400 p-2 text-right font-mono">{formatNumber(reportData.reduce((s:number,r:any)=>s+r.variance,0))}</td>
                                            <td className="border border-gray-400 p-2 text-center">
                                                {((reportData.reduce((s:number,r:any)=>s+r.actual,0) / reportData.reduce((s:number,r:any)=>s+r.budget,0) || 0) * 100).toFixed(1)}%
                                            </td>
                                        </tr>
                                    </tfoot>
                                </table>
                            )}

                            {(activeReport === 'AGING_PIUTANG' || activeReport === 'AGING_HUTANG') && (
                                <table className="w-full text-xs border-collapse border border-gray-800">
                                    <thead className="bg-gray-100">
                                        <tr>
                                            <th className="border border-gray-400 p-2 text-left">Nama Kontak</th>
                                            <th className="border border-gray-400 p-2 text-right">0 - 30 Hari</th>
                                            <th className="border border-gray-400 p-2 text-right">31 - 60 Hari</th>
                                            <th className="border border-gray-400 p-2 text-right">61 - 90 Hari</th>
                                            <th className="border border-gray-400 p-2 text-right">&gt; 90 Hari</th>
                                            <th className="border border-gray-400 p-2 text-right">Total</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {reportData.map((b: any, i: number) => (
                                            <tr key={i}>
                                                <td className="border border-gray-300 p-2 font-bold">{b.contact?.name || 'Tanpa Kontak'}</td>
                                                <td className="border border-gray-300 p-2 text-right font-mono">{formatNumber(b.b1)}</td>
                                                <td className="border border-gray-300 p-2 text-right font-mono">{formatNumber(b.b2)}</td>
                                                <td className="border border-gray-300 p-2 text-right font-mono">{formatNumber(b.b3)}</td>
                                                <td className="border border-gray-300 p-2 text-right font-mono">{formatNumber(b.b4)}</td>
                                                <td className="border border-gray-300 p-2 text-right font-mono font-bold bg-gray-50">{formatNumber(b.total)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                    <tfoot className="bg-gray-100 font-bold">
                                        <tr>
                                            <td className="border border-gray-400 p-2 text-right">GRAND TOTAL</td>
                                            <td className="border border-gray-400 p-2 text-right">{formatNumber(reportData.reduce((s:number, b:any)=>s+b.b1, 0))}</td>
                                            <td className="border border-gray-400 p-2 text-right">{formatNumber(reportData.reduce((s:number, b:any)=>s+b.b2, 0))}</td>
                                            <td className="border border-gray-400 p-2 text-right">{formatNumber(reportData.reduce((s:number, b:any)=>s+b.b3, 0))}</td>
                                            <td className="border border-gray-400 p-2 text-right">{formatNumber(reportData.reduce((s:number, b:any)=>s+b.b4, 0))}</td>
                                            <td className="border border-gray-400 p-2 text-right">{formatNumber(reportData.reduce((s:number, b:any)=>s+b.total, 0))}</td>
                                        </tr>
                                    </tfoot>
                                </table>
                            )}

                            {activeReport === 'LABA_RUGI_PERBANDINGAN' && (
                                <div className="space-y-6">
                                    <table className="w-full text-xs border-collapse">
                                        <thead>
                                            <tr className="border-b-2 border-black">
                                                <th className="text-left py-2">Keterangan</th>
                                                <th className="text-right py-2">{reportData.currPeriod}</th>
                                                <th className="text-right py-2">{reportData.prevPeriod}</th>
                                                <th className="text-right py-2">Selisih</th>
                                                <th className="text-right py-2">%</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            <tr className="font-bold bg-gray-100"><td colSpan={5} className="p-1 uppercase">Pendapatan</td></tr>
                                            {reportData.current.revenues.map((curr: any, i: number) => {
                                                const prev = reportData.previous.revenues[i]?.balance || 0;
                                                const diff = curr.balance - prev;
                                                const pct = prev !== 0 ? (diff / Math.abs(prev) * 100) : 0;
                                                return (
                                                    <tr key={curr.id} className="border-b border-gray-200">
                                                        <td className="p-1 pl-4">{curr.name}</td>
                                                        <td className="p-1 text-right font-mono">{formatNumber(curr.balance)}</td>
                                                        <td className="p-1 text-right font-mono">{formatNumber(prev)}</td>
                                                        <td className="p-1 text-right font-mono">{formatNumber(diff)}</td>
                                                        <td className={`p-1 text-right font-bold ${diff > 0 ? 'text-green-600' : 'text-red-600'}`}>{pct.toFixed(1)}%</td>
                                                    </tr>
                                                );
                                            })}
                                            <tr className="font-bold bg-gray-100 mt-4"><td colSpan={5} className="p-1 uppercase">Beban Operasional</td></tr>
                                            {reportData.current.expenses.map((curr: any, i: number) => {
                                                const prev = reportData.previous.expenses[i]?.balance || 0;
                                                const diff = curr.balance - prev;
                                                const pct = prev !== 0 ? (diff / Math.abs(prev) * 100) : 0;
                                                return (
                                                    <tr key={curr.id} className="border-b border-gray-200">
                                                        <td className="p-1 pl-4">{curr.name}</td>
                                                        <td className="p-1 text-right font-mono">{formatNumber(curr.balance)}</td>
                                                        <td className="p-1 text-right font-mono">{formatNumber(prev)}</td>
                                                        <td className="p-1 text-right font-mono">{formatNumber(diff)}</td>
                                                        <td className={`p-1 text-right font-bold ${diff > 0 ? 'text-red-600' : 'text-green-600'}`}>{pct.toFixed(1)}%</td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                        <tfoot className="font-bold border-t-2 border-black">
                                            <tr className="bg-gray-50 text-sm">
                                                <td className="p-2">LABA / (RUGI) BERSIH</td>
                                                <td className="p-2 text-right font-mono">{formatNumber(reportData.current.net)}</td>
                                                <td className="p-2 text-right font-mono">{formatNumber(reportData.previous.net)}</td>
                                                <td className="p-2 text-right font-mono">{formatNumber(reportData.current.net - reportData.previous.net)}</td>
                                                <td className="p-2 text-right"></td>
                                            </tr>
                                        </tfoot>
                                    </table>
                                </div>
                            )}

                            {activeReport === 'NERACA_PERBANDINGAN' && (
                                <div className="space-y-6">
                                    <table className="w-full text-xs border-collapse">
                                        <thead>
                                            <tr className="border-b-2 border-black">
                                                <th className="text-left py-2">Keterangan</th>
                                                <th className="text-right py-2">{reportData.currLabel}</th>
                                                <th className="text-right py-2">{reportData.prevLabel}</th>
                                                <th className="text-right py-2">Selisih</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            <tr className="font-bold bg-gray-100"><td colSpan={4} className="p-1 uppercase">Aset</td></tr>
                                            {reportData.current.assets.map((curr: any, i: number) => {
                                                const prev = reportData.previous.assets.find((a:any)=>a.code===curr.code)?.balance || 0;
                                                return (
                                                    <tr key={curr.id} className="border-b border-gray-200">
                                                        <td className={`p-1 ${curr.level===1?'font-bold':'pl-4'}`}>{curr.name}</td>
                                                        <td className="p-1 text-right font-mono">{formatNumber(curr.balance)}</td>
                                                        <td className="p-1 text-right font-mono">{formatNumber(prev)}</td>
                                                        <td className="p-1 text-right font-mono">{formatNumber(curr.balance - prev)}</td>
                                                    </tr>
                                                );
                                            })}
                                            <tr className="font-bold bg-gray-100"><td colSpan={4} className="p-1 uppercase mt-4">Kewajiban</td></tr>
                                            {reportData.current.liab.map((curr: any, i: number) => {
                                                const prev = reportData.previous.liab.find((a:any)=>a.code===curr.code)?.balance || 0;
                                                return (
                                                    <tr key={curr.id} className="border-b border-gray-200">
                                                        <td className={`p-1 ${curr.level===1?'font-bold':'pl-4'}`}>{curr.name}</td>
                                                        <td className="p-1 text-right font-mono">{formatNumber(curr.balance)}</td>
                                                        <td className="p-1 text-right font-mono">{formatNumber(prev)}</td>
                                                        <td className="p-1 text-right font-mono">{formatNumber(curr.balance - prev)}</td>
                                                    </tr>
                                                );
                                            })}
                                            <tr className="font-bold bg-gray-100"><td colSpan={4} className="p-1 uppercase mt-4">Ekuitas</td></tr>
                                            {reportData.current.eq.map((curr: any, i: number) => {
                                                const prev = reportData.previous.eq.find((a:any)=>a.code===curr.code)?.balance || 0;
                                                return (
                                                    <tr key={curr.id} className="border-b border-gray-200">
                                                        <td className={`p-1 ${curr.level===1?'font-bold':'pl-4'}`}>{curr.name}</td>
                                                        <td className="p-1 text-right font-mono">{formatNumber(curr.balance)}</td>
                                                        <td className="p-1 text-right font-mono">{formatNumber(prev)}</td>
                                                        <td className="p-1 text-right font-mono">{formatNumber(curr.balance - prev)}</td>
                                                    </tr>
                                                );
                                            })}
                                            <tr className="border-b border-gray-200">
                                                <td className="p-1 pl-4 italic">Laba Tahun Berjalan</td>
                                                <td className="p-1 text-right font-mono font-bold">{formatNumber(reportData.current.net)}</td>
                                                <td className="p-1 text-right font-mono font-bold">{formatNumber(reportData.previous.net)}</td>
                                                <td className="p-1 text-right font-mono font-bold">{formatNumber(reportData.current.net - reportData.previous.net)}</td>
                                            </tr>
                                        </tbody>
                                        <tfoot className="font-bold border-t-2 border-black bg-gray-50">
                                            <tr>
                                                <td className="p-2">TOTAL PASIVA</td>
                                                <td className="p-2 text-right font-mono">{formatNumber(reportData.current.totalE + reportData.current.totalL)}</td>
                                                <td className="p-2 text-right font-mono">{formatNumber(reportData.previous.totalE + reportData.previous.totalL)}</td>
                                                <td className="p-2 text-right"></td>
                                            </tr>
                                        </tfoot>
                                    </table>
                                </div>
                            )}

                            {(activeReport === 'BUKU_BESAR_SEMUA' || activeReport === 'BUKU_BESAR') && (
                                <div className="space-y-12">
                                    {(activeReport === 'BUKU_BESAR_SEMUA' ? reportData.accounts : [reportData]).map((item: any, idx: number) => {
                                        let runningBalance = item.openingBalance;
                                        return (
                                            <div key={idx} className="page-break-inside-avoid">
                                                <div className="bg-gray-100 px-4 py-2 border-l-4 border-primary-500 mb-2 flex justify-between items-center">
                                                    <h4 className="font-bold text-gray-900 uppercase">
                                                        {formatAccountCode(item.account.code)} - {item.account.name}
                                                    </h4>
                                                </div>
                                                <table className="w-full text-[11px] border-collapse">
                                                    <thead>
                                                        <tr className="border-b border-gray-800 bg-gray-50">
                                                            <th className="py-2 px-1 text-left w-16">Tanggal</th>
                                                            <th className="py-2 px-1 text-left w-24">Referensi</th>
                                                            <th className="py-2 px-1 text-left">Keterangan</th>
                                                            <th className="py-2 px-1 text-right w-20">Debit</th>
                                                            <th className="py-2 px-1 text-right w-20">Kredit</th>
                                                            <th className="py-2 px-1 text-right w-24">Saldo</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-gray-200">
                                                        <tr className="italic font-medium text-gray-500">
                                                            <td className="py-1 px-1">{formatDateShort(startDate)}</td>
                                                            <td className="py-1 px-1">-</td>
                                                            <td className="py-1 px-1">Saldo Awal</td>
                                                            <td className="py-1 px-1 text-right">-</td>
                                                            <td className="py-1 px-1 text-right">-</td>
                                                            <td className="py-1 px-1 text-right font-mono">{formatNumber(item.openingBalance)}</td>
                                                        </tr>
                                                        {item.transactions.map((t: any, tIdx: number) => {
                                                            const isDebitNormal = item.account.type === AccountType.ASSET || item.account.type === AccountType.EXPENSE;
                                                            if (isDebitNormal) runningBalance += (t.debit - t.credit);
                                                            else runningBalance += (t.credit - t.debit);
                                                            return (
                                                                <tr key={tIdx}>
                                                                    <td className="py-1 px-1">{formatDateShort(t.date)}</td>
                                                                    <td className="py-1 px-1 font-mono">
                                                                        <button 
                                                                            onClick={() => handleDrillDown(t.ref)} 
                                                                            className="text-primary-600 hover:underline hover:text-primary-800 text-left print:text-black print:no-underline font-bold"
                                                                        >
                                                                            {t.ref}
                                                                        </button>
                                                                    </td>
                                                                    <td className="py-1 px-1">{t.desc}</td>
                                                                    <td className="py-1 px-1 text-right font-mono">{t.debit > 0 ? formatNumber(t.debit) : '-'}</td>
                                                                    <td className="py-1 px-1 text-right font-mono">{t.credit > 0 ? formatNumber(t.credit) : '-'}</td>
                                                                    <td className="py-1 px-1 text-right font-mono font-semibold">{formatNumber(runningBalance)}</td>
                                                                </tr>
                                                            );
                                                        })}
                                                    </tbody>
                                                </table>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}

                            {activeReport === 'ARUS_KAS' && (
                                <div className="space-y-8">
                                    {/* Operasional */}
                                    <section>
                                        <h4 className="font-bold border-b-2 border-black uppercase text-sm mb-2">Arus Kas dari Aktivitas Operasional</h4>
                                        <table className="w-full text-sm">
                                            <tbody>
                                                {reportData.operating.map((r: any, i: number) => (
                                                    <tr key={i}><td className="py-1">{r.label}</td><td className="py-1 text-right tabular-nums">{formatNumber(r.amount)}</td></tr>
                                                ))}
                                                <tr className="font-bold border-t border-gray-300">
                                                    <td className="py-2">Arus Kas Bersih dari Aktivitas Operasional</td>
                                                    <td className="py-2 text-right tabular-nums">{formatNumber(reportData.operating.reduce((s: number, r: any) => s + r.amount, 0))}</td>
                                                </tr>
                                            </tbody>
                                        </table>
                                    </section>
                                    {/* Investasi */}
                                    <section>
                                        <h4 className="font-bold border-b-2 border-black uppercase text-sm mb-2">Arus Kas dari Aktivitas Investasi</h4>
                                        <table className="w-full text-sm">
                                            <tbody>
                                                {reportData.investing.map((r: any, i: number) => (
                                                    <tr key={i}><td className="py-1">{r.label}</td><td className="py-1 text-right tabular-nums">{formatNumber(r.amount)}</td></tr>
                                                ))}
                                                <tr className="font-bold border-t border-gray-300">
                                                    <td className="py-2">Arus Kas Bersih dari Aktivitas Investasi</td>
                                                    <td className="py-2 text-right tabular-nums">{formatNumber(reportData.investing.reduce((s: number, r: any) => s + r.amount, 0))}</td>
                                                </tr>
                                            </tbody>
                                        </table>
                                    </section>
                                    {/* Pendanaan */}
                                    <section>
                                        <h4 className="font-bold border-b-2 border-black uppercase text-sm mb-2">Arus Kas dari Aktivitas Pendanaan</h4>
                                        <table className="w-full text-sm">
                                            <tbody>
                                                {reportData.financing.map((r: any, i: number) => (
                                                    <tr key={i}><td className="py-1">{r.label}</td><td className="py-1 text-right tabular-nums">{formatNumber(r.amount)}</td></tr>
                                                ))}
                                                <tr className="font-bold border-t border-gray-300">
                                                    <td className="py-2">Arus Kas Bersih dari Aktivitas Pendanaan</td>
                                                    <td className="py-2 text-right tabular-nums">{formatNumber(reportData.financing.reduce((s: number, r: any) => s + r.amount, 0))}</td>
                                                </tr>
                                            </tbody>
                                        </table>
                                    </section>
                                    {/* Ringkasan */}
                                    <div className="bg-gray-50 p-4 border-2 border-black space-y-2 mt-8">
                                        <div className="flex justify-between font-bold"><span>Kenaikan / (Penurunan) Kas Bersih</span><span className="tabular-nums">{formatNumber(reportData.endingCash - reportData.initialCash)}</span></div>
                                        <div className="flex justify-between text-sm"><span>Saldo Kas Awal Periode</span><span className="tabular-nums">{formatNumber(reportData.initialCash)}</span></div>
                                        <div className="flex justify-between font-bold text-lg border-t border-black pt-2"><span>SALDO KAS AKHIR PERIODE</span><span className="tabular-nums">{formatNumber(reportData.endingCash)}</span></div>
                                    </div>
                                </div>
                            )}

                            {activeReport === 'NERACA_SALDO' && (
                                <table className="w-full text-xs border-collapse border border-gray-800">
                                    <thead className="bg-gray-100">
                                        <tr><th className="border border-gray-400 p-2 text-left">Kode</th><th className="border border-gray-400 p-2 text-left">Nama Akun</th><th className="border border-gray-400 p-2 text-right">Saldo Awal</th><th className="border border-gray-400 p-2 text-right">Mutasi (D)</th><th className="border border-gray-400 p-2 text-right">Mutasi (K)</th><th className="border border-gray-400 p-2 text-right">Saldo Akhir</th></tr>
                                    </thead>
                                    <tbody>
                                        {reportData.map((r: any) => (
                                            <tr key={r.id}><td className="border border-gray-300 p-1 font-mono">{formatAccountCode(r.code)}</td><td className="border border-gray-300 p-1">{r.name}</td><td className="border border-gray-300 p-1 text-right">{formatNumber(r.opening)}</td><td className="border border-gray-300 p-1 text-right">{formatNumber(r.mutasiDebit)}</td><td className="border border-gray-300 p-1 text-right">{formatNumber(r.mutasiCredit)}</td><td className="border border-gray-300 p-1 text-right font-bold">{formatNumber(r.ending)}</td></tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}

                            {activeReport === 'NERACA' && (() => {
                                // Helper: render asset/liability rows with sub-group totals
                                const buildNeracaRows = (rows: any[]) => {
                                    const result: React.JSX.Element[] = [];
                                    let i = 0;
                                    while (i < rows.length) {
                                        const row = rows[i];
                                        if (row.level === 1) { i++; continue; }
                                        if (row.level === 2) {
                                            const children: any[] = [];
                                            i++;
                                            while (i < rows.length && rows[i].level === 3) { children.push(rows[i]); i++; }
                                            result.push(
                                                <React.Fragment key={row.id}>
                                                    <tr><td className="pt-3 pb-0.5 pl-4 text-sm font-bold" colSpan={2}>{row.name}</td></tr>
                                                    {children.map((c: any) => (
                                                        <tr key={c.id}>
                                                            <td className="py-[3px] pl-10 text-sm">{c.name}</td>
                                                            <td className="py-[3px] text-right text-sm tabular-nums">{formatNumber(Math.abs(c.balance))}</td>
                                                        </tr>
                                                    ))}
                                                    <tr className="border-t border-gray-400">
                                                        <td className="pt-1 pb-2.5 pl-4 text-sm font-bold">Jumlah {row.name}</td>
                                                        <td className="pt-1 pb-2.5 text-right text-sm font-bold tabular-nums">{formatNumber(Math.abs(row.balance))}</td>
                                                    </tr>
                                                </React.Fragment>
                                            );
                                        } else { i++; }
                                    }
                                    return result;
                                };

                                // Helper: render equity rows, appends "Saldo Tahun Berjalan" to last group
                                const buildEquityRows = (rows: any[], netIncome: number) => {
                                    const result: React.JSX.Element[] = [];
                                    let i = 0;
                                    while (i < rows.length) {
                                        const row = rows[i];
                                        if (row.level === 1) { i++; continue; }
                                        if (row.level === 2) {
                                            const isLast = !rows.slice(i + 1).some((r: any) => r.level === 2);
                                            const children: any[] = [];
                                            i++;
                                            while (i < rows.length && rows[i].level === 3) { children.push(rows[i]); i++; }
                                            const subtotal = isLast ? Math.abs(row.balance) + netIncome : Math.abs(row.balance);
                                            result.push(
                                                <React.Fragment key={row.id}>
                                                    <tr><td className="pt-3 pb-0.5 pl-4 text-sm font-bold" colSpan={2}>{row.name}</td></tr>
                                                    {children.map((c: any) => (
                                                        <tr key={c.id}>
                                                            <td className="py-[3px] pl-10 text-sm">{c.name}</td>
                                                            <td className="py-[3px] text-right text-sm tabular-nums">{formatNumber(Math.abs(c.balance))}</td>
                                                        </tr>
                                                    ))}
                                                    {isLast && (
                                                        <tr>
                                                            <td className="py-[3px] pl-10 text-sm italic">Saldo Tahun Berjalan</td>
                                                            <td className="py-[3px] text-right text-sm tabular-nums">{formatNumber(netIncome)}</td>
                                                        </tr>
                                                    )}
                                                    <tr className="border-t border-gray-400">
                                                        <td className="pt-1 pb-2.5 pl-4 text-sm font-bold">Jumlah {row.name}</td>
                                                        <td className="pt-1 pb-2.5 text-right text-sm font-bold tabular-nums">{formatNumber(subtotal)}</td>
                                                    </tr>
                                                </React.Fragment>
                                            );
                                        } else { i++; }
                                    }
                                    return result;
                                };

                                return (
                                    <div className={neracaLayout === 'SKONTRO' ? "flex gap-12 items-start" : "space-y-10"}>
                                        {/* ── ASET ── */}
                                        <div className={neracaLayout === 'SKONTRO' ? "w-1/2" : "w-full"}>
                                            <h4 className="font-extrabold border-b-2 border-black pb-1 uppercase text-sm tracking-wide">ASET</h4>
                                            <table className="w-full text-sm">
                                                <tbody>
                                                    {buildNeracaRows(reportData.assets)}
                                                    <tr className="border-t-2 border-b-2 border-black">
                                                        <td className="py-2 text-sm font-extrabold uppercase tracking-wide">JUMLAH ASET</td>
                                                        <td className="py-2 text-right text-sm font-extrabold tabular-nums">{formatNumber(reportData.totalAssets)}</td>
                                                    </tr>
                                                </tbody>
                                            </table>
                                        </div>

                                        {/* ── LIABILITAS DAN EKUITAS ── */}
                                        <div className={neracaLayout === 'SKONTRO' ? "w-1/2" : "w-full"}>
                                            <h4 className="font-extrabold border-b-2 border-black pb-1 uppercase text-sm tracking-wide">LIABILITAS DAN EKUITAS</h4>
                                            <table className="w-full text-sm">
                                                <tbody>
                                                    {buildNeracaRows(reportData.liabilities)}
                                                    {buildEquityRows(reportData.equities, reportData.netIncome)}
                                                    <tr className="border-t-2 border-b-2 border-black">
                                                        <td className="py-2 text-sm font-extrabold uppercase tracking-wide">JUMLAH LIABILITAS DAN EKUITAS</td>
                                                        <td className="py-2 text-right text-sm font-extrabold tabular-nums">{formatNumber(Math.abs(reportData.totalLiabilities) + Math.abs(reportData.totalEquity) + reportData.netIncome)}</td>
                                                    </tr>
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                );
                            })()}

                            {activeReport === 'LABA_RUGI' && (
                                <div className="space-y-8 max-w-2xl mx-auto">
                                    <div>
                                        <h4 className="font-bold border-b border-black mb-2 uppercase">Pendapatan</h4>
                                        <table className="w-full text-sm">
                                            <tbody>
                                                {reportData.revenues.map((r:any) => (<tr key={r.id}><td className="p-1 pl-4">{r.name}</td><td className="p-1 text-right font-mono">{formatCurrency(Math.abs(r.balance))}</td></tr>))}
                                                <tr className="font-bold border-t border-gray-400"><td>Total Pendapatan</td><td className="text-right">{formatCurrency(Math.abs(reportData.totalRevenue))}</td></tr>
                                            </tbody>
                                        </table>
                                    </div>
                                    <div>
                                        <h4 className="font-bold border-b border-black mb-2 uppercase">Beban</h4>
                                        <table className="w-full text-sm">
                                            <tbody>
                                                {reportData.expenses.map((r:any) => (<tr key={r.id}><td className="p-1 pl-4">{r.name}</td><td className="p-1 text-right font-mono">{formatCurrency(r.balance)}</td></tr>))}
                                                <tr className="font-bold border-t border-gray-400"><td>Total Beban</td><td className="text-right">{formatCurrency(reportData.totalExpense)}</td></tr>
                                            </tbody>
                                        </table>
                                    </div>
                                    <div className="bg-gray-100 p-4 flex justify-between items-center font-bold text-lg border-y-2 border-black"><span>LABA / (RUGI) BERSIH</span><span>{formatCurrency(reportData.netIncome)}</span></div>
                                </div>
                            )}
                        </div>

                        <div className="mt-20 flex justify-end">
                            <div className="text-center min-w-64 max-w-xs">
                                <p className="mb-24">{signPlace}, {formatDateIndo(signDate)}<br/><span className="text-xs"></span></p>
                                <p className="font-bold underline uppercase">{signName}</p>
                                <p className="text-sm">{signTitle}</p>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* DRILL DOWN MODAL */}
            {drillDownJournal && (
                <div className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 print:hidden">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl overflow-hidden animate-fade-in-up">
                        <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                            <h3 className="font-bold text-gray-900 flex items-center gap-2">
                                <FileText className="w-5 h-5 text-primary-500" />
                                Bukti Jurnal: {drillDownJournal.referenceNumber}
                            </h3>
                            <button onClick={() => setDrillDownJournal(null)} className="text-gray-400 hover:text-gray-600 p-1 rounded-full hover:bg-gray-100">
                                <X className="w-6 h-6" />
                            </button>
                        </div>
                        <div className="p-8 max-h-[75vh] overflow-y-auto">
                            <div className="flex justify-between items-start border-b-2 border-gray-200 pb-6 mb-8">
                                <div className="flex items-start gap-4">
                                    <img
                                        src={companyProfile?.logoUrl || '/logo.png'}
                                        alt="Logo"
                                        className="w-20 h-20 object-contain"
                                    />
                                    <div>
                                        <h1 className="text-xl font-bold uppercase tracking-wider text-gray-900">{companyProfile?.name || 'ACCESSTANSI CORP'}</h1>
                                        <p className="text-sm text-gray-600 mt-1 max-w-[300px] leading-snug">{companyProfile?.address} {companyProfile?.city}</p>
                                        <p className="text-xs text-gray-500 mt-1">Tel: {companyProfile?.phone} | Email: {companyProfile?.email}</p>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <h2 className="text-2xl font-bold uppercase text-gray-800">Bukti Jurnal</h2>
                                    <div className="mt-2 inline-block bg-gray-50 px-3 py-1 rounded border border-gray-200">
                                        <span className="font-mono text-xl font-bold text-gray-900">{drillDownJournal.referenceNumber}</span>
                                    </div>
                                    <p className="text-sm text-gray-500 mt-1">Tanggal: {formatDateIndo(drillDownJournal.transactionDate)}</p>
                                </div>
                            </div>
                            
                            <div className="mb-8">
                                <p className="text-sm text-gray-500 font-bold uppercase mb-1">Keterangan:</p>
                                <div className="p-4 bg-gray-50 border border-gray-200 rounded text-gray-800 italic">
                                    "{drillDownJournal.description}"
                                </div>
                            </div>

                            <table className="w-full text-sm border-collapse border border-gray-200 mb-8">
                                <thead className="bg-gray-50 text-gray-700 uppercase tracking-wide">
                                    <tr>
                                        <th className="border border-gray-200 px-4 py-2 text-left w-32">Kode Akun</th>
                                        <th className="border border-gray-200 px-4 py-2 text-left">Nama Akun</th>
                                        <th className="border border-gray-200 px-4 py-2 text-right w-40">Debit</th>
                                        <th className="border border-gray-200 px-4 py-2 text-right w-40">Kredit</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {drillDownJournal.lines.map((line, idx) => (
                                        <tr key={idx} className="hover:bg-gray-50/50">
                                            <td className="border border-gray-200 px-4 py-2 font-mono text-gray-600">{line.accountName.split(' - ')[0]}</td>
                                            <td className="border border-gray-200 px-4 py-2 font-medium text-gray-800">
                                                {line.accountName.split(' - ').slice(1).join(' - ') || line.accountName}
                                                {line.contactName && (
                                                    <div className="text-[10px] text-primary-600 flex items-center gap-1 mt-0.5">
                                                        <Users className="w-3 h-3" /> {line.contactName}
                                                    </div>
                                                )}
                                            </td>
                                            <td className="border border-gray-200 px-4 py-2 text-right font-mono">{line.debit > 0 ? formatNumber(line.debit) : '-'}</td>
                                            <td className="border border-gray-200 px-4 py-2 text-right font-mono">{line.credit > 0 ? formatNumber(line.credit) : '-'}</td>
                                        </tr>
                                    ))}
                                </tbody>
                                <tfoot className="bg-gray-50 font-bold">
                                    <tr>
                                        <td colSpan={2} className="border border-gray-200 px-4 py-2 text-right uppercase">Total</td>
                                        <td className="border border-gray-200 px-4 py-2 text-right font-mono">{formatNumber(drillDownJournal.totalAmount)}</td>
                                        <td className="border border-gray-200 px-4 py-2 text-right font-mono">{formatNumber(drillDownJournal.totalAmount)}</td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                        <div className="px-6 py-4 border-t border-gray-100 bg-gray-50 flex justify-end gap-3">
                            <button 
                                onClick={() => {
                                    window.print();
                                }}
                                className="px-5 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg text-sm font-bold hover:bg-gray-50 flex items-center gap-2"
                            >
                                <Printer className="w-4 h-4" /> Cetak Voucher
                            </button>
                            <button 
                                onClick={() => setDrillDownJournal(null)}
                                className="px-6 py-2 bg-gray-800 text-white rounded-lg text-sm font-bold hover:bg-gray-900 transition-colors"
                            >
                                Tutup
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
