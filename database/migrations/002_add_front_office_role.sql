-- Aggiunge il ruolo "front_office" all'enum ruolo_utente.
-- Da eseguire manualmente sui database già inizializzati
-- (init.sql viene applicato da Postgres solo alla prima creazione del volume dati).

ALTER TYPE ruolo_utente ADD VALUE IF NOT EXISTS 'front_office';
