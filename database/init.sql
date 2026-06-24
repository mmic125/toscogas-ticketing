-- ═══════════════════════════════════════════════════════════
-- Toscogas Ticketing — Schema PostgreSQL 16
-- NIS2 compliant: audit log, role-based access, data integrity
-- ═══════════════════════════════════════════════════════════

-- Abilita UUID
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ── Tipi enum ────────────────────────────────────────────────
CREATE TYPE ruolo_utente AS ENUM (
  'coordinatore', 'segnalatore', 'manutentore', 'segnalatore_manutentore'
);

CREATE TYPE stato_ticket AS ENUM (
  'nuovo', 'assegnato', 'in_lavorazione', 'risolto', 'chiuso'
);

CREATE TYPE priorita_ticket AS ENUM (
  'urgente', 'alta', 'media', 'bassa'
);

CREATE TYPE categoria_ticket AS ENUM (
  'commerciale', 'tecnico'
);

-- ── Tabella users (auth interna — sostituisce Supabase Auth) ─
CREATE TABLE users (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email           TEXT UNIQUE NOT NULL,
  password_hash   TEXT NOT NULL,             -- Argon2id
  totp_secret     TEXT,                      -- base32 secret cifrato
  totp_enabled    BOOLEAN NOT NULL DEFAULT false,
  last_login      TIMESTAMPTZ,
  failed_attempts INTEGER NOT NULL DEFAULT 0,
  locked_until    TIMESTAMPTZ,
  must_change_pwd BOOLEAN NOT NULL DEFAULT false,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Refresh tokens ───────────────────────────────────────────
CREATE TABLE refresh_tokens (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT UNIQUE NOT NULL,          -- SHA-256 del token
  expires_at TIMESTAMPTZ NOT NULL,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_refresh_tokens_user ON refresh_tokens(user_id);
CREATE INDEX idx_refresh_tokens_expires ON refresh_tokens(expires_at);

-- ── Profili utente ───────────────────────────────────────────
CREATE TABLE profiles (
  id         UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  email      TEXT NOT NULL,
  nome       TEXT NOT NULL,
  cognome    TEXT NOT NULL,
  ruolo      ruolo_utente NOT NULL,
  attivo     BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_profiles_ruolo ON profiles(ruolo);
CREATE INDEX idx_profiles_attivo ON profiles(attivo);

-- ── Tickets ──────────────────────────────────────────────────
CREATE TABLE tickets (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  codice_cliente            TEXT,
  nome_cliente              TEXT NOT NULL,
  matricola_serbatoio       TEXT,
  tipo_problema             TEXT,
  note_apertura             TEXT,
  note_intervento           TEXT,
  materiale_utilizzato      TEXT,
  priorita                  priorita_ticket NOT NULL,
  categoria                 categoria_ticket,
  provincia                 TEXT,
  telefono                  TEXT,
  stato                     stato_ticket NOT NULL DEFAULT 'nuovo',
  segnalatore_id            UUID REFERENCES profiles(id),
  manutentore_id            UUID REFERENCES profiles(id),
  data_apertura             DATE NOT NULL DEFAULT CURRENT_DATE,
  data_intervento_richiesta DATE,
  data_intervento           DATE,
  created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_tickets_stato ON tickets(stato);
CREATE INDEX idx_tickets_manutentore ON tickets(manutentore_id);
CREATE INDEX idx_tickets_segnalatore ON tickets(segnalatore_id);
CREATE INDEX idx_tickets_created_at ON tickets(created_at DESC);
CREATE INDEX idx_tickets_data_apertura ON tickets(data_apertura);

-- ── Allegati ticket ──────────────────────────────────────────
CREATE TABLE ticket_foto (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id    UUID NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  storage_path TEXT NOT NULL,
  ordine       INTEGER NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_ticket_foto_ticket ON ticket_foto(ticket_id);

-- ── Audit log (NIS2: tracciabilità operazioni) ───────────────
CREATE TABLE audit_log (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID REFERENCES users(id) ON DELETE SET NULL,
  action      TEXT NOT NULL,
  resource    TEXT,
  resource_id UUID,
  details     JSONB,
  ip_address  INET,
  user_agent  TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_audit_log_user ON audit_log(user_id);
CREATE INDEX idx_audit_log_created ON audit_log(created_at DESC);
CREATE INDEX idx_audit_log_action ON audit_log(action);

-- ── Trigger: updated_at automatico ──────────────────────────
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_tickets_updated_at
  BEFORE UPDATE ON tickets
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ── Pulizia automatica token scaduti (schedulabile via pg_cron) ──
CREATE OR REPLACE FUNCTION cleanup_expired_tokens() RETURNS void AS $$
BEGIN
  DELETE FROM refresh_tokens WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql;

-- ── Politica password: blocco account dopo 5 tentativi ──────
-- (gestita nell'applicazione, la colonna locked_until è il lock)

-- ── Commenti sulle colonne sensibili ─────────────────────────
COMMENT ON COLUMN users.password_hash IS 'Argon2id hash — non invertibile';
COMMENT ON COLUMN users.totp_secret IS 'Segreto TOTP cifrato con AES-256-GCM';
COMMENT ON COLUMN refresh_tokens.token_hash IS 'SHA-256 del token raw — il token raw non è mai salvato';
COMMENT ON TABLE audit_log IS 'Registro immutabile per conformità NIS2 — conservare minimo 12 mesi';
