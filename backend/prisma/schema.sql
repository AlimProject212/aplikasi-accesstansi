-- ============================================================
--  AccessTansi — Database Schema v1.0
--  Generated from Prisma schema (MySQL)
--  Import via phpMyAdmin:
--    Database → pilih DB → Import → pilih file ini → Go
-- ============================================================

SET FOREIGN_KEY_CHECKS = 0;
SET NAMES utf8mb4;

-- ─── DROP TABLES (urut child → parent) ───────────────────────────────────────
DROP TABLE IF EXISTS `journal_lines`;
DROP TABLE IF EXISTS `journal_entries`;
DROP TABLE IF EXISTS `account_budgets`;
DROP TABLE IF EXISTS `locked_months`;
DROP TABLE IF EXISTS `accounts`;
DROP TABLE IF EXISTS `contacts`;
DROP TABLE IF EXISTS `fiscal_years`;
DROP TABLE IF EXISTS `app_config`;
DROP TABLE IF EXISTS `company_profile`;
DROP TABLE IF EXISTS `users`;

-- ─── USERS ───────────────────────────────────────────────────────────────────
CREATE TABLE `users` (
  `id`                  INT            NOT NULL AUTO_INCREMENT,
  `name`                VARCHAR(191)   NOT NULL,
  `email`               VARCHAR(191)   NOT NULL,
  `passwordHash`        VARCHAR(191)   NOT NULL,
  `role`                ENUM('SUPERADMIN','ADMIN','SUPERVISOR','ACCOUNTANT','VIEWER')
                                       NOT NULL DEFAULT 'ACCOUNTANT',
  `isActive`            TINYINT(1)     NOT NULL DEFAULT 1,
  `createdAt`           DATETIME(3)    NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt`           DATETIME(3)    NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
                                       ON UPDATE CURRENT_TIMESTAMP(3),
  `canManageUsers`      TINYINT(1)     NOT NULL DEFAULT 0,
  `canManageSettings`   TINYINT(1)     NOT NULL DEFAULT 0,
  `canManageCOA`        TINYINT(1)     NOT NULL DEFAULT 0,
  `canEntryJournal`     TINYINT(1)     NOT NULL DEFAULT 1,
  `canApproveJournal`   TINYINT(1)     NOT NULL DEFAULT 0,
  `canDeleteJournal`    TINYINT(1)     NOT NULL DEFAULT 0,
  `canViewReports`      TINYINT(1)     NOT NULL DEFAULT 1,
  PRIMARY KEY (`id`),
  UNIQUE KEY `users_email_key` (`email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─── COMPANY PROFILE (singleton id=1) ────────────────────────────────────────
CREATE TABLE `company_profile` (
  `id`          INT          NOT NULL AUTO_INCREMENT,
  `name`        VARCHAR(191) NOT NULL DEFAULT 'Perusahaan Saya',
  `address`     TEXT         NOT NULL,
  `city`        VARCHAR(191) NOT NULL DEFAULT '',
  `phone`       VARCHAR(191) NOT NULL DEFAULT '',
  `email`       VARCHAR(191) NOT NULL DEFAULT '',
  `website`     VARCHAR(191)     NULL,
  `taxId`       VARCHAR(191)     NULL,
  `logoUrl`     LONGTEXT         NULL,
  `updatedAt`   DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
                             ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─── APP CONFIG (singleton id=1) ─────────────────────────────────────────────
CREATE TABLE `app_config` (
  `id`                   INT          NOT NULL AUTO_INCREMENT,
  `lockDate`             VARCHAR(191) NOT NULL DEFAULT '',
  `fiscalYearStartMonth` INT          NOT NULL DEFAULT 1,
  `activePeriod`         VARCHAR(191) NOT NULL DEFAULT '',
  `updatedAt`            DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
                                      ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─── FISCAL YEARS ────────────────────────────────────────────────────────────
CREATE TABLE `fiscal_years` (
  `id`       INT          NOT NULL AUTO_INCREMENT,
  `year`     VARCHAR(191) NOT NULL,
  `isActive` TINYINT(1)   NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`),
  UNIQUE KEY `fiscal_years_year_key` (`year`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─── LOCKED MONTHS ───────────────────────────────────────────────────────────
CREATE TABLE `locked_months` (
  `id`           INT          NOT NULL AUTO_INCREMENT,
  `yearMonth`    VARCHAR(191) NOT NULL,
  `fiscalYearId` INT          NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `locked_months_yearMonth_key` (`yearMonth`),
  KEY `locked_months_fiscalYearId_fkey` (`fiscalYearId`),
  CONSTRAINT `locked_months_fiscalYearId_fkey`
    FOREIGN KEY (`fiscalYearId`) REFERENCES `fiscal_years` (`id`)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─── ACCOUNTS (Chart of Accounts) ────────────────────────────────────────────
CREATE TABLE `accounts` (
  `id`               VARCHAR(191)  NOT NULL,
  `code`             VARCHAR(191)  NOT NULL,
  `name`             VARCHAR(191)  NOT NULL,
  `type`             ENUM('ASSET','LIABILITY','EQUITY','REVENUE','EXPENSE') NOT NULL,
  `level`            INT           NOT NULL,
  `parentId`         VARCHAR(191)      NULL,
  `balance`          DOUBLE        NOT NULL DEFAULT 0,
  `isHeader`         TINYINT(1)    NOT NULL DEFAULT 0,
  `cashFlowCategory` ENUM('OPERATING','INVESTING','FINANCING') NULL,
  `createdAt`        DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt`        DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
                                   ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `accounts_code_key` (`code`),
  KEY `accounts_parentId_fkey` (`parentId`),
  CONSTRAINT `accounts_parentId_fkey`
    FOREIGN KEY (`parentId`) REFERENCES `accounts` (`id`)
    ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─── CONTACTS ────────────────────────────────────────────────────────────────
CREATE TABLE `contacts` (
  `id`        VARCHAR(191) NOT NULL,
  `name`      VARCHAR(191) NOT NULL,
  `type`      ENUM('CUSTOMER','VENDOR','BOTH') NOT NULL,
  `email`     VARCHAR(191)     NULL,
  `phone`     VARCHAR(191)     NULL,
  `address`   TEXT             NULL,
  `taxId`     VARCHAR(191)     NULL,
  `notes`     TEXT             NULL,
  `createdAt` DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
                           ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─── ACCOUNT BUDGETS ─────────────────────────────────────────────────────────
CREATE TABLE `account_budgets` (
  `id`           INT          NOT NULL AUTO_INCREMENT,
  `accountId`    VARCHAR(191) NOT NULL,
  `fiscalYear`   VARCHAR(191) NOT NULL,
  `annualAmount` DOUBLE       NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`),
  UNIQUE KEY `account_budgets_accountId_fiscalYear_key` (`accountId`, `fiscalYear`),
  KEY `account_budgets_accountId_fkey` (`accountId`),
  CONSTRAINT `account_budgets_accountId_fkey`
    FOREIGN KEY (`accountId`) REFERENCES `accounts` (`id`)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─── JOURNAL ENTRIES ─────────────────────────────────────────────────────────
CREATE TABLE `journal_entries` (
  `id`              VARCHAR(191)  NOT NULL,
  `transactionDate` DATETIME(3)   NOT NULL,
  `referenceNumber` VARCHAR(191)  NOT NULL,
  `description`     TEXT          NOT NULL,
  `totalAmount`     DOUBLE        NOT NULL,
  `status`          ENUM('DRAFT','POSTED','VOID') NOT NULL DEFAULT 'DRAFT',
  `createdAt`       DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt`       DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
                                  ON UPDATE CURRENT_TIMESTAMP(3),
  `createdById`     INT           NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `journal_entries_referenceNumber_key` (`referenceNumber`),
  KEY `journal_entries_transactionDate_idx` (`transactionDate`),
  KEY `journal_entries_status_idx` (`status`),
  KEY `journal_entries_createdById_fkey` (`createdById`),
  CONSTRAINT `journal_entries_createdById_fkey`
    FOREIGN KEY (`createdById`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─── JOURNAL LINES ───────────────────────────────────────────────────────────
CREATE TABLE `journal_lines` (
  `id`          VARCHAR(191) NOT NULL,
  `journalId`   VARCHAR(191) NOT NULL,
  `accountId`   VARCHAR(191) NOT NULL,
  `accountName` VARCHAR(191) NOT NULL,
  `debit`       DOUBLE       NOT NULL DEFAULT 0,
  `credit`      DOUBLE       NOT NULL DEFAULT 0,
  `contactId`   VARCHAR(191)     NULL,
  `contactName` VARCHAR(191)     NULL,
  `description` TEXT             NULL,
  `sortOrder`   INT          NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`),
  KEY `journal_lines_journalId_idx` (`journalId`),
  KEY `journal_lines_accountId_idx` (`accountId`),
  KEY `journal_lines_contactId_fkey` (`contactId`),
  CONSTRAINT `journal_lines_journalId_fkey`
    FOREIGN KEY (`journalId`) REFERENCES `journal_entries` (`id`)
    ON DELETE CASCADE,
  CONSTRAINT `journal_lines_accountId_fkey`
    FOREIGN KEY (`accountId`) REFERENCES `accounts` (`id`),
  CONSTRAINT `journal_lines_contactId_fkey`
    FOREIGN KEY (`contactId`) REFERENCES `contacts` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET FOREIGN_KEY_CHECKS = 1;

-- ============================================================
-- Schema berhasil dibuat! Sekarang jalankan seed_admin.php
-- untuk membuat user admin pertama.
-- ============================================================
