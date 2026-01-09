
import bcrypt from "bcryptjs";
import mysql from "mysql2/promise";

const DB = {
  host: process.env.DB_HOST || "localhost",
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "251899",
  database: process.env.DB_NAME || "hospital",
  port: Number(process.env.DB_PORT || 3306),
};

const DEFAULT_PASSWORD = process.env.SEED_PASSWORD || "123456"; 
const SALT_ROUNDS = 10;

const users = [
  // ADMIN
  { username: "admin1", full_name: "พี่หนึ่ง", role: "ADMIN" },
  { username: "admin2", full_name: "พี่นุ่น", role: "ADMIN" },
  { username: "admin3", full_name: "พี่แป้ง", role: "ADMIN" },

  // AUDITOR
  { username: "aud01", full_name: "พิษณุวัฒน์", role: "AUDITOR" },
  { username: "aud02", full_name: "วัชรินทร์", role: "AUDITOR" },
  { username: "aud03", full_name: "นรินทร์", role: "AUDITOR" },
  { username: "aud04", full_name: "กุลธิดา", role: "AUDITOR" },
  { username: "aud05", full_name: "ปิติ", role: "AUDITOR" },
  { username: "aud06", full_name: "อรุณรัตน์", role: "AUDITOR" },
  { username: "aud07", full_name: "ชัชวาลย์", role: "AUDITOR" },
  { username: "aud08", full_name: "ปรียาภรณ์", role: "AUDITOR" },
  { username: "aud09", full_name: "จิรวัฒน์", role: "AUDITOR" },
  { username: "aud10", full_name: "กัลมลี", role: "AUDITOR" },
  { username: "aud11", full_name: "อัจฉรีย์", role: "AUDITOR" },
  { username: "aud12", full_name: "หทัยทิพย์", role: "AUDITOR" },
  { username: "aud13", full_name: "บุศรินทร์", role: "AUDITOR" },
  { username: "aud14", full_name: "อธิศา", role: "AUDITOR" },
  { username: "aud15", full_name: "ปิยะณัฐ", role: "AUDITOR" },
  { username: "aud16", full_name: "เบญญา", role: "AUDITOR" },

  // CODER
  { username: "cod01", full_name: "วรนิษฐา", role: "CODER" },
  { username: "cod02", full_name: "ฐานภพ", role: "CODER" },
  { username: "cod03", full_name: "ผ่องพรรณ", role: "CODER" },
  { username: "cod04", full_name: "กนกวรรณ", role: "CODER" },
];

async function main() {
  const conn = await mysql.createConnection(DB);


  const password_hash = await bcrypt.hash(DEFAULT_PASSWORD, SALT_ROUNDS);


  if (process.env.SEED_TRUNCATE === "1") {
    await conn.query("SET FOREIGN_KEY_CHECKS=0");
    await conn.query("TRUNCATE TABLE users");
    await conn.query("SET FOREIGN_KEY_CHECKS=1");
  }

  const sql = `
    INSERT INTO users (username, password_hash, full_name, role, is_active)
    VALUES (?, ?, ?, ?, 1)
    ON DUPLICATE KEY UPDATE
      password_hash = VALUES(password_hash),
      full_name = VALUES(full_name),
      role = VALUES(role),
      is_active = 1
  `;

  for (const u of users) {
    await conn.execute(sql, [u.username, password_hash, u.full_name, u.role]);
  }

  const [rows] = await conn.query(
    "SELECT id, username, full_name, role, is_active, created_at FROM users ORDER BY role, username"
  );
  console.table(rows);

  await conn.end();
  console.log("✅ Seed users done. Default password =", DEFAULT_PASSWORD);
}

main().catch((err) => {
  process.exit(1);
});
