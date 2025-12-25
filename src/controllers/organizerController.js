const pool = require('../config/db');

exports.getOrganizerOrders = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT o.id, o.order_code, o.total_amount, o.status, o.created_at,
        json_agg(json_build_object('name', t.name, 'qty', oi.quantity)) as items
       FROM concert_ticket.orders o
       JOIN concert_ticket.order_items oi ON o.id = oi.order_id
       JOIN concert_ticket.ticket_types t ON oi.ticket_type_id = t.id
       JOIN concert_ticket.events e ON t.event_id = e.id
       WHERE e.organizer_id = $1
       GROUP BY o.id, o.order_code
       ORDER BY o.created_at DESC`,
      [req.user.organizerId]
    );
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

