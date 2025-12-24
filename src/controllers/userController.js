const bcrypt = require('bcryptjs');
const pool = require('../config/db');

exports.updateProfile = async (req, res) => {
  const { name, email } = req.body;
  const userId = req.user.id;

  try {
    const updateFields = [];
    const updateValues = [];
    let paramCount = 1;

    if (name) {
      // ถ้ามี name ให้แยกเป็น first_name และ last_name (หรือใช้แค่ first_name)
      const nameParts = name.split(' ');
      if (nameParts.length > 1) {
        updateFields.push(`first_name = $${paramCount++}, last_name = $${paramCount++}`);
        updateValues.push(nameParts[0], nameParts.slice(1).join(' '));
      } else {
        updateFields.push(`first_name = $${paramCount++}`);
        updateValues.push(name);
      }
    }

    if (email) {
      updateFields.push(`email = $${paramCount++}`);
      updateValues.push(email);
    }

    if (updateFields.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    updateValues.push(userId);
    await pool.query(
      `UPDATE concert_ticket.users SET ${updateFields.join(', ')} WHERE id = $${paramCount}`,
      updateValues
    );

    res.json({ message: 'Profile updated successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.changePassword = async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  const userId = req.user.id;

  try {
    // ดึง password hash ปัจจุบัน
    const result = await pool.query(
      `SELECT password_hash FROM concert_ticket.users WHERE id = $1`,
      [userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = result.rows[0];

    // ตรวจสอบรหัสผ่านปัจจุบัน
    const isMatch = await bcrypt.compare(currentPassword, user.password_hash);
    if (!isMatch) {
      return res.status(400).json({ error: 'Current password is incorrect', message: 'Current password is incorrect' });
    }

    // Hash รหัสผ่านใหม่
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // อัปเดตรหัสผ่าน
    await pool.query(
      `UPDATE concert_ticket.users SET password_hash = $1 WHERE id = $2`,
      [hashedPassword, userId]
    );

    res.json({ message: 'Password changed successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

