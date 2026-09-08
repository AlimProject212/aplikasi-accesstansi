
import React, { useState, useEffect } from 'react';
import { HierarchicalAccount, AccountType } from '../../types';
import { Save, AlertTriangle } from 'lucide-react';
import { accountsService } from '../../src/services/accounts.service';
import { useUI } from '../../src/context/UIContext';

// Utility: Format 8 digit code
const formatAccountCode = (code: string): string => {
  const clean = code.replace(/\D/g, '');
  if (clean.length <= 3) return clean;
  if (clean.length <= 5) return `${clean.slice(0, 3)}-${clean.slice(3)}`;
  return `${clean.slice(0, 3)}-${clean.slice(3, 5)}-${clean.slice(5, 8)}`;
};

// Utility: Format Number with Thousand Separator (Indonesian Standard)
const formatNumber = (num: string | number): string => {
  if (!num) return '';
  const cleanStr = num.toString().replace(/\D/g, '');
  return cleanStr.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
};

// Utility: Parse formatted string back to number
const parseNumber = (str: string): number => {
  if (!str) return 0;
  return Number(str.replace(/\./g, ''));
};

interface BalanceState {
  debit: string;
  credit: string;
}

export const OpeningBalance: React.FC = () => {
  const { toast } = useUI();
  const [accounts, setAccounts] = useState<HierarchicalAccount[]>([]);
  const [balances, setBalances] = useState<Record<string, BalanceState>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    accountsService.getAll()
      .then(data => {
        // STRICT FILTER LOGIC: Level 5 & Balance Sheet Accounts only
        const detailAccounts = data.filter(acc =>
          acc.level === 5 &&
          (
            acc.type === AccountType.ASSET ||
            acc.type === AccountType.LIABILITY ||
            acc.type === AccountType.EQUITY
          )
        );
        setAccounts(detailAccounts);

        // Initialize state from existing balances with FORMATTING
        const initialBalances: Record<string, BalanceState> = {};
        detailAccounts.forEach(acc => {
          let debit = '';
          let credit = '';

          if (acc.balance !== 0) {
            const isDebitNormal = acc.type === AccountType.ASSET || acc.type === AccountType.EXPENSE;
            if (isDebitNormal) {
              if (acc.balance > 0) debit = formatNumber(acc.balance);
              else credit = formatNumber(Math.abs(acc.balance));
            } else {
              if (acc.balance > 0) credit = formatNumber(acc.balance);
              else debit = formatNumber(Math.abs(acc.balance));
            }
          }

          initialBalances[acc.id] = { debit, credit };
        });
        setBalances(initialBalances);
      })
      .catch(() => toast('Gagal memuat data akun dari server.', 'error'))
      .finally(() => setIsLoading(false));
  }, []);

  const handleInputChange = (id: string, field: 'debit' | 'credit', value: string) => {
    const rawValue = value.replace(/\D/g, '');
    const formattedValue = formatNumber(rawValue);

    setBalances(prev => {
      const newState = { ...prev };
      if (field === 'debit') {
        newState[id] = { debit: formattedValue, credit: formattedValue ? '0' : prev[id].credit };
        if (formattedValue && formattedValue !== '0') newState[id].credit = '0';
      } else {
        newState[id] = { credit: formattedValue, debit: formattedValue ? '0' : prev[id].debit };
        if (formattedValue && formattedValue !== '0') newState[id].debit = '0';
      }
      return newState;
    });
  };

  const calculateTotals = () => {
    let totalDebit = 0;
    let totalCredit = 0;

    Object.keys(balances).forEach(key => {
      const b = balances[key];
      totalDebit += parseNumber(b.debit || '0');
      totalCredit += parseNumber(b.credit || '0');
    });

    return { totalDebit, totalCredit, difference: totalDebit - totalCredit };
  };

  const { totalDebit, totalCredit, difference } = calculateTotals();

  const handleSave = async () => {
    if (difference !== 0) {
      toast("Gagal menyimpan: Total Debit dan Kredit harus seimbang (0). Silakan periksa kembali input Anda.", 'error');
      return;
    }

    setIsSaving(true);
    try {
      // Update each account balance via API
      const updates = accounts.map(acc => {
        const bal = balances[acc.id];
        if (!bal) return null;

        const d = parseNumber(bal.debit || '0');
        const c = parseNumber(bal.credit || '0');
        const isDebitNormal = acc.type === AccountType.ASSET || acc.type === AccountType.EXPENSE;
        const finalBalance = isDebitNormal ? d - c : c - d;

        if (finalBalance === acc.balance) return null; // no change
        return accountsService.update(acc.id, { ...acc, balance: finalBalance });
      }).filter(Boolean);

      await Promise.all(updates);
      toast("Saldo awal berhasil disimpan!", 'success');
    } catch (err: any) {
      toast(err.message || 'Gagal menyimpan saldo awal.', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  // Sort by code
  const sortedAccounts = [...accounts].sort((a, b) => a.code.localeCompare(b.code));

  // Currency formatter helper
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  if (isLoading) return <div className="p-10 text-center text-gray-500">Memuat data saldo awal...</div>;

  return (
    <div className="space-y-6 pb-20"> {/* pb-20 for sticky footer */}
      {/* HEADER */}
      <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
                <h2 className="text-xl font-bold text-gray-900">Saldo Awal Akun</h2>
                <p className="text-gray-500 text-sm mt-1">Masukkan saldo awal (Hanya Akun Neraca Level 5) per tanggal awal periode.</p>
            </div>
            <div className="flex gap-2">
                <button
                    onClick={handleSave}
                    disabled={difference !== 0 || isSaving}
                    className={`px-4 py-2 rounded-lg transition text-sm font-semibold flex items-center gap-2 ${
                        difference === 0 && !isSaving
                            ? 'bg-primary-500 text-white hover:bg-primary-600 shadow-sm'
                            : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    }`}
                    title={difference !== 0 ? "Total Debit dan Kredit harus seimbang" : ""}
                >
                    <Save className="w-4 h-4" />
                    {isSaving ? 'Menyimpan...' : 'Simpan Perubahan'}
                </button>
            </div>
        </div>

        {difference !== 0 && (
             <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-start sm:items-center gap-3 text-sm text-red-700">
                <AlertTriangle className="w-5 h-5 shrink-0" />
                <div>
                    <span className="font-bold">Perhatian: Saldo Tidak Seimbang!</span>
                    <span className="ml-1">Total Debit dan Kredit harus sama (0). Saat ini selisih: </span>
                    <span className="font-mono font-bold bg-white px-2 py-0.5 rounded border border-red-100 ml-1">
                      {formatCurrency(Math.abs(difference))}
                    </span>
                </div>
            </div>
        )}
      </div>

      {/* TABLE */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <table className="w-full text-sm text-left">
            <thead className="bg-gray-50 text-gray-700 font-semibold border-b border-gray-200 uppercase text-xs tracking-wider">
                <tr>
                    <th className="px-6 py-4">Nomor Akun</th>
                    <th className="px-6 py-4">Nama Akun</th>
                    <th className="px-6 py-4 text-right">Saldo Debit</th>
                    <th className="px-6 py-4 text-right">Saldo Kredit</th>
                </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
                {sortedAccounts.length === 0 ? (
                    <tr>
                        <td colSpan={4} className="px-6 py-8 text-center text-gray-500">
                            Tidak ada akun neraca level 5 yang ditemukan. Silakan tambah akun di menu Daftar Akun.
                        </td>
                    </tr>
                ) : (
                    sortedAccounts.map(account => (
                        <tr key={account.id} className="hover:bg-gray-50 transition-colors">
                            <td className="px-6 py-3 font-mono text-gray-600">{formatAccountCode(account.code)}</td>
                            <td className="px-6 py-3 font-medium text-gray-800">{account.name}</td>
                            <td className="px-6 py-2 text-right w-48">
                                <input
                                    type="text"
                                    value={balances[account.id]?.debit === '0' ? '' : balances[account.id]?.debit}
                                    onChange={(e) => handleInputChange(account.id, 'debit', e.target.value)}
                                    placeholder="0"
                                    className="w-full text-right px-3 py-1.5 border border-gray-200 rounded focus:ring-1 focus:ring-primary-500 focus:border-primary-500 outline-none transition font-mono"
                                />
                            </td>
                             <td className="px-6 py-2 text-right w-48">
                                <input
                                    type="text"
                                    value={balances[account.id]?.credit === '0' ? '' : balances[account.id]?.credit}
                                    onChange={(e) => handleInputChange(account.id, 'credit', e.target.value)}
                                    placeholder="0"
                                    className="w-full text-right px-3 py-1.5 border border-gray-200 rounded focus:ring-1 focus:ring-primary-500 focus:border-primary-500 outline-none transition font-mono"
                                />
                            </td>
                        </tr>
                    ))
                )}
            </tbody>
        </table>
      </div>

      {/* STICKY FOOTER */}
      <div className="fixed bottom-0 left-0 lg:left-64 right-0 bg-white border-t border-gray-200 p-4 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)]">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row justify-end gap-8 pr-4">
            <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm">
                <span className="text-gray-500 font-medium text-right">Total Debit:</span>
                <span className="font-bold text-gray-900 text-right font-mono">
                    {formatCurrency(totalDebit)}
                </span>

                <span className="text-gray-500 font-medium text-right">Total Kredit:</span>
                <span className="font-bold text-gray-900 text-right font-mono">
                    {formatCurrency(totalCredit)}
                </span>
            </div>

            <div className="border-l border-gray-200 pl-8 flex flex-col justify-center">
                 <span className="text-xs text-gray-500 uppercase tracking-wide font-semibold mb-1">Selisih (Balance)</span>
                 <span className={`text-xl font-bold font-mono ${difference === 0 ? 'text-primary-500' : 'text-red-500'}`}>
                    {formatCurrency(Math.abs(difference))}
                 </span>
                 {difference !== 0 && (
                     <span className="text-xs text-red-500 mt-0.5">Tidak Seimbang</span>
                 )}
            </div>
        </div>
      </div>
    </div>
  );
};
