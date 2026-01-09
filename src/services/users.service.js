import pool from "../db/pool.js";
import bcrypt from "bcryptjs";

export async function list({ search = "", role, is_active } = {}) {
  let sql = `
    SELECT id, username, full_name, role, is_active
    FROM users
    WHERE 1=1
  `;
  const params = [];

  if (search) {
    sql += " AND (username LIKE ? OR full_name LIKE ?)";
    params.push(`%${search}%`, `%${search}%`);
  }
  if (role) {
    sql += " AND role = ?";
    params.push(role);
  }
  if (is_active !== undefined && is_active !== "") {
    sql += " AND is_active = ?";
    params.push(is_active);
  }

  const [rows] = await pool.execute(sql, params);
  return rows;
}

export async function create({ username, password, full_name, role, is_active = 1 } = {}) {
  if (!username || !password || !full_name || !role) {
    const err = new Error("username, password, full_name, role are required");
    err.status = 400;
    throw err;
  }
  const hash = await bcrypt.hash(password, 10);

  await pool.execute(
    `INSERT INTO users (username, password_hash, full_name, role, is_active)
     VALUES (?, ?, ?, ?, ?)`,
    [username, hash, full_name, role, is_active]
  );
}

export async function update(id, { username, full_name, role, is_active } = {}) {
  await pool.execute(
    `UPDATE users SET username=?, full_name=?, role=?, is_active=? WHERE id=?`,
    [username, full_name, role, is_active, id]
  );
}

export async function remove(id) {
  await pool.execute(`DELETE FROM users WHERE id = ?`, [id]);
}

export async function resetPassword(id, newPassword) {
  if (!newPassword || newPassword.length < 6) {
    const err = new Error("newPassword must be at least 6 chars");
    err.status = 400;
    throw err;
  }
  const hash = await bcrypt.hash(newPassword, 10);
  await pool.execute(`UPDATE users SET password_hash=? WHERE id=?`, [hash, id]);
}
