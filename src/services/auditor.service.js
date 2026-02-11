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

    if (userId) {
      await conn.query(
        `
        UPDATE case_assignments
        SET is_active = 0, remark = 'RETURNED'
        WHERE case_id = ? AND role = 'AUDITOR' AND assigned_to = ? AND is_active = 1
        `,
        [caseId, userId]
      );
    } else {
      await conn.query(
        `
        UPDATE case_assignments
        SET is_active = 0, remark = 'RETURNED'
        WHERE case_id = ? AND role = 'AUDITOR' AND is_active = 1
        `,
        [caseId]
      );
    }

    await conn.query(
      `
      UPDATE cases
      SET status = 'RETURNED', auditor_id = NULL, updated_at = NOW()
      WHERE id = ?
      `,
      [caseId]
    );

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
      c.updated_at AS updatedAt,
      c.ward_name AS department,

      c.sex_name AS sex,
      c.age_text AS age,
      c.ward_name AS ward,
      c.right_name AS coverage,

      crw.rw AS rw,
      crw.adjrw AS adjrw,
      NULL AS rwNote

    FROM cases c
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
  const sets = [];
  const params = [];

  if (Object.prototype.hasOwnProperty.call(payload, "sex")) {
    sets.push("sex_name = ?");
    params.push(payload.sex === "" ? null : payload.sex);
  }
  if (Object.prototype.hasOwnProperty.call(payload, "age")) {
    sets.push("age_text = ?");
    params.push(payload.age === "" ? null : payload.age);
  }
  if (Object.prototype.hasOwnProperty.call(payload, "ward")) {
    sets.push("ward_name = ?");
    params.push(payload.ward === "" ? null : payload.ward);
  }
  if (Object.prototype.hasOwnProperty.call(payload, "coverage")) {
    sets.push("right_name = ?");
    params.push(payload.coverage === "" ? null : payload.coverage);
  }
  if (Object.prototype.hasOwnProperty.call(payload, "coverage_code")) {
    sets.push("right_code = ?");
    params.push(payload.coverage_code === "" ? null : payload.coverage_code);
  }

  if (sets.length) {
    await pool.query(
      `
      UPDATE cases
      SET ${sets.join(", ")}, updated_at = NOW()
      WHERE id = ?
      `,
      [...params, caseId]
    );
  }

  const [rows] = await pool.query(
    `
    SELECT
      id AS caseId,
      sex_name AS sex,
      age_text AS age,
      ward_name AS ward,
      right_name AS coverage,
      right_code AS coverageCode
    FROM cases
    WHERE id = ?
    LIMIT 1
    `,
    [caseId]
  );

  return rows[0] || { caseId };
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
