import os
import json
import subprocess
import uuid
import urllib.request
from pathlib import Path
from datetime import datetime, timezone
from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import FileResponse, JSONResponse
from pydantic import BaseModel
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import create_engine, text
from .access_control import hash_password, initialize_access_control, verify_password
from .master_records import MASTER_TABLES, initialize_master_records

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql+psycopg://root@db:5432/complaint_db")
engine = create_engine(DATABASE_URL, pool_pre_ping=True)
BACKUP_DIR = Path(os.getenv("BACKUP_DIR", "/app/uploads/backups"))
app = FastAPI(title="LaporKita API", version="0.1.0", docs_url="/api/docs", openapi_url="/api/openapi.json")
app.add_middleware(CORSMiddleware, allow_origins=["http://localhost:8080"], allow_credentials=True, allow_methods=["*"], allow_headers=["*"])

@app.exception_handler(Exception)
async def handle_unexpected_error(request: Request, exc: Exception):
    return JSONResponse(status_code=500, content={"detail": "Internal Server Error"})

class SettingsPayload(BaseModel):
    website_name: str
    logo: str = ""
    favicon: str = ""
    contact_email: str = ""
    phone: str = ""
    address: str = ""

class ComplaintPayload(BaseModel):
    title: str
    category: str
    description: str
    citizen_name: str = "Masyarakat"
    citizen_email: str = ""
    image_data: str = ""

class AIAnalysisPayload(BaseModel):
    complaint_id: str | None = None
    title: str
    category: str = "Lainnya"
    description: str = ""

class ComplaintWorkflowPayload(BaseModel):
    status: str
    final_priority: str
    note: str = ""
    actor: str = "Petugas"
    evidence_image_data: str = ""

class ActivityPayload(BaseModel):
    actor: str = "Guest"
    action: str
    latitude: float | None = None
    longitude: float | None = None

class RolePermissionsPayload(BaseModel):
    permissions: list[str]

class RolePayload(BaseModel):
    name: str
    key: str

class RoleNamePayload(BaseModel):
    name: str

class UserPayload(BaseModel):
    name: str
    email: str
    role: str
    phone: str | None = None
    password: str | None = None

class RegistrationPayload(BaseModel):
    name: str
    email: str
    password: str

class LoginPayload(BaseModel):
    email: str
    password: str

class PasswordPayload(BaseModel):
    current_password: str
    new_password: str

class ResetPasswordPayload(BaseModel):
    manager_email: str
    manager_password: str
    new_password: str

class MasterPayload(BaseModel):
    name: str
    description: str = ""
    status: str = "Active"

