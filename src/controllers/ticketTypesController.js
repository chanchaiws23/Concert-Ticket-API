const pool = require('../config/db');

// GET /api/ticket-types - ดึงรายการ ticket types ทั้งหมด
exports.getAllTicketTypes = async (req, res) => {
  try {
    const { page = 1, limit = 10, eventId, search } = req.query;
    const offset = (page - 1) * limit;
    
    let query = `SELECT t.id, t.event_id, t.name, t.price, t.total_quantity, t.sold_quantity,
                  e.title as event_title
                 FROM concert_ticket.ticket_types t
                 JOIN concert_ticket.events e ON t.event_id = e.id
                 WHERE 1=1`;
    const params = [];
    let paramCount = 1;

    if (eventId) {
      query += ` AND t.event_id = $${paramCount++}`;
      params.push(eventId);
    }

    if (search) {
      query += ` AND (t.name ILIKE $${paramCount} OR e.title ILIKE $${paramCount})`;
      params.push(`%${search}%`);
      paramCount++;
    }

    query += ` ORDER BY t.id DESC LIMIT $${paramCount++} OFFSET $${paramCount++}`;
    params.push(parseInt(limit), offset);

    const result = await pool.query(query, params);
    
    // นับจำนวนทั้งหมด
    let countQuery = `SELECT COUNT(*) FROM concert_ticket.ticket_types t
                      JOIN concert_ticket.events e ON t.event_id = e.id
                      WHERE 1=1`;
    const countParams = [];
    let countParamCount = 1;

    if (eventId) {
      countQuery += ` AND t.event_id = $${countParamCount++}`;
      countParams.push(eventId);
    }

    if (search) {
      countQuery += ` AND (t.name ILIKE $${countParamCount} OR e.title ILIKE $${countParamCount})`;
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

// GET /api/ticket-types/:id - ดึงข้อมูล ticket type โดย ID
exports.getTicketTypeById = async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query(
      `SELECT t.id, t.event_id, t.name, t.price, t.total_quantity, t.sold_quantity,
              e.title as event_title, e.organizer_id
       FROM concert_ticket.ticket_types t
       JOIN concert_ticket.events e ON t.event_id = e.id
       WHERE t.id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Ticket type not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// POST /api/ticket-types - สร้าง ticket type ใหม่
exports.createTicketType = async (req, res) => {
  const { eventId, name, price, totalQuantity } = req.body;
  const client = await pool.connect();

  try {
    // ตรวจสอบว่า event มีอยู่จริง
    const eventCheck = await client.query(
      `SELECT id, organizer_id FROM concert_ticket.events WHERE id = $1`,
      [eventId]
    );

    if (eventCheck.rows.length === 0) {
      return res.status(404).json({ message: 'Event not found' });
    }

    // ตรวจสอบว่า user เป็น organizer ของ event นี้หรือเป็น admin
    if (req.user.role === 'ORGANIZER' && eventCheck.rows[0].organizer_id !== req.user.organizerId) {
      return res.status(403).json({ message: 'You are not authorized to create ticket types for this event' });
    }

    if (!name || !price || !totalQuantity) {
      return res.status(400).json({ error: 'name, price, and totalQuantity are required' });
    }

    await client.query('BEGIN');

    const result = await client.query(
      `INSERT INTO concert_ticket.ticket_types (event_id, name, price, total_quantity)
       VALUES ($1, $2, $3, $4) RETURNING id, event_id, name, price, total_quantity, sold_quantity`,
      [eventId, name, price, totalQuantity]
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

// PUT /api/ticket-types/:id - อัปเดตข้อมูล ticket type
exports.updateTicketType = async (req, res) => {
  const { id } = req.params;
  const { name, price, totalQuantity } = req.body;
  const client = await pool.connect();

  try {
    // ตรวจสอบว่า ticket type มีอยู่จริงและดึงข้อมูล event
    const ticketCheck = await client.query(
      `SELECT t.id, t.event_id, t.sold_quantity, e.organizer_id
       FROM concert_ticket.ticket_types t
       JOIN concert_ticket.events e ON t.event_id = e.id
       WHERE t.id = $1`,
      [id]
    );

    if (ticketCheck.rows.length === 0) {
      return res.status(404).json({ message: 'Ticket type not found' });
    }

    const ticket = ticketCheck.rows[0];

    // ตรวจสอบว่า user เป็น organizer ของ event นี้หรือเป็น admin
    if (req.user.role === 'ORGANIZER' && ticket.organizer_id !== req.user.organizerId) {
      return res.status(403).json({ message: 'You are not authorized to update this ticket type' });
    }

    // ตรวจสอบว่า totalQuantity ไม่น้อยกว่า sold_quantity
    if (totalQuantity !== undefined && totalQuantity < ticket.sold_quantity) {
      return res.status(400).json({ error: 'totalQuantity cannot be less than sold_quantity' });
    }

    await client.query('BEGIN');

    const updateFields = [];
    const updateValues = [];
    let paramCount = 1;

    if (name) {
      updateFields.push(`name = $${paramCount++}`);
      updateValues.push(name);
    }
    if (price !== undefined) {
      updateFields.push(`price = $${paramCount++}`);
      updateValues.push(price);
    }
    if (totalQuantity !== undefined) {
      updateFields.push(`total_quantity = $${paramCount++}`);
      updateValues.push(totalQuantity);
    }

    if (updateFields.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'No fields to update' });
    }

    updateValues.push(id);
    const result = await client.query(
      `UPDATE concert_ticket.ticket_types 
       SET ${updateFields.join(', ')} 
       WHERE id = $${paramCount}
       RETURNING id, event_id, name, price, total_quantity, sold_quantity`,
      updateValues
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

// DELETE /api/ticket-types/:id - ลบ ticket type
exports.deleteTicketType = async (req, res) => {
  const { id } = req.params;
  const client = await pool.connect();

  try {
    // ตรวจสอบว่า ticket type มีอยู่จริงและดึงข้อมูล event
    const ticketCheck = await client.query(
      `SELECT t.id, t.event_id, e.organizer_id
       FROM concert_ticket.ticket_types t
       JOIN concert_ticket.events e ON t.event_id = e.id
       WHERE t.id = $1`,
      [id]
    );

    if (ticketCheck.rows.length === 0) {
      return res.status(404).json({ message: 'Ticket type not found' });
    }

    const ticket = ticketCheck.rows[0];

    // ตรวจสอบว่า user เป็น organizer ของ event นี้หรือเป็น admin
    if (req.user.role === 'ORGANIZER' && ticket.organizer_id !== req.user.organizerId) {
      return res.status(403).json({ message: 'You are not authorized to delete this ticket type' });
    }

    // ตรวจสอบว่ามีการขายบัตรแล้วหรือไม่
    const soldCheck = await client.query(
      `SELECT sold_quantity FROM concert_ticket.ticket_types WHERE id = $1`,
      [id]
    );

    if (soldCheck.rows[0].sold_quantity > 0) {
      return res.status(400).json({ error: 'Cannot delete ticket type with sold tickets' });
    }

    await client.query('BEGIN');

    await client.query(`DELETE FROM concert_ticket.ticket_types WHERE id = $1`, [id]);

    await client.query('COMMIT');
    res.json({ message: 'Ticket type deleted successfully' });
  } catch (error) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: error.message });
  } finally {
    client.release();
  }
};

