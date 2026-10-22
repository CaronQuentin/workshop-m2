-- Initialisation de la base (données fictives uniquement).
-- Les tables sont créées par les services au démarrage (SQLAlchemy create_all).
-- Ce script ne fait que fixer quelques réglages et laisse une trace de version.
SET timezone = 'UTC';
DO $$ BEGIN
  RAISE NOTICE 'RESILIENCE-ALPHA : base % initialisée', current_database();
END $$;