@app.on_event("startup")
def initialize_database():
    with engine.begin() as connection:
        connection.execute(text("CREATE TABLE IF NOT EXISTS activity_logs (id BIGSERIAL PRIMARY KEY, actor VARCHAR(200) NOT NULL, action TEXT NOT NULL, ip_address VARCHAR(80) NOT NULL, latitude DOUBLE PRECISION, longitude DOUBLE PRECISION, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW())"))
        connection.execute(text("CREATE TABLE IF NOT EXISTS system_settings (key VARCHAR(120) PRIMARY KEY, value TEXT NOT NULL, updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW())"))
        initialize_access_control(connection)
        connection.execute(text("""
            CREATE TABLE IF NOT EXISTS complaints (
                id VARCHAR(80) PRIMARY KEY,
                title TEXT NOT NULL,
                category VARCHAR(120) NOT NULL DEFAULT 'Lainnya',
                citizen_name VARCHAR(160) NOT NULL DEFAULT 'Anonim',
                status VARCHAR(80) NOT NULL DEFAULT 'Menunggu Verifikasi',
                priority VARCHAR(40) NOT NULL DEFAULT 'Sedang',
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )
        """))
        connection.execute(text("ALTER TABLE complaints ADD COLUMN IF NOT EXISTS description TEXT NOT NULL DEFAULT ''"))
        connection.execute(text("ALTER TABLE complaints ADD COLUMN IF NOT EXISTS citizen_email VARCHAR(200) NOT NULL DEFAULT ''"))
        connection.execute(text("ALTER TABLE complaints ADD COLUMN IF NOT EXISTS image_data TEXT NOT NULL DEFAULT ''"))
        connection.execute(text("ALTER TABLE complaints ADD COLUMN IF NOT EXISTS resolution_image_data TEXT NOT NULL DEFAULT ''"))
        connection.execute(text("ALTER TABLE complaints DROP COLUMN IF EXISTS assignee"))
        connection.execute(text("ALTER TABLE complaints ADD COLUMN IF NOT EXISTS ai_priority VARCHAR(40)"))
        connection.execute(text("ALTER TABLE complaints ADD COLUMN IF NOT EXISTS ai_summary TEXT NOT NULL DEFAULT ''"))
        connection.execute(text("ALTER TABLE complaints ADD COLUMN IF NOT EXISTS ai_factors JSONB NOT NULL DEFAULT '[]'::jsonb"))
        connection.execute(text("ALTER TABLE complaints ADD COLUMN IF NOT EXISTS final_priority VARCHAR(40)"))
        connection.execute(text("ALTER TABLE complaints ADD COLUMN IF NOT EXISTS verification_note TEXT NOT NULL DEFAULT ''"))
        connection.execute(text("ALTER TABLE complaints ADD COLUMN IF NOT EXISTS verified_by VARCHAR(160)"))
        connection.execute(text("ALTER TABLE complaints ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ"))
        connection.execute(text("ALTER TABLE complaints ADD COLUMN IF NOT EXISTS assigned_at TIMESTAMPTZ"))
        connection.execute(text("UPDATE complaints SET ai_priority = priority, final_priority = priority WHERE ai_priority IS NULL OR final_priority IS NULL"))
        connection.execute(text("""
            CREATE TABLE IF NOT EXISTS complaint_events (
                id BIGSERIAL PRIMARY KEY,
                complaint_id VARCHAR(80) NOT NULL REFERENCES complaints(id) ON DELETE CASCADE,
                event_type VARCHAR(60) NOT NULL,
                status VARCHAR(80) NOT NULL,
                priority VARCHAR(40) NOT NULL,
                note TEXT NOT NULL DEFAULT '',
                actor VARCHAR(160) NOT NULL DEFAULT 'Petugas',
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )
        """))
        connection.execute(text("ALTER TABLE complaint_events DROP COLUMN IF EXISTS assignee"))
        connection.execute(text("""
            CREATE TABLE IF NOT EXISTS notifications (
                id SERIAL PRIMARY KEY,
                title VARCHAR(200) NOT NULL,
                message TEXT NOT NULL,
                kind VARCHAR(40) NOT NULL DEFAULT 'info',
                is_read BOOLEAN NOT NULL DEFAULT FALSE,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )
        """))
        connection.execute(text("""
            INSERT INTO complaints
                (id, title, category, citizen_name, status, priority, created_at, updated_at)
            VALUES
                ('PGR-DEMO-00001', 'Lampu penerangan jalan mati di Jalan Melati', 'Infrastruktur', 'Dimas Pratama', 'Dalam Penanganan', 'Tinggi', NOW() - interval '2 days', NOW() - interval '1 hour'),
                ('PGR-DEMO-00002', 'Sampah menumpuk di area Pasar Baru', 'Kebersihan', 'Siti Rahma', 'Menunggu Verifikasi', 'Mendesak', NOW() - interval '3 days', NOW() - interval '2 hours'),
                ('PGR-DEMO-00003', 'Permohonan perbaikan jalan berlubang', 'Infrastruktur', 'Rizky Maulana', 'Ditugaskan', 'Sedang', NOW() - interval '9 days', NOW() - interval '1 day'),
                ('PGR-DEMO-00004', 'Pelayanan administrasi kependudukan lambat', 'Administrasi', 'Anita Wijaya', 'Diverifikasi', 'Sedang', NOW() - interval '14 days', NOW() - interval '3 days'),
                ('PGR-DEMO-00005', 'Drainase tersumbat setelah hujan deras', 'Lingkungan', 'Budi Santoso', 'Selesai', 'Rendah', NOW() - interval '18 days', NOW() - interval '2 days')
                ,('PGR-DEMO-00006', 'Lampu jalan di lingkungan rumah sering padam', 'Infrastruktur', 'Masyarakat', 'Menunggu Verifikasi', 'Sedang', NOW() - interval '1 day', NOW() - interval '1 day')
            ON CONFLICT (id) DO NOTHING
        """))
        connection.execute(text("UPDATE complaints SET citizen_email = 'warga@local.test' WHERE citizen_email = '' AND citizen_name = 'Masyarakat'"))
        initialize_master_records(connection)
        connection.execute(text("INSERT INTO system_settings (key, value) VALUES ('website_name', 'LaporKita'), ('website_tagline', 'Suara Anda, Perubahan Kita'), ('contact_email', 'halo@laporkita.local'), ('phone', '021-555-0123'), ('address', 'Jl. Pelayanan Publik No. 1'), ('logo', ''), ('favicon', '') ON CONFLICT (key) DO NOTHING"))
        connection.execute(text("""
            INSERT INTO notifications (title, message, kind, is_read, created_at)
            SELECT title, message, kind, is_read, created_at
            FROM (VALUES
                ('New complaint received', 'A complaint is waiting for verification.', 'complaint', FALSE, NOW() - interval '5 minutes'),
                ('AI analysis completed', 'New explainable recommendations are ready.', 'ai', FALSE, NOW() - interval '18 minutes'),
                ('Backup completed', 'The latest database backup is available.', 'backup', TRUE, NOW() - interval '1 hour')
            ) AS seed(title, message, kind, is_read, created_at)
            WHERE NOT EXISTS (SELECT 1 FROM notifications)
        """))

@app.get("/api/health")
def health():
    with engine.connect() as connection:
        connection.execute(text("SELECT 1"))
    return {"status": "ok", "service": "backend", "timestamp": datetime.now(timezone.utc).isoformat()}

@app.get("/api/role-permissions")
def list_role_permissions():
    with engine.connect() as connection:
        rows = connection.execute(text("""
            SELECT r.key AS role, p.code FROM roles r
            LEFT JOIN role_permissions rp ON rp.role_id = r.id AND rp.active = TRUE
            LEFT JOIN permissions p ON p.id = rp.permission_id
            ORDER BY r.id, p.code
        """)).mappings().all()
    result = {}
    for row in rows:
        result.setdefault(row["role"], [])
        if row["code"]:
            result[row["role"]].append(row["code"])
    return result

@app.get("/api/roles")
def list_roles():
    with engine.connect() as connection:
        rows = connection.execute(text("SELECT id, key, name FROM roles ORDER BY id")).mappings().all()
    return {"items": [dict(row) for row in rows]}

@app.get("/api/permissions")
def list_permissions():
    with engine.connect() as connection:
        rows = connection.execute(text("SELECT id, code, name, group_name, description FROM permissions ORDER BY id")).mappings().all()
    return {"items": [dict(row) for row in rows]}

@app.post("/api/roles")
def create_role(payload: RolePayload):
    key = payload.key.strip().lower()
    name = payload.name.strip()
    if not name or not key or len(key) > 80 or not key.replace("_", "").isalnum():
        raise HTTPException(status_code=400, detail="Invalid role")
    with engine.begin() as connection:
        exists = connection.execute(text("SELECT 1 FROM roles WHERE key = :key OR LOWER(name) = LOWER(:name)"), {"key": key, "name": name}).first()
        if exists:
            raise HTTPException(status_code=409, detail="Role already exists")
        row = connection.execute(text("INSERT INTO roles (key, name) VALUES (:key, :name) RETURNING id, key, name"), {"key": key, "name": name}).mappings().one()
        connection.execute(text("""
            INSERT INTO role_permissions (role_id, permission_id, active)
            SELECT :role_id, id, FALSE FROM permissions
        """), {"role_id": row["id"]})
    return dict(row)

