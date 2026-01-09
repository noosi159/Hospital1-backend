import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import pool from "../db/pool.js"; 

export async function login(req, res) {
  try {
    const { username, password } = req.body || {};
    if (!username || !password) {
      return res.status(400).json({ message: "username และ password จำเป็นต้องมี" });
    }

    const [rows] = await pool.query(
      "SELECT id, username, password_hash, full_name, role, is_active FROM users WHERE username = ? LIMIT 1",
      [username]
    );

    const user = rows?.[0];
    if (!user || user.is_active === 0) {
      return res.status(401).json({ message: "ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง" });
    }

    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) {
      return res.status(401).json({ message: "ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง" });
    }

    const token = jwt.sign(
      { sub: user.id, role: user.role, username: user.username },
      process.env.JWT_SECRET || "dev_secret",
      { expiresIn: "7d" }
    );

    return res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        fullName: user.full_name,
        role: user.role,
      },
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Login failed" });
  }
}
