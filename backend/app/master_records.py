from sqlalchemy import text


def initialize_master_records(connection):
    connection.execute(text("""
        CREATE TABLE IF NOT EXISTS categories (
            id BIGSERIAL PRIMARY KEY,
            name VARCHAR(160) NOT NULL UNIQUE,
            description TEXT NOT NULL DEFAULT '',
            deleted_at TIMESTAMPTZ,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
    """))
    connection.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ"))
    connection.execute(text("UPDATE users SET deleted_at = NOW() WHERE active = FALSE AND deleted_at IS NULL"))
    connection.execute(text("""
        INSERT INTO categories (name)
        SELECT DISTINCT category FROM complaints WHERE TRIM(category) <> ''
        ON CONFLICT (name) DO NOTHING
    """))


MASTER_TABLES = {"categories": "categories"}
