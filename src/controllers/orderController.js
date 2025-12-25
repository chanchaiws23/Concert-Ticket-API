const pool = require('../config/db');
const { checkAndCancelExpiredOrders } = require('../services/orderCancellationService');

/**
 * Generate order code in format: ORD-YYYYMMDD-XXXX
 * Example: ORD-20241215-0001
 */
async function generateOrderCode(client) {
  const today = new Date();
  const dateStr = today.toISOString().slice(0, 10).replace(/-/g, ''); // YYYYMMDD
  const prefix = `ORD-${dateStr}-`;
  
  // หา sequence number สำหรับวันนี้
  // ใช้ SPLIT_PART เพื่อแยก sequence number ออกมา
  const result = await client.query(
    `SELECT COALESCE(MAX(CAST(SPLIT_PART(order_code, '-', 3) AS INTEGER)), 0) + 1 as next_seq
     FROM concert_ticket.orders
     WHERE order_code LIKE $1`,
    [`${prefix}%`]
  );
  
  const sequence = result.rows[0].next_seq;
  const orderCode = `${prefix}${String(sequence).padStart(4, '0')}`;
  
  return orderCode;
}

exports.purchaseTickets = async (req, res) => {
  const { items } = req.body;
  const userId = req.user.id;
  const client = await pool.connect();

  try {
    // ตรวจสอบว่ามี order ที่ยังเป็น PENDING อยู่หรือไม่
    const pendingOrderCheck = await client.query(
      `SELECT id, order_code, total_amount, created_at 
       FROM concert_ticket.orders 
       WHERE user_id = $1 
       AND status = 'PENDING'
       ORDER BY created_at DESC
       LIMIT 1`,
      [userId]
    );

    if (pendingOrderCheck.rows.length > 0) {
      const pendingOrder = pendingOrderCheck.rows[0];
      const createdTime = new Date(pendingOrder.created_at);
      const now = new Date();
      const timeElapsed = Math.floor((now - createdTime) / 1000 / 60); // นาที
      const timeRemaining = Math.max(0, 10 - timeElapsed);
      
      // คำนวณเวลาที่เหลือในรูปแบบที่อ่านง่าย
      const minutes = Math.floor(timeRemaining);
      const seconds = Math.floor((timeRemaining - minutes) * 60);
      
      let timeMessage = '';
      if (timeRemaining > 0) {
        timeMessage = ` หรือรออีก ${minutes} นาที ${seconds} วินาที เพื่อให้ order ถูกยกเลิกอัตโนมัติ`;
      } else {
        timeMessage = ' (order กำลังจะถูกยกเลิกอัตโนมัติในเร็วๆ นี้)';
      }

      // ไม่ต้อง release client ที่นี่ เพราะ finally block จะจัดการให้
      return res.status(400).json({ 
        success: false, 
        error: `คุณมี order ที่ยังไม่ได้ชำระเงิน (Order Code: ${pendingOrder.order_code || `#${pendingOrder.id}`}) กรุณาชำระเงินก่อนซื้อบัตรเพิ่ม${timeMessage}`,
        pendingOrderId: pendingOrder.id,
        pendingOrderCode: pendingOrder.order_code,
        timeRemaining: timeRemaining,
        orderTotalAmount: pendingOrder.total_amount
      });
    }

    await client.query('BEGIN');
    
    // Generate order code
    const orderCode = await generateOrderCode(client);
    
    let totalAmount = 0;
    const orderItemsData = [];

    // ตรวจสอบว่าบัตรพอและคำนวณราคา
    for (const item of items) {
      const ticketRes = await client.query(
        `SELECT id, price, name, total_quantity, sold_quantity
         FROM concert_ticket.ticket_types 
         WHERE id = $1 FOR UPDATE`,
        [item.ticketTypeId]
      );

      if (ticketRes.rows.length === 0) {
        throw new Error(`Ticket type ID ${item.ticketTypeId} not found`);
      }

      const ticketInfo = ticketRes.rows[0];
      
      // ตรวจสอบว่าบัตรพอ (เช็ค sold + จำนวนที่ต้องการ)
      if (ticketInfo.sold_quantity + item.quantity > ticketInfo.total_quantity) {
        throw new Error(`บัตร ID ${item.ticketTypeId} (${ticketInfo.name}) ไม่พอ (เหลือ ${ticketInfo.total_quantity - ticketInfo.sold_quantity} ใบ)`);
      }

      totalAmount += parseFloat(ticketInfo.price) * item.quantity;
      
      orderItemsData.push({
        ticketTypeId: item.ticketTypeId,
        quantity: item.quantity,
        price: ticketInfo.price
      });
    }

    // สร้าง order พร้อม order_code
    const orderRes = await client.query(
      `INSERT INTO concert_ticket.orders (user_id, total_amount, status, order_code)
       VALUES ($1, $2, 'PENDING', $3) RETURNING id, order_code`,
      [userId, totalAmount, orderCode]
    );
    const orderId = orderRes.rows[0].id;
    const finalOrderCode = orderRes.rows[0].order_code;

    // สร้าง order items และตัดสต็อกทันที
    for (const item of orderItemsData) {
      // สร้าง order item
      await client.query(
        `INSERT INTO concert_ticket.order_items (order_id, ticket_type_id, quantity, price_per_unit)
         VALUES ($1, $2, $3, $4)`,
        [orderId, item.ticketTypeId, item.quantity, item.price]
      );

      // ตัดสต็อกทันที (เพิ่ม sold_quantity)
      await client.query(
        `UPDATE concert_ticket.ticket_types 
         SET sold_quantity = sold_quantity + $1
         WHERE id = $2`,
        [item.quantity, item.ticketTypeId]
      );
    }

    await client.query('COMMIT');
    res.status(201).json({ 
      success: true, 
      orderId, 
      orderCode: finalOrderCode,
      message: 'Purchase successful' 
    });
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
      `SELECT o.id, o.order_code, o.total_amount, o.status, o.created_at,
        json_agg(json_build_object('name', t.name, 'qty', oi.quantity)) as items
       FROM concert_ticket.orders o
       JOIN concert_ticket.order_items oi ON o.id = oi.order_id
       JOIN concert_ticket.ticket_types t ON oi.ticket_type_id = t.id
       WHERE o.user_id = $1
       GROUP BY o.id, o.order_code
       ORDER BY o.created_at DESC`,
      [req.user.id]
    );
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.getOrderById = async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query(
      `SELECT o.id, o.order_code, o.total_amount, o.status, o.created_at,
        json_agg(json_build_object('name', t.name, 'qty', oi.quantity)) as items
       FROM concert_ticket.orders o
       JOIN concert_ticket.order_items oi ON o.id = oi.order_id
       JOIN concert_ticket.ticket_types t ON oi.ticket_type_id = t.id
       WHERE o.id = $1 AND o.user_id = $2
       GROUP BY o.id, o.order_code`,
      [id, req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Order not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// API สำหรับตรวจสอบและยกเลิก order ที่หมดเวลา (สำหรับ admin)
exports.checkExpiredOrders = async (req, res) => {
  try {
    // ตรวจสอบว่าเป็น admin หรือไม่
    if (req.user.role !== 'ADMIN') {
      return res.status(403).json({ 
        success: false, 
        message: 'Only admin can check expired orders' 
      });
    }

    const result = await checkAndCancelExpiredOrders();
    res.json(result);
  } catch (error) {
    console.error('Check expired orders error:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
};