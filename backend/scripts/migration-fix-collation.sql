-- Migration: Fix collation mismatch — Modul Persediaan & Dagang
-- Jalankan SEKALI di phpMyAdmin untuk benerin error:
--   "Illegal mix of collations (utf8mb4_general_ci,IMPLICIT) and (utf8mb4_unicode_ci,IMPLICIT)"
--
-- Penyebab: CREATE TABLE sebelumnya cuma nulis "DEFAULT CHARSET=utf8mb4" tanpa
-- COLLATE eksplisit, jadi MySQL di server ini jatuh ke default utf8mb4_general_ci.
-- Tabel lama (accounts, contacts, dst) pakai utf8mb4_unicode_ci — beda collation
-- bikin JOIN/WHERE antara tabel baru & lama ditolak MySQL.
--
-- MySQL nolak ubah collation kolom yang lagi dipegang FOREIGN KEY (errno 1833),
-- dan ternyata SET FOREIGN_KEY_CHECKS=0 saja TIDAK cukup untuk kasus ini — jadi
-- FK-nya harus di-drop dulu, convert semua tabel, baru dipasang lagi persis sama.
--
-- Kalau ada baris "DROP FOREIGN KEY" yang error "check that constraint exists"
-- (nama constraint-nya ternyata beda), jalankan dulu query ini buat cari nama
-- aslinya, lalu ganti baris yang error itu:
--   SELECT TABLE_NAME, CONSTRAINT_NAME, COLUMN_NAME, REFERENCED_TABLE_NAME
--   FROM information_schema.KEY_COLUMN_USAGE
--   WHERE TABLE_SCHEMA = DATABASE() AND REFERENCED_TABLE_NAME IS NOT NULL
--   AND TABLE_NAME = '<nama_tabel_yang_error>';

SET FOREIGN_KEY_CHECKS = 0;

-- ─── 1. Lepas semua FOREIGN KEY di tabel modul ini ──────────────────────────────
ALTER TABLE products               DROP FOREIGN KEY products_ibfk_1;               -- categoryId
ALTER TABLE products               DROP FOREIGN KEY products_ibfk_2;               -- unitId
ALTER TABLE stock_ledger           DROP FOREIGN KEY stock_ledger_ibfk_1;           -- productId
ALTER TABLE stock_ledger           DROP FOREIGN KEY stock_ledger_ibfk_2;           -- warehouseId
ALTER TABLE stock_adjustments      DROP FOREIGN KEY stock_adjustments_ibfk_1;      -- warehouseId
ALTER TABLE stock_adjustment_lines DROP FOREIGN KEY stock_adjustment_lines_ibfk_1; -- adjustmentId
ALTER TABLE stock_adjustment_lines DROP FOREIGN KEY stock_adjustment_lines_ibfk_2; -- productId
ALTER TABLE purchase_order_lines   DROP FOREIGN KEY purchase_order_lines_ibfk_1;   -- poId
ALTER TABLE purchase_order_lines   DROP FOREIGN KEY purchase_order_lines_ibfk_2;   -- productId
ALTER TABLE goods_receipts         DROP FOREIGN KEY goods_receipts_ibfk_1;         -- warehouseId
ALTER TABLE goods_receipt_lines    DROP FOREIGN KEY goods_receipt_lines_ibfk_1;    -- receiptId
ALTER TABLE goods_receipt_lines    DROP FOREIGN KEY goods_receipt_lines_ibfk_2;    -- productId
ALTER TABLE purchase_payments      DROP FOREIGN KEY purchase_payments_ibfk_1;      -- receiptId
ALTER TABLE sales_invoices         DROP FOREIGN KEY sales_invoices_ibfk_1;         -- warehouseId
ALTER TABLE sales_invoice_lines    DROP FOREIGN KEY sales_invoice_lines_ibfk_1;    -- invoiceId
ALTER TABLE sales_invoice_lines    DROP FOREIGN KEY sales_invoice_lines_ibfk_2;    -- productId
ALTER TABLE sales_payments         DROP FOREIGN KEY sales_payments_ibfk_1;         -- invoiceId

-- ─── 2. Convert collation semua tabel ───────────────────────────────────────────
ALTER TABLE product_categories     CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
ALTER TABLE units                  CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
ALTER TABLE warehouses             CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
ALTER TABLE products               CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
ALTER TABLE inventory_settings     CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
ALTER TABLE stock_ledger           CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
ALTER TABLE stock_adjustments      CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
ALTER TABLE stock_adjustment_lines CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
ALTER TABLE purchase_orders        CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
ALTER TABLE purchase_order_lines   CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
ALTER TABLE goods_receipts         CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
ALTER TABLE goods_receipt_lines    CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
ALTER TABLE purchase_payments      CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
ALTER TABLE sales_invoices         CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
ALTER TABLE sales_invoice_lines    CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
ALTER TABLE sales_payments         CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- ─── 3. Pasang lagi FOREIGN KEY-nya (definisi sama persis kayak semula) ─────────
ALTER TABLE products               ADD FOREIGN KEY (categoryId) REFERENCES product_categories(id);
ALTER TABLE products               ADD FOREIGN KEY (unitId) REFERENCES units(id);
ALTER TABLE stock_ledger           ADD FOREIGN KEY (productId) REFERENCES products(id);
ALTER TABLE stock_ledger           ADD FOREIGN KEY (warehouseId) REFERENCES warehouses(id);
ALTER TABLE stock_adjustments      ADD FOREIGN KEY (warehouseId) REFERENCES warehouses(id);
ALTER TABLE stock_adjustment_lines ADD FOREIGN KEY (adjustmentId) REFERENCES stock_adjustments(id) ON DELETE CASCADE;
ALTER TABLE stock_adjustment_lines ADD FOREIGN KEY (productId) REFERENCES products(id);
ALTER TABLE purchase_order_lines   ADD FOREIGN KEY (poId) REFERENCES purchase_orders(id) ON DELETE CASCADE;
ALTER TABLE purchase_order_lines   ADD FOREIGN KEY (productId) REFERENCES products(id);
ALTER TABLE goods_receipts         ADD FOREIGN KEY (warehouseId) REFERENCES warehouses(id);
ALTER TABLE goods_receipt_lines    ADD FOREIGN KEY (receiptId) REFERENCES goods_receipts(id) ON DELETE CASCADE;
ALTER TABLE goods_receipt_lines    ADD FOREIGN KEY (productId) REFERENCES products(id);
ALTER TABLE purchase_payments      ADD FOREIGN KEY (receiptId) REFERENCES goods_receipts(id);
ALTER TABLE sales_invoices         ADD FOREIGN KEY (warehouseId) REFERENCES warehouses(id);
ALTER TABLE sales_invoice_lines    ADD FOREIGN KEY (invoiceId) REFERENCES sales_invoices(id) ON DELETE CASCADE;
ALTER TABLE sales_invoice_lines    ADD FOREIGN KEY (productId) REFERENCES products(id);
ALTER TABLE sales_payments         ADD FOREIGN KEY (invoiceId) REFERENCES sales_invoices(id);

SET FOREIGN_KEY_CHECKS = 1;
