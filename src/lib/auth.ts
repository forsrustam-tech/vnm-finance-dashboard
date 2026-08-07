import bcrypt from "bcryptjs";
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { sql } from "@/lib/db";

const SESSION_COOKIE = "vnm_session";

function getSecret() {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error("AUTH_SECRET is not set");
  return new TextEncoder().encode(secret);
}

export async function hashPassword(password: string) {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(password: string, hash: string) {
  return bcrypt.compare(password, hash);
}

export async function createSession(userId: number) {
  const token = await new SignJWT({ userId })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("30d")
    .sign(getSecret());

  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 30,
    path: "/",
  });
}

export async function clearSession() {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}

async function getSessionUserId(): Promise<number | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, getSecret());
    return payload.userId as number;
  } catch {
    return null;
  }
}

export type CurrentUser = {
  id: number;
  name: string;
  phone: string;
  roleId: number;
  roleName: string;
  canViewAllFinance: boolean;
  canManageProjects: boolean;
  canManageUsers: boolean;
  canManageRoles: boolean;
};

export async function getCurrentUser(): Promise<CurrentUser | null> {
  const userId = await getSessionUserId();
  if (!userId) return null;

  const rows = await sql`
    SELECT
      u.id, u.name, u.phone, u.role_id,
      r.name AS role_name,
      r.can_view_all_finance, r.can_manage_projects, r.can_manage_users, r.can_manage_roles
    FROM users u
    JOIN roles r ON r.id = u.role_id
    WHERE u.id = ${userId}
  `;
  const row = rows[0];
  if (!row) return null;

  return {
    id: row.id,
    name: row.name,
    phone: row.phone,
    roleId: row.role_id,
    roleName: row.role_name,
    canViewAllFinance: row.can_view_all_finance,
    canManageProjects: row.can_manage_projects,
    canManageUsers: row.can_manage_users,
    canManageRoles: row.can_manage_roles,
  };
}
