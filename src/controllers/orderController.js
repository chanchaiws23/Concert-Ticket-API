const pool = require('../config/db');

exports.purchaseTickets = async (req, res) => {
  const { items } = req.body;
  const userId = req.user.id;
  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    let totalAmount = 0;
    const orderItemsData = [];

    for (const item of items) {
      const updateRes = await client.query(
        `UPDATE concert_ticket.ticket_types 
         SET sold_quantity = sold_quantity + $1
         WHERE id = $2 AND (sold_quantity + $1) <= total_quantity
         RETURNING price, name`,
        [item.quantity, item.ticketTypeId]
      );

      if (updateRes.rowCount === 0) {
        throw new Error(`บัตร ID ${item.ticketTypeId} หมดแล้ว`);
      }

      const ticketInfo = updateRes.rows[0];
      totalAmount += parseFloat(ticketInfo.price) * item.quantity;
      
      orderItemsData.push({
        ticketTypeId: item.ticketTypeId,
        quantity: item.quantity,
        price: ticketInfo.price
      });
    }

    const orderRes = await client.query(
      `INSERT INTO concert_ticket.orders (user_id, total_amount, status)
       VALUES ($1, $2, 'PAID') RETURNING id`,
      [userId, totalAmount]
    );
    const orderId = orderRes.rows[0].id;

    for (const item of orderItemsData) {
      await client.query(
        `INSERT INTO concert_ticket.order_items (order_id, ticket_type_id, quantity, price_per_unit)
         VALUES ($1, $2, $3, $4)`,
        [orderId, item.ticketTypeId, item.quantity, item.price]
      );
    }

    await client.query('COMMIT');
    res.status(201).json({ success: true, orderId, message: 'Purchase successful' });
  } catch (error) {
    await client.query('ROLLBACK');
    res.status(400).json({ success: false, error: error.message });
  } finally {
    client.release();
  }
};

exports.getMyOrders = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT o.id, o.total_amount, o.status, o.created_at,
        json_agg(json_build_object('name', t.name, 'qty', oi.quantity)) as items
       FROM concert_ticket.orders o
       JOIN concert_ticket.order_items oi ON o.id = oi.order_id
       JOIN concert_ticket.ticket_types t ON oi.ticket_type_id = t.id
       WHERE o.user_id = $1
       GROUP BY o.id
       ORDER BY o.created_at DESC`,
      [req.user.id]
    );
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};