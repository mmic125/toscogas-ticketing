-- Aggiunge il ruolo "amministratore", la tracciatura della data di
-- cambio password e la tabella di configurazione della policy password.
-- Da eseguire manualmente sui database già inizializzati
-- (init.sql viene applicato da Postgres solo alla prima creazione del volume dati).

ALTER TYPE ruolo_utente ADD VALUE IF NOT EXISTS 'amministratore';

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS password_changed_at TIMESTAMPTZ;

UPDATE users
  SET password_changed_at = COALESCE(password_changed_at, created_at)
  WHERE password_changed_at IS NULL;

CREATE TABLE IF NOT EXISTS password_policy (
  id                     INT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  min_length             INT NOT NULL DEFAULT 12,
  require_uppercase      BOOLEAN NOT NULL DEFAULT true,
  min_uppercase          INT NOT NULL DEFAULT 1,
  require_special        BOOLEAN NOT NULL DEFAULT false,
  min_special            INT NOT NULL DEFAULT 1,
  require_digit          BOOLEAN NOT NULL DEFAULT true,
  min_digit              INT NOT NULL DEFAULT 1,
  avoid_ambiguous_common BOOLEAN NOT NULL DEFAULT true,
  validity_days          INT,
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO password_policy (id) VALUES (1)
  ON CONFLICT (id) DO NOTHING;
