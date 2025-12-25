const pool = require('../config/db');

exports.getUsers = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, email, first_name || ' ' || COALESCE(last_name, '') as name, role
       FROM concert_ticket.users
       ORDER BY created_at DESC`
    );
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

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

exports.getAllOrders = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT o.id, o.order_code, o.total_amount, o.status, o.created_at,
        json_agg(json_build_object('name', t.name, 'qty', oi.quantity)) as items
       FROM concert_ticket.orders o
       JOIN concert_ticket.order_items oi ON o.id = oi.order_id
       JOIN concert_ticket.ticket_types t ON oi.ticket_type_id = t.id
       GROUP BY o.id, o.order_code
       ORDER BY o.created_at DESC`
    );
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.deleteEvent = async (req, res) => {
  const { id } = req.params;
  const client = await pool.connect();

  try {
    // ตรวจสอบว่า event มีอยู่จริง
    const eventCheck = await client.query(
      `SELECT id FROM concert_ticket.events WHERE id = $1`,
      [id]
    );

    if (eventCheck.rows.length === 0) {
      return res.status(404).json({ message: 'Event not found' });
    }

    await client.query('BEGIN');

    // ลบ ticket types ก่อน (เนื่องจาก foreign key constraint)
    await client.query(`DELETE FROM concert_ticket.ticket_types WHERE event_id = $1`, [id]);

    // ลบ event
    await client.query(`DELETE FROM concert_ticket.events WHERE id = $1`, [id]);

    await client.query('COMMIT');
    res.json({ message: 'Event deleted successfully' });
  } catch (error) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: error.message });
  } finally {
    client.release();
  }
};

