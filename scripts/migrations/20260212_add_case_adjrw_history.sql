CREATE TABLE IF NOT EXISTS `case_adjrw_history` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `case_id` bigint unsigned NOT NULL,
  `pre_adjrw` decimal(10,4) NOT NULL DEFAULT 0.0000,
  `post_adjrw` decimal(10,4) NOT NULL,
  `updated_by` bigint unsigned DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_case_adjrw_history_case_id` (`case_id`),
  KEY `idx_case_adjrw_history_created_at` (`created_at`),
  CONSTRAINT `fk_case_adjrw_history_case`
    FOREIGN KEY (`case_id`) REFERENCES `cases` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