@app.patch("/api/roles/{role_key}")
def rename_role(role_key: str, payload: RoleNamePayload):
    name = payload.name.strip()
    if not name or len(name) > 120:
        raise HTTPException(status_code=400, detail="Role name is required")
    if role_key == "superadmin":
        raise HTTPException(status_code=403, detail="Superadmin role cannot be changed")
    with engine.begin() as connection:
        if connection.execute(text("SELECT 1 FROM roles WHERE LOWER(name) = LOWER(:name) AND key <> :key"), {"name": name, "key": role_key}).first():
            raise HTTPException(status_code=409, detail="Role name already exists")
        row = connection.execute(text("UPDATE roles SET name = :name WHERE key = :key RETURNING id, key, name"), {"name": name, "key": role_key}).mappings().first()
    if row is None:
        raise HTTPException(status_code=404, detail="Role not found")
    return dict(row)

@app.delete("/api/roles/{role_key}")
def delete_role(role_key: str):
    if role_key in ("superadmin", "admin", "petugas", "citizen"):
        raise HTTPException(status_code=403, detail="System roles cannot be deleted")
    with engine.begin() as connection:
        role_id = connection.execute(text("SELECT id FROM roles WHERE key = :key"), {"key": role_key}).scalar_one_or_none()
        if role_id is None:
            raise HTTPException(status_code=404, detail="Role not found")
        assigned = connection.execute(text("SELECT COUNT(*) FROM users WHERE role_id = :role_id"), {"role_id": role_id}).scalar_one()
        if assigned:
            raise HTTPException(status_code=409, detail=f"Role is assigned to {assigned} user(s). Reassign them first.")
        connection.execute(text("DELETE FROM roles WHERE id = :id"), {"id": role_id})
    return {"ok": True}

@app.put("/api/role-permissions/{role}")
def update_role_permissions(role: str, payload: RolePermissionsPayload):
    if role == "superadmin" or not role.replace("_", "").isalnum() or len(role) > 80:
        raise HTTPException(status_code=400, detail="Invalid role")
    permissions = list(dict.fromkeys(payload.permissions))
    if len(permissions) > 100 or any(not isinstance(item, str) or len(item) > 120 for item in permissions):
        raise HTTPException(status_code=400, detail="Invalid permissions")
    with engine.begin() as connection:
        known = set(connection.execute(text("SELECT code FROM permissions")).scalars().all())
        if not set(permissions).issubset(known):
            raise HTTPException(status_code=400, detail="Unknown permission")
        role_id = connection.execute(text("SELECT id FROM roles WHERE key = :role"), {"role": role}).scalar_one_or_none()
        if role_id is None:
            raise HTTPException(status_code=404, detail="Role not found")
        connection.execute(text("""
            INSERT INTO role_permissions (role_id, permission_id, active, updated_at)
            SELECT :role_id, id, code = ANY(:codes), NOW() FROM permissions
            ON CONFLICT (role_id, permission_id) DO UPDATE
            SET active = EXCLUDED.active, updated_at = NOW()
        """), {"role_id": role_id, "codes": permissions})
    return {"role": role, "permissions": permissions}

@app.get("/api/users")
def list_users():
    with engine.connect() as connection:
        rows = connection.execute(text("""
            SELECT u.id, u.name, u.email, u.phone, u.active, u.deleted_at, r.id AS role_id,
                   r.key AS role_key, r.name AS role
            FROM users u JOIN roles r ON r.id = u.role_id ORDER BY u.id
        """)).mappings().all()
    return {"items": [dict(row) for row in rows]}

@app.post("/api/register")
def register_citizen(payload: RegistrationPayload):
    name = payload.name.strip()
    email = payload.email.strip().lower()
    if not name or not email or "@" not in email or len(payload.password) < 6:
        raise HTTPException(status_code=400, detail="Invalid registration")
    with engine.begin() as connection:
        if connection.execute(text("SELECT 1 FROM users WHERE LOWER(email) = :email"), {"email": email}).first():
            raise HTTPException(status_code=409, detail="Email is already registered")
        row = connection.execute(text("""
            INSERT INTO users (name, email, role_id, password_hash)
            SELECT :name, :email, id, :password_hash FROM roles WHERE key = 'citizen'
            RETURNING id, role_id
        """), {"name": name, "email": email, "password_hash": hash_password(payload.password)}).mappings().one()
    return {"id": row["id"], "role_id": row["role_id"], "role_key": "citizen", "email": email}

