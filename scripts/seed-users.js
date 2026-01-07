import bcrypt from "bcrypt";
import pool from "./db.js";

//mock users จร้าสู
const users = [
  { email: "admin@hospital.com",   password: "admin123", fullName: "Admin System", role: "ADMIN" },
  { email: "auditor1@hospital.com",password: "aud123",   fullName: "Auditor One",  role: "AUDITOR" },
  { email: "auditor2@hospital.com",password: "aud456",   fullName: "Auditor Two",  role: "AUDITOR" },
  { email: "coder1@hospital.com",  password: "cod123",   fullName: "Coder One",    role: "CODER" },
  { email: "coder2@hospital.com",  password: "cod456",   fullName: "Coder Two",    role: "CODER" },
];

for (const u of users) {
  const hash = await bcrypt.hash(u.password, 10);

  await pool.execute(
    `INSERT INTO users (email, password_hash, full_name, role)
     VALUES (?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       password_hash = VALUES(password_hash),
       full_name = VALUES(full_name),
       role = VALUES(role)`,
    [u.email, hash, u.fullName, u.role]
  );

  console.log("Seeded:", u.email);
}

process.exit(0);
