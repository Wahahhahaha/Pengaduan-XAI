from sqlalchemy import text
import hashlib
import secrets


def hash_password(password: str) -> str:
    salt = secrets.token_bytes(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode(), salt, 310_000)
    return f"pbkdf2_sha256$310000${salt.hex()}${digest.hex()}"


def verify_password(password: str, stored: str | None) -> bool:
    if not stored:
        return False
    try:
        algorithm, rounds, salt, digest = stored.split("$")
        if algorithm != "pbkdf2_sha256":
            return False
        actual = hashlib.pbkdf2_hmac("sha256", password.encode(), bytes.fromhex(salt), int(rounds))
        return secrets.compare_digest(actual, bytes.fromhex(digest))
    except (ValueError, TypeError):
        return False

PERMISSION_CODES = (
    "dashboard.view", "complaints.view", "complaints.create", "complaints.verify",
    "complaints.assign", "complaints.priority.override", "complaints.update",
    "ai_predictions.view", "ai_explanations.view", "ai_models.manage",
    "reports.view", "notifications.view", "users.view", "users.create",
    "users.update", "categories.view", "categories.manage", "settings.view", "settings.manage",
    "activity_logs.view", "roles.view", "roles.manage", "permissions.view",
    "permissions.manage", "backup.view", "backup.manage", "recycle_bin.view",
    "recycle_bin.restore", "recycle_bin.delete",
)

PERMISSION_GROUPS = {
    "Dashboard": ("dashboard.view",),
    "Complaints": ("complaints.view", "complaints.create", "complaints.verify", "complaints.assign", "complaints.priority.override", "complaints.update"),
    "AI Analysis": ("ai_predictions.view", "ai_explanations.view", "ai_models.manage"),
    "Reports & Statistics": ("reports.view",),
    "Notifications": ("notifications.view",),
    "User Management": ("users.view", "users.create", "users.update"),
    "Category Management": ("categories.view", "categories.manage"),
    "System Settings": ("settings.view", "settings.manage"),
    "Activity Log": ("activity_logs.view",),
    "Roles": ("roles.view", "roles.manage"),
    "Permissions": ("permissions.view", "permissions.manage"),
    "Database Backup": ("backup.view", "backup.manage"),
    "Recycle Bin": ("recycle_bin.view", "recycle_bin.restore", "recycle_bin.delete"),
}

ROLE_DEFAULTS = {
    "superadmin": set(PERMISSION_CODES),
    "admin": {
        "dashboard.view", "complaints.view", "complaints.create", "complaints.verify",
        "complaints.assign", "complaints.priority.override", "complaints.update",
        "ai_predictions.view", "ai_explanations.view", "reports.view",
        "notifications.view", "users.view", "users.create", "users.update",
        "categories.view", "categories.manage", "settings.view", "settings.manage",
        "activity_logs.view", "backup.view", "recycle_bin.view",
        "recycle_bin.restore", "recycle_bin.delete",
    },
    "petugas": {
        "dashboard.view", "complaints.view", "complaints.create",
        "complaints.update", "ai_predictions.view", "ai_explanations.view",
        "notifications.view",
    },
    "citizen": {"complaints.view", "complaints.create"},
}

SEED_USERS = (
    ("Ahmad Santoso", "superadmin@local.test", "superadmin"),
    ("Nadia Putri", "admin@local.test", "admin"),
    ("Budi Pratama", "petugas@local.test", "petugas"),
    ("Demo Citizen", "warga@local.test", "citizen"),
    ("Siti Rahma", "siti.rahma@email.test", "citizen"),
)


