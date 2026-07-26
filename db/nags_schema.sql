-- =============================================================
--  GlassLogic v2.0 — Full NAGS Database Schema
--  Mirrors the DATA/ flat-file structure exactly.
--  Run once: mysql -u root -p < server/db/nags_schema.sql
-- =============================================================

CREATE DATABASE IF NOT EXISTS glasslogic
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE glasslogic;

-- ─────────────────────────────────────────────────────────────
--  REFERENCE / LOOKUP TABLES
-- ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS makes (
  id           INT           NOT NULL,
  nags_code    VARCHAR(10)   NOT NULL DEFAULT '',
  abbreviation VARCHAR(20)   NOT NULL DEFAULT '',
  full_name    VARCHAR(60)   NOT NULL DEFAULT '',
  PRIMARY KEY (id),
  KEY idx_makes_abbr (abbreviation)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS models (
  id       INT           NOT NULL,
  make_id  INT           NOT NULL,
  code     VARCHAR(20)   NOT NULL DEFAULT '',
  name     VARCHAR(60)   NOT NULL DEFAULT '',
  PRIMARY KEY (id),
  KEY idx_models_make (make_id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS body_styles (
  id          INT           NOT NULL,
  code        VARCHAR(20)   NOT NULL DEFAULT '',
  description VARCHAR(80)   NOT NULL DEFAULT '',
  PRIMARY KEY (id),
  UNIQUE KEY uq_body_code (code)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS glass_colors (
  code        VARCHAR(5)   NOT NULL,
  tier        TINYINT      NOT NULL DEFAULT 1,
  description VARCHAR(100) NOT NULL DEFAULT '',
  PRIMARY KEY (code)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS hw_colors (
  code        VARCHAR(5)   NOT NULL,
  description VARCHAR(60)  NOT NULL DEFAULT '',
  PRIMARY KEY (code)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS hw_types (
  code        VARCHAR(5)   NOT NULL,
  description VARCHAR(60)  NOT NULL DEFAULT '',
  unit        VARCHAR(5)   NOT NULL DEFAULT '',
  PRIMARY KEY (code)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS opening_types (
  code        VARCHAR(5)   NOT NULL,
  description VARCHAR(60)  NOT NULL DEFAULT '',
  PRIMARY KEY (code)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS qualifiers (
  id          INT           NOT NULL,
  type_id     INT           NOT NULL DEFAULT 0,
  description VARCHAR(200)  NOT NULL DEFAULT '',
  PRIMARY KEY (id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS notes (
  id      INT           NOT NULL,
  type    VARCHAR(10)   NOT NULL DEFAULT '',
  text    VARCHAR(500)  NOT NULL DEFAULT '',
  PRIMARY KEY (id)
) ENGINE=InnoDB;

-- OEM manufacturer companies (mf.txt)
CREATE TABLE IF NOT EXISTS manufacturers (
  code           VARCHAR(10)  NOT NULL,
  abbreviation   VARCHAR(20)  NOT NULL DEFAULT '',
  full_name      VARCHAR(100) NOT NULL DEFAULT '',
  active_oem     CHAR(1)      NOT NULL DEFAULT 'N',
  active_retail  CHAR(1)      NOT NULL DEFAULT 'N',
  PRIMARY KEY (code)
) ENGINE=InnoDB;

-- Glass manufacturers from interchange.txt (e.g. AGC=ASAHI)
CREATE TABLE IF NOT EXISTS glass_manufacturers (
  code      VARCHAR(10)   NOT NULL,
  full_name VARCHAR(100)  NOT NULL DEFAULT '',
  PRIMARY KEY (code)
) ENGINE=InnoDB;

-- Vehicle sub-model modifiers (e.g. F100, F150 for Ford)
CREATE TABLE IF NOT EXISTS vehicle_modifiers (
  id   INT          NOT NULL,
  code VARCHAR(20)  NOT NULL DEFAULT '',
  name VARCHAR(60)  NOT NULL DEFAULT '',
  PRIMARY KEY (id)
) ENGINE=InnoDB;

-- ─────────────────────────────────────────────────────────────
--  VEHICLE CATALOG
-- ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS vehicles (
  id              INT           NOT NULL,
  year            SMALLINT      NOT NULL,
  make_id         INT           NOT NULL,
  model_id        INT           NOT NULL,
  body_style_code VARCHAR(20)   NOT NULL DEFAULT '',
  designator      VARCHAR(20)   NOT NULL DEFAULT '',
  col7            VARCHAR(20)   NOT NULL DEFAULT '',
  col8            VARCHAR(20)   NOT NULL DEFAULT '',
  PRIMARY KEY (id),
  KEY idx_veh_make  (make_id),
  KEY idx_veh_model (model_id),
  KEY idx_veh_year  (year)
) ENGINE=InnoDB;

-- ─────────────────────────────────────────────────────────────
--  NAGS GLASS CATALOG  (nags_glass.txt)
-- ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS nags_glass (
  part_no        VARCHAR(20)   NOT NULL,
  prefix         VARCHAR(5)    NOT NULL DEFAULT '',
  nags_num       VARCHAR(10)   NOT NULL DEFAULT '',
  is_oem         CHAR(1)       NOT NULL DEFAULT 'N',
  height         DECIMAL(7,2)  NOT NULL DEFAULT 0.00,
  width          DECIMAL(7,2)  NOT NULL DEFAULT 0.00,
  is_encapsulated CHAR(1)      NOT NULL DEFAULT 'N',
  is_modular     CHAR(1)       NOT NULL DEFAULT 'N',
  has_solar      CHAR(1)       NOT NULL DEFAULT 'N',
  solar_tint     VARCHAR(5)    NOT NULL DEFAULT '',
  is_privacy     CHAR(1)       NOT NULL DEFAULT 'N',
  is_heated      CHAR(1)       NOT NULL DEFAULT 'N',
  col13          VARCHAR(20)   NOT NULL DEFAULT '',
  col14          VARCHAR(20)   NOT NULL DEFAULT '',
  col15          VARCHAR(20)   NOT NULL DEFAULT '',
  col16          VARCHAR(20)   NOT NULL DEFAULT '',
  labor_hours    DECIMAL(5,1)  NOT NULL DEFAULT 0.0,
  PRIMARY KEY (part_no),
  KEY idx_ng_prefix (prefix)
) ENGINE=InnoDB;

-- Glass detail: color info per part (nags_glass_det.txt)
CREATE TABLE IF NOT EXISTS nags_glass_det (
  part_no    VARCHAR(20)  NOT NULL,
  flag1      CHAR(1)      NOT NULL DEFAULT '',
  color_code VARCHAR(5)   NOT NULL DEFAULT '',
  flag2      CHAR(1)      NOT NULL DEFAULT '',
  PRIMARY KEY (part_no)
) ENGINE=InnoDB;

-- Glass pricing history (nags_glass_prc.txt)
CREATE TABLE IF NOT EXISTS nags_glass_prc (
  part_no       VARCHAR(20)    NOT NULL,
  is_oem        CHAR(1)        NOT NULL DEFAULT 'N',
  region        VARCHAR(5)     NOT NULL DEFAULT '',
  flag1         CHAR(1)        NOT NULL DEFAULT '',
  unit          VARCHAR(5)     NOT NULL DEFAULT '',
  effective_date DATE          NOT NULL,
  discount_type VARCHAR(5)     NOT NULL DEFAULT '',
  list_price    DECIMAL(12,2)  NOT NULL DEFAULT 0.00,
  price_type    VARCHAR(5)     NOT NULL DEFAULT '',
  col10         VARCHAR(20)    NOT NULL DEFAULT '',
  KEY idx_ngp_part (part_no),
  KEY idx_ngp_date (part_no, effective_date)
) ENGINE=InnoDB;

-- Glass qualifiers (nags_glass_qual.txt)
CREATE TABLE IF NOT EXISTS nags_glass_qual (
  part_no  VARCHAR(20)  NOT NULL,
  qual_id  INT          NOT NULL DEFAULT 0,
  position INT          NOT NULL DEFAULT 0,
  KEY idx_ngq_part (part_no)
) ENGINE=InnoDB;

-- Glass interchange (nags_glass_intchg.txt)
CREATE TABLE IF NOT EXISTS nags_glass_intchg (
  part_no        VARCHAR(20)  NOT NULL,
  interchg_part  VARCHAR(20)  NOT NULL,
  mfr_code       VARCHAR(10)  NOT NULL DEFAULT '',
  flag           VARCHAR(5)   NOT NULL DEFAULT '',
  KEY idx_ngi_part (part_no)
) ENGINE=InnoDB;

-- What openings a glass fits and its color (glass_on_opening.txt)
CREATE TABLE IF NOT EXISTS glass_on_opening (
  part_no      VARCHAR(20)  NOT NULL,
  opening_num  INT          NOT NULL DEFAULT 0,
  color_code   VARCHAR(5)   NOT NULL DEFAULT '',
  col4         VARCHAR(20)  NOT NULL DEFAULT '',
  col5         VARCHAR(20)  NOT NULL DEFAULT '',
  col6         VARCHAR(20)  NOT NULL DEFAULT '',
  KEY idx_goo_part (part_no)
) ENGINE=InnoDB;

-- ─────────────────────────────────────────────────────────────
--  VEHICLE → GLASS MAPPING  (large tables ~428K rows each)
-- ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS veh_glass (
  veh_id   INT           NOT NULL,
  part_no  VARCHAR(20)   NOT NULL,
  flag1    INT           NOT NULL DEFAULT 0,
  col4     VARCHAR(20)   NOT NULL DEFAULT '',
  col5     VARCHAR(20)   NOT NULL DEFAULT '',
  col6     VARCHAR(20)   NOT NULL DEFAULT '',
  col7     VARCHAR(20)   NOT NULL DEFAULT '',
  KEY idx_vg_veh  (veh_id),
  KEY idx_vg_part (part_no)
) ENGINE=InnoDB;

-- Regional pricing per vehicle-glass pair (veh_glass_region.txt)
CREATE TABLE IF NOT EXISTS veh_glass_region (
  veh_id     INT           NOT NULL,
  part_no    VARCHAR(20)   NOT NULL,
  flag1      INT           NOT NULL DEFAULT 0,
  unit       VARCHAR(5)    NOT NULL DEFAULT '',
  list_price DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  KEY idx_vgr_veh (veh_id, part_no)
) ENGINE=InnoDB;

-- Notes attached to a vehicle-glass pair (veh_glass_note.txt)
CREATE TABLE IF NOT EXISTS veh_glass_note (
  veh_id  INT  NOT NULL,
  part_no VARCHAR(20) NOT NULL,
  flag1   INT  NOT NULL DEFAULT 0,
  note_id INT  NOT NULL DEFAULT 0,
  KEY idx_vgn_veh (veh_id, part_no)
) ENGINE=InnoDB;

-- ─────────────────────────────────────────────────────────────
--  OEM GLASS  (oem_glass.txt)
-- ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS oem_glass (
  mf_code    VARCHAR(10)  NOT NULL DEFAULT '',
  mf_part_no VARCHAR(30)  NOT NULL DEFAULT '',
  color_code VARCHAR(5)   NOT NULL DEFAULT '',
  is_oem     CHAR(1)      NOT NULL DEFAULT 'N',
  part_no2   VARCHAR(30)  NOT NULL DEFAULT '',
  KEY idx_og_mf (mf_code, mf_part_no)
) ENGINE=InnoDB;

-- ─────────────────────────────────────────────────────────────
--  NAGS HARDWARE CATALOG
-- ─────────────────────────────────────────────────────────────

-- Hardware parts (nags_hw.txt)
CREATE TABLE IF NOT EXISTS nags_hw (
  part_no   VARCHAR(20)  NOT NULL,
  type_code VARCHAR(5)   NOT NULL DEFAULT '',
  hw_num    VARCHAR(20)  NOT NULL DEFAULT '',
  col4      VARCHAR(20)  NOT NULL DEFAULT '',
  col5      VARCHAR(20)  NOT NULL DEFAULT '',
  PRIMARY KEY (part_no),
  KEY idx_nh_type (type_code)
) ENGINE=InnoDB;

-- Hardware color (nags_hw_det.txt)
CREATE TABLE IF NOT EXISTS nags_hw_det (
  part_no    VARCHAR(20)  NOT NULL,
  color_code VARCHAR(5)   NOT NULL DEFAULT '',
  KEY idx_nhd_part (part_no)
) ENGINE=InnoDB;

-- Hardware pricing (nags_hw_prc.txt)
CREATE TABLE IF NOT EXISTS nags_hw_prc (
  part_no        VARCHAR(20)    NOT NULL,
  region         VARCHAR(5)     NOT NULL DEFAULT '',
  unit           VARCHAR(5)     NOT NULL DEFAULT '',
  list_price     DECIMAL(12,2)  NOT NULL DEFAULT 0.00,
  effective_date DATE           NOT NULL,
  active         CHAR(1)        NOT NULL DEFAULT 'A',
  KEY idx_nhp_part (part_no),
  KEY idx_nhp_date (part_no, effective_date)
) ENGINE=InnoDB;

-- Hardware placement: left/right side (nags_hw_plmt.txt)
CREATE TABLE IF NOT EXISTS nags_hw_plmt (
  part_no     VARCHAR(20)  NOT NULL,
  opening_num INT          NOT NULL DEFAULT 0,
  col3        VARCHAR(10)  NOT NULL DEFAULT '',
  col4        VARCHAR(10)  NOT NULL DEFAULT '',
  side        CHAR(1)      NOT NULL DEFAULT '',
  KEY idx_nhpl_part (part_no)
) ENGINE=InnoDB;

-- Hardware configuration per vehicle (nags_hw_cfg_det.txt)
CREATE TABLE IF NOT EXISTS nags_hw_cfg_det (
  veh_id   INT           NOT NULL,
  part_no  VARCHAR(20)   NOT NULL,
  flag1    INT           NOT NULL DEFAULT 0,
  quantity DECIMAL(6,2)  NOT NULL DEFAULT 1.00,
  flag2    INT           NOT NULL DEFAULT 0,
  col6     VARCHAR(20)   NOT NULL DEFAULT '',
  col7     VARCHAR(20)   NOT NULL DEFAULT '',
  col8     VARCHAR(20)   NOT NULL DEFAULT '',
  KEY idx_nhcd_veh  (veh_id),
  KEY idx_nhcd_part (part_no)
) ENGINE=InnoDB;

-- Hardware config qualifiers (nags_hw_cfg_det_qual.txt)
CREATE TABLE IF NOT EXISTS nags_hw_cfg_det_qual (
  veh_id  INT  NOT NULL,
  part_no VARCHAR(20) NOT NULL,
  flag1   INT  NOT NULL DEFAULT 0,
  flag2   INT  NOT NULL DEFAULT 0,
  qual_id INT  NOT NULL DEFAULT 0,
  KEY idx_nhcdq_veh (veh_id, part_no)
) ENGINE=InnoDB;

-- ─────────────────────────────────────────────────────────────
--  MANUFACTURER HARDWARE  (OEM parts)
-- ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS mf_hw (
  mf_code    VARCHAR(10)  NOT NULL DEFAULT '',
  mf_part_no VARCHAR(30)  NOT NULL DEFAULT '',
  flag       VARCHAR(5)   NOT NULL DEFAULT '',
  KEY idx_mfhw (mf_code, mf_part_no)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS mf_hw_prc (
  mf_code        VARCHAR(10)    NOT NULL DEFAULT '',
  mf_part_no     VARCHAR(30)    NOT NULL DEFAULT '',
  unit           VARCHAR(5)     NOT NULL DEFAULT '',
  effective_date DATE           NOT NULL,
  list_price     DECIMAL(12,2)  NOT NULL DEFAULT 0.00,
  active         CHAR(1)        NOT NULL DEFAULT 'A',
  KEY idx_mfhwp (mf_code, mf_part_no, effective_date)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS mf_hw_region (
  mf_code        VARCHAR(10)    NOT NULL DEFAULT '',
  mf_part_no     VARCHAR(30)    NOT NULL DEFAULT '',
  unit           VARCHAR(5)     NOT NULL DEFAULT '',
  effective_date DATE           NOT NULL,
  list_price     DECIMAL(12,2)  NOT NULL DEFAULT 0.00,
  active         CHAR(1)        NOT NULL DEFAULT 'A',
  col7           VARCHAR(20)    NOT NULL DEFAULT '',
  col8           VARCHAR(20)    NOT NULL DEFAULT '',
  KEY idx_mfhwr (mf_code, mf_part_no)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS nags_mf_hw_xref (
  mf_code      VARCHAR(10)  NOT NULL DEFAULT '',
  mf_part_no   VARCHAR(30)  NOT NULL DEFAULT '',
  nags_part_no VARCHAR(20)  NOT NULL DEFAULT '',
  KEY idx_xref_mf   (mf_code, mf_part_no),
  KEY idx_xref_nags (nags_part_no)
) ENGINE=InnoDB;

-- ─────────────────────────────────────────────────────────────
--  BUSINESS TABLES  (app-specific, not from NAGS)
-- ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS customers (
  id         INT            NOT NULL AUTO_INCREMENT,
  name       VARCHAR(100)   NOT NULL,
  company    VARCHAR(100)   NOT NULL DEFAULT '',
  route      VARCHAR(50)    NOT NULL DEFAULT '',
  phone      VARCHAR(20)    NOT NULL DEFAULT '',
  address    VARCHAR(200)   NOT NULL DEFAULT '',
  created_at TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS business_types (
  id   INT           NOT NULL AUTO_INCREMENT,
  name VARCHAR(100)  NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_bt_name (name)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS discounts (
  id            INT            NOT NULL AUTO_INCREMENT,
  code          VARCHAR(20)    NOT NULL,
  name          VARCHAR(100)   NOT NULL,
  edi           TINYINT(1)     NOT NULL DEFAULT 0,
  edi_format    VARCHAR(80)    NOT NULL DEFAULT '',
  kit_charge    TINYINT(1)     NOT NULL DEFAULT 0,
  kit_amt       DECIMAL(10,2)  NOT NULL DEFAULT 0.00,
  two_kit_amt   DECIMAL(10,2)  NOT NULL DEFAULT 0.00,
  high_mod_amt  DECIMAL(10,2)  NOT NULL DEFAULT 0.00,
  high_mod_nc15 DECIMAL(10,2)  NOT NULL DEFAULT 0.00,
  high_mod_nc20 DECIMAL(10,2)  NOT NULL DEFAULT 0.00,
  PRIMARY KEY (id),
  UNIQUE KEY uq_discount_code (code)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS discount_details (
  id             INT            NOT NULL AUTO_INCREMENT,
  discount_id    INT            NOT NULL,
  nags_prefix    VARCHAR(10)    NOT NULL DEFAULT '',
  part_type      VARCHAR(30)    NOT NULL,
  flat_or_hourly ENUM('Flat','Hourly') NOT NULL DEFAULT 'Flat',
  discount_pct   DECIMAL(5,2)   NOT NULL DEFAULT 0.00,
  labor          DECIMAL(10,2)  NOT NULL DEFAULT 0.00,
  min_hours      DECIMAL(5,2)   NOT NULL DEFAULT 0.00,
  max_hours      DECIMAL(5,2)   NOT NULL DEFAULT 0.00,
  PRIMARY KEY (id),
  CONSTRAINT fk_dd_discount FOREIGN KEY (discount_id)
    REFERENCES discounts(id) ON DELETE CASCADE
) ENGINE=InnoDB;
