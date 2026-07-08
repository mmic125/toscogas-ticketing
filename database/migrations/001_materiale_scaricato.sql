-- Aggiunge il flag "materiale scaricato" ai ticket.
-- Da eseguire manualmente sui database già inizializzati
-- (init.sql viene applicato da Postgres solo alla prima creazione del volume dati).

ALTER TABLE tickets
  ADD COLUMN IF NOT EXISTS materiale_scaricato BOOLEAN NOT NULL DEFAULT false;
