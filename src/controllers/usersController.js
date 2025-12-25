const pool = require('../config/db');
const bcrypt = require('bcryptjs');

// GET /api/users - ดึงรายการ users ทั้งหมด (Admin only)
exports.getAllUsers = async (req, res) => {
  try {
    const { page = 1, limit = 10, role, search } = req.query;
    const offset = (page - 1) * limit;
    
    let query = `SELECT u.id, u.email, u.first_name, u.last_name, u.role, u.created_at,
                  o.id as organizer_id, o.company_name
                 FROM concert_ticket.users u
                 LEFT JOIN concert_ticket.organizers o ON u.id = o.user_id
                 WHERE 1=1`;
    const params = [];
    let paramCount = 1;

    if (role) {
      query += ` AND u.role = $${paramCount++}`;
      params.push(role);
    }

    if (search) {
      query += ` AND (u.email ILIKE $${paramCount} OR u.first_name ILIKE $${paramCount} OR u.last_name ILIKE $${paramCount})`;
      params.push(`%${search}%`);
      paramCount++;
    }

    query += ` ORDER BY u.created_at DESC LIMIT $${paramCount++} OFFSET $${paramCount++}`;
    params.push(parseInt(limit), offset);

    const result = await pool.query(query, params);
    
    // นับจำนวนทั้งหมด
    let countQuery = `SELECT COUNT(*) FROM concert_ticket.users u WHERE 1=1`;
    const countParams = [];
    let countParamCount = 1;

    if (role) {
      countQuery += ` AND u.role = $${countParamCount++}`;
      countParams.push(role);
    }

    if (search) {
      countQuery += ` AND (u.email ILIKE $${countParamCount} OR u.first_name ILIKE $${countParamCount} OR u.last_name ILIKE $${countParamCount})`;
      countParams.push(`%${search}%`);
    }

    const countResult = await pool.query(countQuery, countParams);
    const total = parseInt(countResult.rows[0].count);

    res.json({
      data: result.rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// GET /api/users/:id - ดึงข้อมูล user โดย ID
exports.getUserById = async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query(
      `SELECT u.id, u.email, u.first_name, u.last_name, u.role, u.created_at,
              o.id as organizer_id, o.company_name
       FROM concert_ticket.users u
       LEFT JOIN concert_ticket.organizers o ON u.id = o.user_id
       WHERE u.id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// PUT /api/users/:id - อัปเดตข้อมูล user
exports.updateUser = async (req, res) => {
  const { id } = req.params;
  const { email, firstName, lastName, role } = req.body;
  const client = await pool.connect();

  try {
    // ตรวจสอบว่า user มีอยู่จริง
    const userCheck = await client.query(
      `SELECT id, role FROM concert_ticket.users WHERE id = $1`,
      [id]
    );

    if (userCheck.rows.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }

    await client.query('BEGIN');

    const updateFields = [];
    const updateValues = [];
    let paramCount = 1;

    if (email) {
      updateFields.push(`email = $${paramCount++}`);
      updateValues.push(email);
    }
    if (firstName) {
      updateFields.push(`first_name = $${paramCount++}`);
      updateValues.push(firstName);
    }
    if (lastName !== undefined) {
      updateFields.push(`last_name = $${paramCount++}`);
      updateValues.push(lastName);
    }
    if (role) {
      updateFields.push(`role = $${paramCount++}`);
      updateValues.push(role);
    }

    if (updateFields.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'No fields to update' });
    }

    updateValues.push(id);
    await client.query(
      `UPDATE concert_ticket.users SET ${updateFields.join(', ')} WHERE id = $${paramCount}`,
      updateValues
    );

    await client.query('COMMIT');
    res.json({ message: 'User updated successfully' });
  } catch (error) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: error.message });
  } finally {
    client.release();
  }
};

// DELETE /api/users/:id - ลบ user
exports.deleteUser = async (req, res) => {
  const { id } = req.params;
  const client = await pool.connect();

  try {
    // ตรวจสอบว่า user มีอยู่จริง
    const userCheck = await client.query(
      `SELECT id FROM concert_ticket.users WHERE id = $1`,
      [id]
    );

    if (userCheck.rows.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }

    // ไม่ควรลบตัวเอง
    if (parseInt(id) === req.user.id) {
      return res.status(400).json({ error: 'Cannot delete yourself' });
    }

    await client.query('BEGIN');

    // ลบ organizer record ถ้ามี
    await client.query(`DELETE FROM concert_ticket.organizers WHERE user_id = $1`, [id]);

    // ลบ user
    await client.query(`DELETE FROM concert_ticket.users WHERE id = $1`, [id]);

    await client.query('COMMIT');
    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: error.message });
  } finally {
    client.release();
  }
};

