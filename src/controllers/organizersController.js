const pool = require('../config/db');

// GET /api/organizers - ดึงรายการ organizers ทั้งหมด
exports.getAllOrganizers = async (req, res) => {
  try {
    const { page = 1, limit = 10, search } = req.query;
    const offset = (page - 1) * limit;
    
    let query = `SELECT o.id, o.user_id, o.company_name, o.created_at,
                  u.email, u.first_name, u.last_name, u.role
                 FROM concert_ticket.organizers o
                 JOIN concert_ticket.users u ON o.user_id = u.id
                 WHERE 1=1`;
    const params = [];
    let paramCount = 1;

    if (search) {
      query += ` AND (o.company_name ILIKE $${paramCount} OR u.email ILIKE $${paramCount})`;
      params.push(`%${search}%`);
      paramCount++;
    }

    query += ` ORDER BY o.created_at DESC LIMIT $${paramCount++} OFFSET $${paramCount++}`;
    params.push(parseInt(limit), offset);

    const result = await pool.query(query, params);
    
    // นับจำนวนทั้งหมด
    let countQuery = `SELECT COUNT(*) FROM concert_ticket.organizers o
                      JOIN concert_ticket.users u ON o.user_id = u.id
                      WHERE 1=1`;
    const countParams = [];

    if (search) {
      countQuery += ` AND (o.company_name ILIKE $1 OR u.email ILIKE $1)`;
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

// GET /api/organizers/:id - ดึงข้อมูล organizer โดย ID
exports.getOrganizerById = async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query(
      `SELECT o.id, o.user_id, o.company_name, o.created_at,
              u.email, u.first_name, u.last_name, u.role
       FROM concert_ticket.organizers o
       JOIN concert_ticket.users u ON o.user_id = u.id
       WHERE o.id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Organizer not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// POST /api/organizers - สร้าง organizer ใหม่
exports.createOrganizer = async (req, res) => {
  const { userId, companyName } = req.body;
  const client = await pool.connect();

  try {
    // ตรวจสอบว่า user มีอยู่จริงและเป็น ORGANIZER role
    const userCheck = await client.query(
      `SELECT id, role FROM concert_ticket.users WHERE id = $1`,
      [userId]
    );

    if (userCheck.rows.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (userCheck.rows[0].role !== 'ORGANIZER') {
      return res.status(400).json({ error: 'User must have ORGANIZER role' });
    }

    // ตรวจสอบว่า user นี้มี organizer record อยู่แล้วหรือไม่
    const existingCheck = await client.query(
      `SELECT id FROM concert_ticket.organizers WHERE user_id = $1`,
      [userId]
    );

    if (existingCheck.rows.length > 0) {
      return res.status(400).json({ error: 'Organizer already exists for this user' });
    }

    await client.query('BEGIN');

    const result = await client.query(
      `INSERT INTO concert_ticket.organizers (user_id, company_name)
       VALUES ($1, $2) RETURNING id, user_id, company_name, created_at`,
      [userId, companyName]
    );

    await client.query('COMMIT');
    res.status(201).json(result.rows[0]);
  } catch (error) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: error.message });
  } finally {
    client.release();
  }
};

// PUT /api/organizers/:id - อัปเดตข้อมูล organizer
exports.updateOrganizer = async (req, res) => {
  const { id } = req.params;
  const { companyName } = req.body;
  const client = await pool.connect();

  try {
    // ตรวจสอบว่า organizer มีอยู่จริง
    const organizerCheck = await client.query(
      `SELECT id FROM concert_ticket.organizers WHERE id = $1`,
      [id]
    );

    if (organizerCheck.rows.length === 0) {
      return res.status(404).json({ message: 'Organizer not found' });
    }

    if (!companyName) {
      return res.status(400).json({ error: 'companyName is required' });
    }

    await client.query('BEGIN');

    const result = await client.query(
      `UPDATE concert_ticket.organizers 
       SET company_name = $1 
       WHERE id = $2 
       RETURNING id, user_id, company_name, created_at`,
      [companyName, id]
    );

    await client.query('COMMIT');
    res.json(result.rows[0]);
  } catch (error) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: error.message });
  } finally {
    client.release();
  }
};

// DELETE /api/organizers/:id - ลบ organizer
exports.deleteOrganizer = async (req, res) => {
  const { id } = req.params;
  const client = await pool.connect();

  try {
    // ตรวจสอบว่า organizer มีอยู่จริง
    const organizerCheck = await client.query(
      `SELECT id FROM concert_ticket.organizers WHERE id = $1`,
      [id]
    );

    if (organizerCheck.rows.length === 0) {
      return res.status(404).json({ message: 'Organizer not found' });
    }

    await client.query('BEGIN');

    // ลบ organizer
    await client.query(`DELETE FROM concert_ticket.organizers WHERE id = $1`, [id]);

    await client.query('COMMIT');
    res.json({ message: 'Organizer deleted successfully' });
  } catch (error) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: error.message });
  } finally {
    client.release();
  }
};

