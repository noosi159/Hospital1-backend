import pool from "../db/pool.js";

export async function returnAuditorCase(caseId, userId) {
  const [rows] = await pool.query(
    `SELECT id, status, auditor_id AS auditorId FROM cases WHERE id = ? LIMIT 1`,
    [caseId]
  );

  if (!rows.length) {
    const err = new Error("ไม่พบเคสนี้");
    err.status = 404;
    throw err;
  }

  const curStatus = rows[0].status;

  const BLOCK = new Set(["SENT_TO_CODER", "CODER_WORKING", "CONFIRMED"]);
  if (BLOCK.has(curStatus)) {
    const err = new Error("เคสถูกส่งให้ Coder แล้ว ไม่สามารถคืนได้");
    err.status = 409;
    throw err;
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    await conn.query(
      `
      UPDATE cases
      SET
        status = 'RETURNED',
        auditor_id = NULL,
        updated_at = NOW()
      WHERE id = ?
      `,
      [caseId]
    );
    if (userId) {
      await conn.query(
        `
        DELETE FROM case_assignments
        WHERE id = (
          SELECT last_id FROM (
            SELECT MAX(id) AS last_id
            FROM case_assignments
            WHERE case_id = ? AND auditor_id = ?
          ) t
        )
        `,
        [caseId, userId]
      );
    } else {

      await conn.query(
        `
        DELETE FROM case_assignments
        WHERE id = (
          SELECT last_id FROM (
            SELECT MAX(id) AS last_id
            FROM case_assignments
            WHERE case_id = ?
          ) t
        )
        `,
        [caseId]
      );
    }

    await conn.commit();
    return { caseId, status: "RETURNED" };
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}

export async function getCaseDetail(caseId) {
  const [rows] = await pool.query(
    `
   SELECT
      c.id AS caseId,
      c.an,
      c.hn,
      c.patient_name AS patientName,
      c.status,
      d.name_th AS department,

      ci.sex,
      ci.age,
      ci.ward,
      ci.coverage AS coverage,

      crw.rw AS rw,
      crw.adjrw AS adjrw,
      crw.calc_note AS rwNote

    FROM cases c
    LEFT JOIN departments d ON d.id = c.department_id
    LEFT JOIN case_info ci ON ci.case_id = c.id
    LEFT JOIN case_rw crw ON crw.case_id = c.id
    WHERE c.id = ?
    LIMIT 1
    `,
    [caseId]
  );

  if (!rows.length) {
    const err = new Error("ไม่พบเคสนี้");
    err.status = 404;
    throw err;
  }
  return rows[0];
}

export async function listDiagnosesByCase(caseId) {
  const [rows] = await pool.query(
    `
    SELECT
      id,
      case_id AS caseId,
      type,
      icd_incom AS icdIncom,
      diagnosis,
      s_icd AS sIcd,
      doctor_note AS doctorNote,
      r_icd AS rIcd,
      coder_note AS coderNote
    FROM diagnoses
    WHERE case_id = ?
    ORDER BY
      FIELD(type,'PDX','SDX','ODX','COMPLAINT'),
      id ASC
    `,
    [caseId]
  );
  return rows;
}

export async function upsertCaseInfo(caseId, payload = {}) {
  const { sex = null, age = null, ward = null, coverage_code = null, coverage = null } = payload;
  const cov = coverage ?? coverage_code ?? null;

  await pool.query(
    `
    INSERT INTO case_info (case_id, sex, age, ward, coverage)
    VALUES (?, ?, ?, ?, ?)
    ON DUPLICATE KEY UPDATE
      sex = VALUES(sex),
      age = VALUES(age),
      ward = VALUES(ward),
      coverage = VALUES(coverage)
    `,
    [caseId, sex, age, ward, cov]
  );

  const [rows] = await pool.query(
    `SELECT case_id AS caseId, sex, age, ward, coverage FROM case_info WHERE case_id = ? LIMIT 1`,
    [caseId]
  );

  return rows[0] || { caseId, sex, age, ward, coverage: cov };
}



export async function replaceDiagnosesByCase(caseId, rows = []) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();


    await conn.query(`DELETE FROM diagnoses WHERE case_id = ?`, [caseId]);


    for (const r of rows) {
      const type = r.type || "ODX";
      await conn.query(
        `
        INSERT INTO diagnoses
          (case_id, type, icd_incom, diagnosis, s_icd, doctor_note, r_icd , coder_note)
        VALUES
          (?, ?, ?, ?, ?, ?, ?, ?)
        `,
        [
          caseId,
          type,
          r.icdIncom ?? null,
          r.diagnosis ?? null,
          r.sIcd ?? null,
          r.doctorNote ?? null,
          r.rIcd ?? null,
          r.coderNote ?? null,
        ]
      );
    }

    await conn.commit();
    return await listDiagnosesByCase(caseId);
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}

export async function deleteDiagnosisById(id) {
  const [result] = await pool.query(`DELETE FROM diagnoses WHERE id = ?`, [id]);
  if (result.affectedRows === 0) {
    const err = new Error("ไม่พบรายการนี้");
    err.status = 404;
    throw err;
  }
  return { deleted: true, id };
}
