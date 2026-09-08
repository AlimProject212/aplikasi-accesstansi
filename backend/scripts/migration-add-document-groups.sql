-- ============================================================
-- Migration: Tambah Fitur Grup Dokumen
-- Jalankan di phpMyAdmin atau MySQL console
-- Aman dijalankan berkali-kali (IF NOT EXISTS)
-- ============================================================

CREATE TABLE IF NOT EXISTS `document_groups` (
  `id`          INT           NOT NULL AUTO_INCREMENT,
  `companyId`   INT           NOT NULL DEFAULT 1,
  `name`        VARCHAR(255)  NOT NULL,
  `description` TEXT,
  `createdBy`   VARCHAR(255),
  `createdAt`   DATETIME      NOT NULL DEFAULT NOW(),
  `updatedAt`   DATETIME      NOT NULL DEFAULT NOW() ON UPDATE NOW(),
  PRIMARY KEY (`id`),
  INDEX `idx_company` (`companyId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `document_group_members` (
  `id`         INT          NOT NULL AUTO_INCREMENT,
  `groupId`    INT          NOT NULL,
  `documentId` INT          NOT NULL,
  `addedBy`    VARCHAR(255),
  `addedAt`    DATETIME     NOT NULL DEFAULT NOW(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_group_doc` (`groupId`, `documentId`),
  INDEX `idx_group`    (`groupId`),
  INDEX `idx_document` (`documentId`),
  CONSTRAINT `fk_dgm_group`
    FOREIGN KEY (`groupId`)    REFERENCES `document_groups` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_dgm_document`
    FOREIGN KEY (`documentId`) REFERENCES `audit_documents` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
