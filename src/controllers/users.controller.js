
import * as service from "../services/users.service.js";

export async function list(req, res) {
  try {
    const rows = await service.list(req.query);
    return res.json(rows);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Load users failed" });
  }
}

export async function create(req, res) {
  try {
    await service.create(req.body);
    return res.json({ message: "User created" });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Create user failed" });
  }
}

export async function update(req, res) {
  try {
    await service.update(req.params.id, req.body);
    return res.json({ message: "User updated" });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Update user failed" });
  }
}

export async function remove(req, res) {
  try {
    await service.remove(req.params.id);
    return res.json({ message: "User deleted" });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Delete user failed" });
  }
}

export async function resetPassword(req, res) {
  try {
    await service.resetPassword(req.params.id, req.body?.newPassword);
    return res.json({ message: "Password reset" });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Reset password failed" });
  }
}