def initialize_access_control(connection):
    legacy_exists = connection.execute(text("""
        SELECT EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_name = 'role_permissions' AND column_name = 'permissions'
        )
    """)).scalar_one()
    if legacy_exists:
        connection.execute(text("ALTER TABLE role_permissions RENAME TO role_permissions_legacy"))

    connection.execute(text("""
        CREATE TABLE IF NOT EXISTS roles (
            id BIGSERIAL PRIMARY KEY,
            key VARCHAR(80) NOT NULL UNIQUE,
            name VARCHAR(120) NOT NULL,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
    """))
    connection.execute(text("""
        CREATE TABLE IF NOT EXISTS permissions (
            id BIGSERIAL PRIMARY KEY,
            code VARCHAR(120) NOT NULL UNIQUE,
            name VARCHAR(160) NOT NULL DEFAULT '',
            group_name VARCHAR(120) NOT NULL DEFAULT 'Other',
            description TEXT NOT NULL DEFAULT '',
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
    """))
    connection.execute(text("ALTER TABLE permissions ADD COLUMN IF NOT EXISTS name VARCHAR(160) NOT NULL DEFAULT ''"))
    connection.execute(text("ALTER TABLE permissions ADD COLUMN IF NOT EXISTS group_name VARCHAR(120) NOT NULL DEFAULT 'Other'"))
    connection.execute(text("ALTER TABLE permissions ADD COLUMN IF NOT EXISTS description TEXT NOT NULL DEFAULT ''"))
    connection.execute(text("""
        CREATE TABLE IF NOT EXISTS users (
            id BIGSERIAL PRIMARY KEY,
            name VARCHAR(160) NOT NULL,
            email VARCHAR(200) NOT NULL UNIQUE,
            role_id BIGINT NOT NULL REFERENCES roles(id),
            active BOOLEAN NOT NULL DEFAULT TRUE,
            phone VARCHAR(80) NOT NULL DEFAULT '',
            password_hash TEXT,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
    """))
    connection.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS phone VARCHAR(80) NOT NULL DEFAULT ''"))
    connection.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash TEXT"))
    connection.execute(text("""
        CREATE TABLE IF NOT EXISTS role_permissions (
            role_id BIGINT NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
            permission_id BIGINT NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
            active BOOLEAN NOT NULL DEFAULT FALSE,
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            PRIMARY KEY (role_id, permission_id)
        )
    """))

    labels = {"superadmin": "Superadmin", "admin": "Admin", "petugas": "Officer", "citizen": "Citizen"}
    for key, name in labels.items():
        connection.execute(text("INSERT INTO roles (key, name) VALUES (:key, :name) ON CONFLICT (key) DO NOTHING"), {"key": key, "name": name})
    for group, codes in PERMISSION_GROUPS.items():
        for code in codes:
            connection.execute(text("""
                INSERT INTO permissions (code, name, group_name)
                VALUES (:code, :name, :group_name)
                ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name,
                    group_name = EXCLUDED.group_name
            """), {"code": code, "name": code.replace("_", " ").replace(".", " ").title(), "group_name": group})
    connection.execute(text("DELETE FROM permissions WHERE code IN ('departments.view', 'departments.manage')"))
    for key, active_codes in ROLE_DEFAULTS.items():
        for code in PERMISSION_CODES:
            connection.execute(text("""
                INSERT INTO role_permissions (role_id, permission_id, active)
                SELECT r.id, p.id, :active FROM roles r CROSS JOIN permissions p
                WHERE r.key = :role AND p.code = :code
                ON CONFLICT (role_id, permission_id) DO NOTHING
            """), {"role": key, "code": code, "active": code in active_codes})
    if legacy_exists:
        legacy_rows = connection.execute(text("SELECT role, permissions FROM role_permissions_legacy")).mappings().all()
        for row in legacy_rows:
            key = row["role"]
            if key == "superadmin":
                continue
            connection.execute(text("INSERT INTO roles (key, name) VALUES (:key, :name) ON CONFLICT (key) DO NOTHING"), {"key": key, "name": labels.get(key, key.replace('_', ' ').title())})
            codes = set(row["permissions"] if isinstance(row["permissions"], list) else [])
            for code in codes - set(PERMISSION_CODES):
                connection.execute(text("INSERT INTO permissions (code) VALUES (:code) ON CONFLICT (code) DO NOTHING"), {"code": code})
            connection.execute(text("""
                INSERT INTO role_permissions (role_id, permission_id, active)
                SELECT r.id, p.id, p.code = ANY(:codes) FROM roles r CROSS JOIN permissions p
                WHERE r.key = :role
                ON CONFLICT (role_id, permission_id) DO UPDATE
                SET active = EXCLUDED.active, updated_at = NOW()
            """), {"role": key, "codes": list(codes)})
        connection.execute(text("DROP TABLE role_permissions_legacy"))
    for name, email, role in SEED_USERS:
        connection.execute(text("""
            INSERT INTO users (name, email, role_id)
            SELECT :name, :email, id FROM roles WHERE key = :role
            ON CONFLICT (email) DO NOTHING
        """), {"name": name, "email": email, "role": role})
        connection.execute(text("UPDATE users SET password_hash = :password_hash WHERE email = :email AND password_hash IS NULL"), {"email": email, "password_hash": hash_password("development-password")})