@app.post("/api/login")
def login(payload: LoginPayload):
    with engine.connect() as connection:
        row = connection.execute(text("""
            SELECT u.id, u.name, u.email, u.phone, u.password_hash,
                r.id AS role_id, r.key AS role_key, r.name AS role
            FROM users u JOIN roles r ON r.id = u.role_id
            WHERE LOWER(u.email) = LOWER(:email) AND u.active = TRUE AND u.deleted_at IS NULL
        """), {"email": payload.email.strip()}).mappings().first()
    if row is None or not verify_password(payload.password, row["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    return {key: value for key, value in row.items() if key != "password_hash"}

@app.get("/api/users/by-email/{email}")
def get_user_by_email(email: str):
    with engine.connect() as connection:
        row = connection.execute(text("""
            SELECT u.id, u.name, u.email, u.phone, u.active, u.deleted_at, r.id AS role_id,
                   r.key AS role_key, r.name AS role
            FROM users u JOIN roles r ON r.id = u.role_id
            WHERE LOWER(u.email) = LOWER(:email)
        """), {"email": email}).mappings().first()
    if row is None or not row["active"]:
        raise HTTPException(status_code=404, detail="User not found")
    return dict(row)

@app.put("/api/users/{email}")
def upsert_user(email: str, payload: UserPayload):
    if not payload.name.strip() or not payload.email.strip():
        raise HTTPException(status_code=400, detail="Invalid user")
    with engine.begin() as connection:
        role_id = connection.execute(text("SELECT id FROM roles WHERE key = :key OR name = :name"), {"key": payload.role.lower(), "name": payload.role}).scalar_one_or_none()
        if role_id is None:
            raise HTTPException(status_code=400, detail="Unknown role")
        existing = connection.execute(text("SELECT id FROM users WHERE LOWER(email) = LOWER(:email)"), {"email": email}).first()
        if existing is None and (not payload.password or len(payload.password) < 6):
            raise HTTPException(status_code=400, detail="New users need a password of at least 6 characters")
        if payload.password is not None and len(payload.password) < 6:
            raise HTTPException(status_code=400, detail="Password must be at least 6 characters")
        values = {"name": payload.name.strip(), "email": payload.email.strip().lower(), "role_id": role_id, "old_email": email.lower(), "phone": payload.phone, "password_hash": hash_password(payload.password) if payload.password else None}
        if email.lower() != payload.email.strip().lower():
            row = connection.execute(text("""
                UPDATE users SET name = :name, email = :email, role_id = :role_id,
                    phone = COALESCE(:phone, phone),
                    password_hash = COALESCE(:password_hash, password_hash),
                    active = TRUE, deleted_at = NULL WHERE LOWER(email) = :old_email RETURNING id
            """), values).first()
            if row is None:
                raise HTTPException(status_code=404, detail="User not found")
        else:
            row = connection.execute(text("""
                INSERT INTO users (name, email, role_id, phone, password_hash, active)
                VALUES (:name, :email, :role_id, COALESCE(:phone, ''), :password_hash, TRUE)
                ON CONFLICT (email) DO UPDATE SET name = EXCLUDED.name,
                    role_id = EXCLUDED.role_id, phone = COALESCE(:phone, users.phone),
                    password_hash = COALESCE(:password_hash, users.password_hash),
                    active = TRUE, deleted_at = NULL RETURNING id
            """), values).first()
    return {"id": row[0], "email": payload.email.strip().lower(), "role_id": role_id}

@app.post("/api/users/{email}/password")
def change_user_password(email: str, payload: PasswordPayload):
    if len(payload.new_password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters")
    with engine.begin() as connection:
        row = connection.execute(text("SELECT id, password_hash FROM users WHERE LOWER(email) = LOWER(:email) AND active = TRUE"), {"email": email}).mappings().first()
        if row is None or not verify_password(payload.current_password, row["password_hash"]):
            raise HTTPException(status_code=401, detail="Current password is incorrect")
        connection.execute(text("UPDATE users SET password_hash = :password_hash WHERE id = :id"), {"id": row["id"], "password_hash": hash_password(payload.new_password)})
    return {"ok": True}

@app.post("/api/users/{email}/reset-password")
def reset_user_password(email: str, payload: ResetPasswordPayload):
    if len(payload.new_password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters")
    with engine.begin() as connection:
        manager = connection.execute(text("""
            SELECT u.password_hash FROM users u JOIN roles r ON r.id = u.role_id
            WHERE LOWER(u.email) = LOWER(:email) AND u.active = TRUE
                AND r.key IN ('superadmin', 'admin')
        """), {"email": payload.manager_email}).mappings().first()
        if manager is None or not verify_password(payload.manager_password, manager["password_hash"]):
            raise HTTPException(status_code=403, detail="Manager password is incorrect")
        result = connection.execute(text("UPDATE users SET password_hash = :password_hash WHERE LOWER(email) = LOWER(:email)"), {"email": email, "password_hash": hash_password(payload.new_password)})
    if result.rowcount == 0:
        raise HTTPException(status_code=404, detail="User not found")
    return {"ok": True}

@app.delete("/api/users/{email}")
def deactivate_user(email: str):
    with engine.begin() as connection:
        result = connection.execute(text("UPDATE users SET active = FALSE, deleted_at = NOW() WHERE LOWER(email) = LOWER(:email)"), {"email": email})
    if result.rowcount == 0:
        raise HTTPException(status_code=404, detail="User not found")
    return {"ok": True}

@app.delete("/api/users/{email}/permanent")
def permanently_delete_user(email: str):
    with engine.begin() as connection:
        result = connection.execute(text("DELETE FROM users WHERE LOWER(email) = LOWER(:email) AND deleted_at IS NOT NULL"), {"email": email})
    if result.rowcount == 0:
        raise HTTPException(status_code=404, detail="Deleted user not found")
    return {"ok": True}

def master_table(kind: str):
    table = MASTER_TABLES.get(kind)
    if table is None:
        raise HTTPException(status_code=404, detail="Unknown master data type")
    return table

@app.get("/api/master-data/{kind}")
def list_master_data(kind: str):
    table = master_table(kind)
    with engine.connect() as connection:
        if kind == "categories":
            rows = connection.execute(text("""
                SELECT c.id, c.name, c.description,
                    (SELECT COUNT(*)::int FROM complaints WHERE category = c.name) AS complaint_count
                FROM categories c WHERE c.deleted_at IS NULL ORDER BY c.id
            """)).mappings().all()
    return {"items": [dict(row) for row in rows]}

@app.post("/api/master-data/{kind}")
def create_master_data(kind: str, payload: MasterPayload):
    table = master_table(kind)
    name = payload.name.strip()
    if not name:
        raise HTTPException(status_code=400, detail="Name is required")
    with engine.begin() as connection:
        if connection.execute(text(f"SELECT 1 FROM {table} WHERE LOWER(name) = LOWER(:name)"), {"name": name}).first():
            raise HTTPException(status_code=409, detail="Name already exists")
        if kind == "categories":
            row = connection.execute(text("INSERT INTO categories (name, description) VALUES (:name, :description) RETURNING id, name, description"), {"name": name, "description": payload.description.strip()}).mappings().one()
    return dict(row)

@app.put("/api/master-data/{kind}/{record_id}")
def update_master_data(kind: str, record_id: int, payload: MasterPayload):
    table = master_table(kind)
    name = payload.name.strip()
    if not name:
        raise HTTPException(status_code=400, detail="Name is required")
    with engine.begin() as connection:
        if kind == "categories":
            row = connection.execute(text("UPDATE categories SET name = :name, description = :description WHERE id = :id AND deleted_at IS NULL RETURNING id, name, description"), {"id": record_id, "name": name, "description": payload.description.strip()}).mappings().first()
    if row is None:
        raise HTTPException(status_code=404, detail="Master data not found")
    return dict(row)

@app.delete("/api/master-data/{kind}/{record_id}")
def delete_master_data(kind: str, record_id: int):
    table = master_table(kind)
    with engine.begin() as connection:
        result = connection.execute(text(f"UPDATE {table} SET deleted_at = NOW() WHERE id = :id AND deleted_at IS NULL"), {"id": record_id})
    if result.rowcount == 0:
        raise HTTPException(status_code=404, detail="Master data not found")
    return {"ok": True}

@app.get("/api/recycle-bin")
def list_recycle_bin():
    with engine.connect() as connection:
        rows = connection.execute(text("""
            SELECT 'users' AS type, u.id, u.email AS identity, u.name, u.email,
                r.name AS role, NULL::text AS description, NULL::text AS status,
                u.deleted_at
            FROM users u JOIN roles r ON r.id = u.role_id WHERE u.deleted_at IS NOT NULL
            UNION ALL
            SELECT 'categories', c.id, c.name, c.name, NULL, NULL, c.description,
                NULL, c.deleted_at FROM categories c WHERE c.deleted_at IS NOT NULL
            ORDER BY deleted_at DESC
        """)).mappings().all()
    return {"items": [{"id": f"{row['type']}-{row['id']}", "record_id": row["id"], "type": row["type"], "identity": row["identity"], "data": {key: row[key] for key in ("name", "email", "role", "description", "status") if row[key] is not None}, "deletedAt": row["deleted_at"]} for row in rows]}

@app.post("/api/recycle-bin/{kind}/{record_id}/restore")
def restore_recycle_item(kind: str, record_id: int):
    if kind == "users":
        query = "UPDATE users SET active = TRUE, deleted_at = NULL WHERE id = :id AND deleted_at IS NOT NULL"
    else:
        table = master_table(kind)
        query = f"UPDATE {table} SET deleted_at = NULL WHERE id = :id AND deleted_at IS NOT NULL"
    with engine.begin() as connection:
        result = connection.execute(text(query), {"id": record_id})
    if result.rowcount == 0:
        raise HTTPException(status_code=404, detail="Deleted item not found")
    return {"ok": True}

@app.delete("/api/recycle-bin/{kind}/{record_id}")
def permanently_delete_recycle_item(kind: str, record_id: int):
    table = "users" if kind == "users" else master_table(kind)
    with engine.begin() as connection:
        result = connection.execute(text(f"DELETE FROM {table} WHERE id = :id AND deleted_at IS NOT NULL"), {"id": record_id})
    if result.rowcount == 0:
        raise HTTPException(status_code=404, detail="Deleted item not found")
    return {"ok": True}

@app.post("/api/activity-logs")
def record_activity(payload: ActivityPayload, request: Request):
    ip_address = request.headers.get("x-real-ip") or (request.headers.get("x-forwarded-for") or "").split(",")[0].strip() or (request.client.host if request.client else "unknown")
    with engine.begin() as connection:
        connection.execute(text("INSERT INTO activity_logs (actor, action, ip_address, latitude, longitude) VALUES (:actor, :action, :ip, :latitude, :longitude)"), {"actor": payload.actor[:200], "action": payload.action[:1000], "ip": ip_address[:80], "latitude": payload.latitude, "longitude": payload.longitude})
    return {"ok": True}

@app.get("/api/activity-logs")
def list_activity_logs():
    with engine.connect() as connection:
        rows = connection.execute(text("SELECT id, actor, action, ip_address, latitude, longitude, created_at FROM activity_logs ORDER BY created_at DESC")).mappings().all()
    return {"items": [dict(row) for row in rows]}

@app.get("/api/settings")
def settings():
    with engine.connect() as connection:
        rows = connection.execute(text("SELECT key, value FROM system_settings ORDER BY key")).mappings()
        return {row["key"]: row["value"] for row in rows}

@app.put("/api/settings")
def update_settings(payload: SettingsPayload):
    values = payload.model_dump(exclude_unset=True)
    values["website_name"] = values["website_name"].strip() or "LaporKita"
    with engine.begin() as connection:
        for key, value in values.items():
            connection.execute(text("INSERT INTO system_settings (key, value, updated_at) VALUES (:key, :value, NOW()) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()"), {"key": key, "value": value})
    return values

@app.get("/api/notifications")
def notifications():
    with engine.connect() as connection:
        rows = connection.execute(text("""
            SELECT id, title, message, kind, is_read,
                   created_at,
                   TO_CHAR(created_at, 'DD Mon YYYY HH24:MI') AS time
            FROM notifications
            ORDER BY created_at DESC
            LIMIT 100
        """)).mappings().all()
        unread = connection.execute(text("SELECT COUNT(*)::int AS total FROM notifications WHERE is_read = FALSE")).scalar_one()
    return {"items": [dict(row) for row in rows], "unread": int(unread or 0)}

@app.patch("/api/notifications/{notification_id}/read")
def mark_notification_read(notification_id: int):
    with engine.begin() as connection:
        result = connection.execute(text("UPDATE notifications SET is_read = TRUE WHERE id = :id"), {"id": notification_id})
    if result.rowcount == 0:
        raise HTTPException(status_code=404, detail="Notification not found")
    return {"ok": True}

@app.post("/api/notifications/read-all")
def mark_all_notifications_read():
    with engine.begin() as connection:
        connection.execute(text("UPDATE notifications SET is_read = TRUE WHERE is_read = FALSE"))
    return {"ok": True}

@app.delete("/api/notifications/{notification_id}")
def delete_notification(notification_id: int):
    with engine.begin() as connection:
        result = connection.execute(text("DELETE FROM notifications WHERE id = :id"), {"id": notification_id})
    if result.rowcount == 0:
        raise HTTPException(status_code=404, detail="Notification not found")
    return {"ok": True}

@app.get("/api/complaints")
def complaints():
    with engine.connect() as connection:
        rows = connection.execute(text("""
            SELECT id, title, category, description, citizen_name, status, priority, ai_priority,
                   TO_CHAR(updated_at, 'DD Mon YYYY') AS date
            FROM complaints
            ORDER BY updated_at DESC
        """)).mappings().all()
        status_rows = connection.execute(text("SELECT status, COUNT(*)::int AS total FROM complaints GROUP BY status")).mappings().all()
    counts = {"Semua": len(rows), **{row["status"]: int(row["total"]) for row in status_rows}}
    return {"items": [dict(row) for row in rows], "counts": counts}

@app.post("/api/complaints")
def create_complaint(payload: ComplaintPayload):
    if len(payload.title.strip()) < 5 or len(payload.description.strip()) < 10:
        raise HTTPException(status_code=422, detail="Judul dan isi pengaduan harus diisi dengan lengkap")
    complaint_id = f"PGR-{datetime.now().year}-{uuid.uuid4().hex[:8].upper()}"
    with engine.begin() as connection:
        category_exists = connection.execute(text("SELECT 1 FROM categories WHERE name = :name AND deleted_at IS NULL"), {"name": payload.category.strip()}).first()
        if not category_exists:
            raise HTTPException(status_code=422, detail="Selected category is unavailable")
        citizen = connection.execute(text("SELECT name, email FROM users WHERE LOWER(email) = LOWER(:email) AND active = TRUE"), {"email": payload.citizen_email.strip()}).mappings().first()
        if citizen is None:
            raise HTTPException(status_code=422, detail="Citizen account is unavailable")
        connection.execute(text("""
            INSERT INTO complaints (id, title, category, citizen_name, citizen_email, description, image_data, status, priority)
            VALUES (:id, :title, :category, :citizen_name, :citizen_email, :description, :image_data, 'Menunggu Verifikasi', 'Sedang')
        """), {"id": complaint_id, "title": payload.title.strip(), "category": payload.category.strip(), "citizen_name": citizen["name"], "citizen_email": citizen["email"], "description": payload.description.strip(), "image_data": payload.image_data})
        connection.execute(text("""
            INSERT INTO notifications (title, message, kind)
            VALUES ('New complaint received', :message, 'complaint')
        """), {"message": f"{payload.title.strip()} is waiting for verification."})
    return {"id": complaint_id, "message": "Pengaduan berhasil dibuat"}

@app.get("/api/complaints/{complaint_id}")
def complaint_detail(complaint_id: str):
    with engine.connect() as connection:
        row = connection.execute(text("SELECT id, title, category, citizen_name, citizen_email, description, status, priority, ai_priority, ai_summary, ai_factors, final_priority, verification_note, verified_by, verified_at, resolution_image_data, TO_CHAR(updated_at, 'DD Mon YYYY') AS date FROM complaints WHERE id = :id"), {"id": complaint_id}).mappings().first()
        events = connection.execute(text("SELECT event_type, status, priority, note, actor, TO_CHAR(created_at, 'DD Mon YYYY HH24:MI') AS created_at FROM complaint_events WHERE complaint_id = :id ORDER BY created_at DESC"), {"id": complaint_id}).mappings().all()
    if not row:
        raise HTTPException(status_code=404, detail="Pengaduan tidak ditemukan")
    result = dict(row)
    result["events"] = [dict(event) for event in events]
    return result

@app.patch("/api/complaints/{complaint_id}/workflow")
def update_complaint_workflow(complaint_id: str, payload: ComplaintWorkflowPayload):
    status_aliases = {
        "Pending Verification": "Menunggu Verifikasi", "Pending": "Menunggu Verifikasi", "Menunggu Verifikasi": "Menunggu Verifikasi",
        "Verified": "Diverifikasi", "Diverifikasi": "Diverifikasi", "Assigned": "Ditugaskan", "Ditugaskan": "Ditugaskan",
        "In Progress": "Dalam Penanganan", "Dalam Penanganan": "Dalam Penanganan", "Waiting Confirmation": "Menunggu Konfirmasi", "Menunggu Konfirmasi": "Menunggu Konfirmasi",
        "Completed": "Selesai", "Selesai": "Selesai", "Rejected": "Ditolak", "Ditolak": "Ditolak",
    }
    priority_aliases = {"Low": "Rendah", "Rendah": "Rendah", "Medium": "Sedang", "Sedang": "Sedang", "High": "Tinggi", "Tinggi": "Tinggi", "Urgent": "Mendesak", "Mendesak": "Mendesak"}
    normalized_status = status_aliases.get(payload.status.strip(), payload.status.strip())
    normalized_priority = priority_aliases.get(payload.final_priority.strip(), payload.final_priority.strip())
    allowed_statuses = {"Menunggu Verifikasi", "Diverifikasi", "Ditugaskan", "Dalam Penanganan", "Menunggu Konfirmasi", "Selesai", "Ditolak"}
    allowed_priorities = {"Rendah", "Sedang", "Tinggi", "Mendesak"}
    if normalized_status not in allowed_statuses or normalized_priority not in allowed_priorities:
        raise HTTPException(status_code=422, detail="Invalid status or priority")
    if normalized_status == "Ditolak" and len(payload.note.strip()) < 5:
        raise HTTPException(status_code=422, detail="A rejection reason is required")
    status_order = {"Menunggu Verifikasi": 0, "Diverifikasi": 1, "Ditugaskan": 2, "Dalam Penanganan": 3, "Menunggu Konfirmasi": 4, "Selesai": 5, "Ditolak": 99}
    verified_status = normalized_status in {"Diverifikasi", "Ditugaskan", "Dalam Penanganan", "Menunggu Konfirmasi", "Selesai", "Ditolak"}
    with engine.begin() as connection:
        current = connection.execute(text("SELECT id, status, priority FROM complaints WHERE id = :id FOR UPDATE"), {"id": complaint_id}).mappings().first()
        if not current:
            raise HTTPException(status_code=404, detail="Pengaduan tidak ditemukan")
        current_status = status_aliases.get(current["status"], current["status"])
        if current_status in {"Selesai", "Ditolak"} and normalized_status != current_status:
            raise HTTPException(status_code=422, detail="A completed or rejected complaint cannot move backward")
        if normalized_status != "Ditolak" and status_order.get(normalized_status, 0) < status_order.get(current_status, 0):
            raise HTTPException(status_code=422, detail="Status can only move forward")
        current_priority = priority_aliases.get(current["priority"], current["priority"])
        if current_status != "Menunggu Verifikasi" and normalized_priority != current_priority:
            raise HTTPException(status_code=422, detail="Priority can only be changed during Pending Verification")
        connection.execute(text("""
            UPDATE complaints SET status = CAST(:status AS VARCHAR(80)), priority = CAST(:priority AS VARCHAR(40)), final_priority = CAST(:priority AS VARCHAR(40)),
                verification_note = CASE WHEN CAST(:note AS TEXT) <> '' THEN CAST(:note AS TEXT) ELSE verification_note END,
                verified_by = CASE WHEN :verified_status THEN CAST(:actor AS VARCHAR(160)) ELSE verified_by END,
                verified_at = CASE WHEN :verified_status THEN NOW() ELSE verified_at END,
                resolution_image_data = CASE WHEN CAST(:evidence AS TEXT) <> '' THEN CAST(:evidence AS TEXT) ELSE resolution_image_data END,
                updated_at = NOW()
            WHERE id = :id
        """), {"id": complaint_id, "status": normalized_status, "priority": normalized_priority, "note": payload.note.strip(), "actor": payload.actor.strip() or "Officer", "verified_status": verified_status, "evidence": payload.evidence_image_data})
        connection.execute(text("""
            INSERT INTO complaint_events (complaint_id, event_type, status, priority, note, actor)
            VALUES (:id, 'workflow_update', :status, :priority, :note, :actor)
        """), {"id": complaint_id, "status": normalized_status, "priority": normalized_priority, "note": payload.note.strip(), "actor": payload.actor.strip() or "Officer"})
        connection.execute(text("INSERT INTO notifications (title, message, kind) VALUES ('Complaint workflow updated', :message, 'complaint')"), {"message": f"{complaint_id} sekarang berstatus {normalized_status}."})
    return {"ok": True, "status": normalized_status, "priority": normalized_priority}

@app.get("/api/citizen/dashboard")
def citizen_dashboard(email: str):
    with engine.connect() as connection:
        citizen_name = connection.execute(text("SELECT name FROM users WHERE LOWER(email) = LOWER(:email) AND active = TRUE"), {"email": email}).scalar_one_or_none()
        if citizen_name is None:
            raise HTTPException(status_code=404, detail="Citizen not found")
        rows = connection.execute(text("""
            SELECT id, title, category, status, priority, TO_CHAR(updated_at, 'DD Mon YYYY') AS date
            FROM complaints
            WHERE LOWER(citizen_email) = LOWER(:email)
            ORDER BY updated_at DESC
        """), {"email": email}).mappings().all()
    counts = {"total": len(rows), "pending": sum(row["status"] == "Menunggu Verifikasi" for row in rows), "processing": sum(row["status"] in ("Ditugaskan", "Dalam Penanganan") for row in rows), "completed": sum(row["status"] in ("Selesai", "completed") for row in rows)}
    return {"counts": counts, "items": [dict(row) for row in rows], "citizen_name": citizen_name}

@app.get("/api/dashboard")
def dashboard():
    with engine.connect() as connection:
        metrics = connection.execute(text("""
            SELECT
                COUNT(*) AS total_complaints,
                COUNT(*) FILTER (WHERE LOWER(status) IN ('menunggu verifikasi', 'pending', 'baru')) AS pending_verification,
                COUNT(*) FILTER (WHERE LOWER(priority) IN ('tinggi', 'mendesak', 'high', 'urgent')) AS high_priority,
                COUNT(*) FILTER (WHERE LOWER(status) IN ('selesai', 'completed') AND updated_at >= date_trunc('month', NOW())) AS completed_this_month
            FROM complaints
        """)).mappings().one()
        monthly_rows = connection.execute(text("""
            SELECT TO_CHAR(month, 'Mon') AS name, COALESCE(total, 0)::int AS value
            FROM generate_series(date_trunc('month', NOW()) - interval '5 months', date_trunc('month', NOW()), interval '1 month') AS months(month)
            LEFT JOIN (
                SELECT date_trunc('month', created_at) AS month, COUNT(*)::int AS total
                FROM complaints
                WHERE created_at >= date_trunc('month', NOW()) - interval '5 months'
                GROUP BY 1
            ) counts USING (month)
            ORDER BY month
        """)).mappings().all()
        category_rows = connection.execute(text("""
            SELECT category AS name, COUNT(*)::int AS value
            FROM complaints
            GROUP BY category
            ORDER BY value DESC, category
        """)).mappings().all()
        recent_rows = connection.execute(text("""
            SELECT id, title, category, citizen_name, status, priority,
                   TO_CHAR(updated_at, 'DD Mon YYYY') AS date
            FROM complaints
            ORDER BY updated_at DESC
            LIMIT 10
        """)).mappings().all()
    total = int(metrics["total_complaints"] or 0)
    colors = ['#b91c1c', '#ef4444', '#f59e0b', '#cbd5e1', '#7c3aed', '#0f766e']
    distribution = [{"name": row["name"], "value": int(row["value"]), "color": colors[index % len(colors)]} for index, row in enumerate(category_rows)]
    return {
        "metrics": {key: int(value or 0) for key, value in metrics.items()},
        "monthly": [dict(row) for row in monthly_rows],
        "distribution": distribution,
        "recent_complaints": [dict(row) for row in recent_rows],
        "notice": "Belum ada data pengaduan di database." if total == 0 else None,
    }

@app.get("/api/ai/provider")
def ai_provider():
    provider = os.getenv("AI_PROVIDER", "local").lower()
    configured = bool(os.getenv("GROQ_API_KEY"))
    return {"priority": provider, "groq_configured": configured, "local_available": True, "model": os.getenv("GROQ_MODEL", "llama-3.1-8b-instant")}

@app.post("/api/ai/analyze")
def analyze_complaint(payload: AIAnalysisPayload):
    provider = os.getenv("AI_PROVIDER", "groq").lower()
    api_key = os.getenv("GROQ_API_KEY", "")
    if provider == "groq" and api_key:
        request_body = json.dumps({"model": os.getenv("GROQ_MODEL", "llama-3.1-8b-instant"), "temperature": 0.1, "response_format": {"type": "json_object"}, "messages": [{"role": "system", "content": "Analisis pengaduan publik. Balas JSON dengan field priority (Rendah, Sedang, Tinggi, Mendesak), summary, dan factors berupa array string."}, {"role": "user", "content": json.dumps(payload.model_dump(), ensure_ascii=False)}]}).encode()
        request = urllib.request.Request("https://api.groq.com/openai/v1/chat/completions", data=request_body, headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json", "Accept": "application/json", "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"}, method="POST")
        try:
            with urllib.request.urlopen(request, timeout=30) as response:
                content = json.loads(response.read().decode())
            result = json.loads(content["choices"][0]["message"]["content"])
            result = {"provider": "groq", **result}
            if payload.complaint_id:
                _store_ai_analysis(payload.complaint_id, result)
            return result
        except Exception:
            pass
    text_blob = f"{payload.title} {payload.description}".lower()
    priority = "Mendesak" if any(word in text_blob for word in ("darurat", "bahaya", "kecelakaan")) else "Tinggi" if any(word in text_blob for word in ("mati", "rusak", "bocor", "menumpuk")) else "Sedang"
    result = {"provider": "local", "priority": priority, "summary": "Analisis lokal digunakan karena Groq belum dikonfigurasi atau tidak tersedia.", "factors": ["Kategori pengaduan", "Kata kunci urgensi", "Dampak layanan"]}
    if payload.complaint_id:
        _store_ai_analysis(payload.complaint_id, result)
    return result

def _store_ai_analysis(complaint_id: str, result: dict):
    with engine.begin() as connection:
        connection.execute(text("""
            UPDATE complaints SET ai_priority = :priority, ai_summary = :summary,
                ai_factors = CAST(:factors AS jsonb), updated_at = NOW()
            WHERE id = :id
        """), {"id": complaint_id, "priority": result.get("priority", "Sedang"), "summary": result.get("summary", ""), "factors": json.dumps(result.get("factors", []), ensure_ascii=False)})

@app.get("/api/backups")
def list_backups():
    BACKUP_DIR.mkdir(parents=True, exist_ok=True)
    return [{"filename": file.name, "size": file.stat().st_size, "created_at": datetime.fromtimestamp(file.stat().st_mtime, timezone.utc).isoformat()} for file in sorted(BACKUP_DIR.glob("*.sql"), key=lambda item: item.stat().st_mtime, reverse=True)]

@app.post("/api/backups")
def create_backup():
    BACKUP_DIR.mkdir(parents=True, exist_ok=True)
    filename = f"pengaduan_xai_{datetime.now().strftime('%Y%m%d_%H%M%S')}.sql"
    target = BACKUP_DIR / filename
    database_url = DATABASE_URL.replace("postgresql+psycopg://", "postgresql://", 1)
    try:
        subprocess.run(["pg_dump", database_url, "--format=plain", "--file", str(target)], check=True, capture_output=True, text=True, timeout=120)
    except FileNotFoundError as error:
        raise HTTPException(status_code=503, detail="pg_dump belum tersedia di image backend") from error
    except subprocess.CalledProcessError as error:
        target.unlink(missing_ok=True)
        raise HTTPException(status_code=500, detail=error.stderr.strip() or "Backup database gagal") from error
    return {"filename": filename, "size": target.stat().st_size, "created_at": datetime.now(timezone.utc).isoformat()}

@app.get("/api/backups/{filename}")
def download_backup(filename: str):
    safe_name = Path(filename).name
    target = BACKUP_DIR / safe_name
    if safe_name != filename or target.suffix != ".sql" or not target.is_file():
        raise HTTPException(status_code=404, detail="File backup tidak ditemukan")
    return FileResponse(target, media_type="application/sql", filename=safe_name)
