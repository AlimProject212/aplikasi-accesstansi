const SATUAN = [
  '', 'Satu', 'Dua', 'Tiga', 'Empat', 'Lima', 'Enam', 'Tujuh', 'Delapan', 'Sembilan', 'Sepuluh', 'Sebelas',
];

/** Ubah angka non-negatif menjadi rangkaian kata bahasa Indonesia. */
function angkaKeKata(n: number): string {
  if (n < 12) return SATUAN[n];
  if (n < 20) return `${angkaKeKata(n - 10)} Belas`;
  if (n < 100) {
    const sisa = n % 10;
    return `${angkaKeKata(Math.floor(n / 10))} Puluh${sisa ? ' ' + angkaKeKata(sisa) : ''}`;
  }
  if (n < 200) return `Seratus${n - 100 ? ' ' + angkaKeKata(n - 100) : ''}`;
  if (n < 1000) {
    const sisa = n % 100;
    return `${angkaKeKata(Math.floor(n / 100))} Ratus${sisa ? ' ' + angkaKeKata(sisa) : ''}`;
  }
  if (n < 2000) return `Seribu${n - 1000 ? ' ' + angkaKeKata(n - 1000) : ''}`;
  if (n < 1000000) {
    const sisa = n % 1000;
    return `${angkaKeKata(Math.floor(n / 1000))} Ribu${sisa ? ' ' + angkaKeKata(sisa) : ''}`;
  }
  if (n < 1000000000) {
    const sisa = n % 1000000;
    return `${angkaKeKata(Math.floor(n / 1000000))} Juta${sisa ? ' ' + angkaKeKata(sisa) : ''}`;
  }
  if (n < 1000000000000) {
    const sisa = n % 1000000000;
    return `${angkaKeKata(Math.floor(n / 1000000000))} Miliar${sisa ? ' ' + angkaKeKata(sisa) : ''}`;
  }
  const sisa = n % 1000000000000;
  return `${angkaKeKata(Math.floor(n / 1000000000000))} Triliun${sisa ? ' ' + angkaKeKata(sisa) : ''}`;
}

/** Ubah nominal rupiah menjadi terbilang, contoh: 1500000 -> "Satu Juta Lima Ratus Ribu Rupiah". */
export function terbilangRupiah(amount: number): string {
  const bulat = Math.round(Math.abs(amount));
  if (bulat === 0) return 'Nol Rupiah';
  const kata = angkaKeKata(bulat).replace(/\s+/g, ' ').trim();
  return `${amount < 0 ? 'Minus ' : ''}${kata} Rupiah`;
}
