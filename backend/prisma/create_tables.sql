-- ============================================================
-- AccessTansi — Full Schema Migration
-- Jalankan di phpMyAdmin jika tabel belum ada
-- Semua pakai IF NOT EXISTS, aman dijalankan berkali-kali
-- ============================================================

CREATE TABLE IF NOT EXISTS `users` (
  `id`                 INT          NOT NULL AUTO_INCREMENT,
  `name`               VARCHAR(255) NOT NULL,
  `email`              VARCHAR(255) NOT NULL UNIQUE,
  `passwordHash`       VARCHAR(255) NOT NULL,
  `role`               ENUM('SUPERADMIN','ADMIN','SUPERVISOR','ACCOUNTANT','VIEWER') NOT NULL DEFAULT 'ACCOUNTANT',
  `isActive`           TINYINT(1)   NOT NULL DEFAULT 1,
  `createdAt`          DATETIME     NOT NULL DEFAULT NOW(),
  `updatedAt`          DATETIME     NOT NULL DEFAULT NOW() ON UPDATE NOW(),
  `canManageUsers`     TINYINT(1)   NOT NULL DEFAULT 0,
  `canManageSettings`  TINYINT(1)   NOT NULL DEFAULT 0,
  `canManageCOA`       TINYINT(1)   NOT NULL DEFAULT 0,
  `canEntryJournal`    TINYINT(1)   NOT NULL DEFAULT 1,
  `canApproveJournal`  TINYINT(1)   NOT NULL DEFAULT 0,
  `canDeleteJournal`   TINYINT(1)   NOT NULL DEFAULT 0,
  `canViewReports`     TINYINT(1)   NOT NULL DEFAULT 1,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `company_profile` (
  `id`        INT          NOT NULL AUTO_INCREMENT,
  `name`      VARCHAR(255) NOT NULL DEFAULT 'Perusahaan Saya',
  `address`   TEXT         NOT NULL,
  `city`      VARCHAR(255) NOT NULL DEFAULT '',
  `phone`     VARCHAR(255) NOT NULL DEFAULT '',
  `email`     VARCHAR(255) NOT NULL DEFAULT '',
  `website`   VARCHAR(255),
  `taxId`     VARCHAR(255),
  `logoUrl`   LONGTEXT,
  `updatedAt` DATETIME     NOT NULL DEFAULT NOW() ON UPDATE NOW(),
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `app_config` (
  `id`                   INT          NOT NULL AUTO_INCREMENT,
  `lockDate`             VARCHAR(255) NOT NULL DEFAULT '',
  `fiscalYearStartMonth` INT          NOT NULL DEFAULT 1,
  `activePeriod`         VARCHAR(255) NOT NULL DEFAULT '',
  `updatedAt`            DATETIME     NOT NULL DEFAULT NOW() ON UPDATE NOW(),
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `fiscal_years` (
  `id`       INT         NOT NULL AUTO_INCREMENT,
  `year`     VARCHAR(10) NOT NULL UNIQUE,
  `isActive` TINYINT(1)  NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `locked_months` (
  `id`           INT         NOT NULL AUTO_INCREMENT,
  `yearMonth`    VARCHAR(10) NOT NULL UNIQUE,
  `fiscalYearId` INT         NOT NULL,
  PRIMARY KEY (`id`),
  FOREIGN KEY (`fiscalYearId`) REFERENCES `fiscal_years`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `accounts` (
  `id`               VARCHAR(36)  NOT NULL,
  `code`             VARCHAR(255) NOT NULL UNIQUE,
  `name`             VARCHAR(255) NOT NULL,
  `type`             ENUM('ASSET','LIABILITY','EQUITY','REVENUE','EXPENSE') NOT NULL,
  `level`            INT          NOT NULL,
  `parentId`         VARCHAR(36),
  `balance`          DOUBLE       NOT NULL DEFAULT 0,
  `isHeader`         TINYINT(1)   NOT NULL DEFAULT 0,
  `cashFlowCategory` ENUM('OPERATING','INVESTING','FINANCING'),
  `createdAt`        DATETIME     NOT NULL DEFAULT NOW(),
  `updatedAt`        DATETIME     NOT NULL DEFAULT NOW() ON UPDATE NOW(),
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `contacts` (
  `id`        VARCHAR(36)  NOT NULL,
  `name`      VARCHAR(255) NOT NULL,
  `type`      ENUM('CUSTOMER','VENDOR','BOTH') NOT NULL,
  `email`     VARCHAR(255),
  `phone`     VARCHAR(255),
  `address`   TEXT,
  `taxId`     VARCHAR(255),
  `notes`     TEXT,
  `createdAt` DATETIME     NOT NULL DEFAULT NOW(),
  `updatedAt` DATETIME     NOT NULL DEFAULT NOW() ON UPDATE NOW(),
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `account_budgets` (
  `id`           INT         NOT NULL AUTO_INCREMENT,
  `accountId`    VARCHAR(36) NOT NULL,
  `fiscalYear`   VARCHAR(10) NOT NULL,
  `annualAmount` DOUBLE      NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_account_year` (`accountId`, `fiscalYear`),
  FOREIGN KEY (`accountId`) REFERENCES `accounts`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `journal_entries` (
  `id`              VARCHAR(36)  NOT NULL,
  `transactionDate` DATETIME     NOT NULL,
  `referenceNumber` VARCHAR(255) NOT NULL UNIQUE,
  `description`     TEXT         NOT NULL,
  `totalAmount`     DOUBLE       NOT NULL,
  `status`          ENUM('DRAFT','POSTED','VOID') NOT NULL DEFAULT 'DRAFT',
  `createdAt`       DATETIME     NOT NULL DEFAULT NOW(),
  `updatedAt`       DATETIME     NOT NULL DEFAULT NOW() ON UPDATE NOW(),
  `createdById`     INT          NOT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_date`   (`transactionDate`),
  KEY `idx_status` (`status`),
  FOREIGN KEY (`createdById`) REFERENCES `users`(`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `journal_lines` (
  `id`          VARCHAR(36)  NOT NULL,
  `journalId`   VARCHAR(36)  NOT NULL,
  `accountId`   VARCHAR(36)  NOT NULL,
  `accountName` VARCHAR(255) NOT NULL,
  `debit`       DOUBLE       NOT NULL DEFAULT 0,
  `credit`      DOUBLE       NOT NULL DEFAULT 0,
  `contactId`   VARCHAR(36),
  `contactName` VARCHAR(255),
  `description` TEXT,
  `sortOrder`   INT          NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`),
  KEY `idx_journal` (`journalId`),
  KEY `idx_account` (`accountId`),
  FOREIGN KEY (`journalId`) REFERENCES `journal_entries`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`accountId`) REFERENCES `accounts`(`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Seed default singleton rows (aman dijalankan ulang)
INSERT IGNORE INTO `company_profile` (`id`, `name`, `address`, `city`, `phone`, `email`)
VALUES (1, 'Perusahaan Saya', '', '', '', '');

INSERT IGNORE INTO `app_config` (`id`, `lockDate`, `fiscalYearStartMonth`, `activePeriod`)
VALUES (1, '', 1, YEAR(NOW()));

INSERT IGNORE INTO `fiscal_years` (`year`, `isActive`)
VALUES (YEAR(NOW()), 1);

-- ─── API CONFIGS (tambahan v2.1) ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `api_configs` (
  `id`          INT          NOT NULL AUTO_INCREMENT,
  `serviceName` VARCHAR(100) NOT NULL,
  `keyName`     VARCHAR(100) NOT NULL,
  `keyValue`    TEXT         NOT NULL,
  `description` VARCHAR(255),
  `isActive`    TINYINT(1)   NOT NULL DEFAULT 1,
  `createdAt`   DATETIME     NOT NULL DEFAULT NOW(),
  `updatedAt`   DATETIME     NOT NULL DEFAULT NOW() ON UPDATE NOW(),
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ─── JOURNAL ATTACHMENT (tambahan v2.2) ──────────────────────────────────────
-- Jalankan ALTER ini jika tabel journal_entries sudah ada
ALTER TABLE `journal_entries`
  ADD COLUMN IF NOT EXISTS `attachment`     LONGTEXT     NULL AFTER `description`,
  ADD COLUMN IF NOT EXISTS `attachmentName` VARCHAR(255) NULL AFTER `attachment`;
