-- AlterTable
ALTER TABLE `DecisionLog` ADD COLUMN `contextSnapshot` LONGTEXT NULL;

-- AlterTable
ALTER TABLE `Event` ADD COLUMN `description` TEXT NULL,
    ADD COLUMN `memoryTag` VARCHAR(191) NULL DEFAULT 'time_sensitive';
