const pool = require('../config/db');

/**
 * ยกเลิก order ที่เกิน 10 นาทีแล้วยังไม่จ่ายเงิน และคืนสต็อก
 * @returns {Promise<{cancelled: number, errors: number}>}
 */
async function cancelExpiredOrders() {
  const client = await pool.connect();
  let cancelledCount = 0;
  let errorCount = 0;

  try {
    await client.query('BEGIN');

    // หา order ที่เกิน 10 นาทีแล้วยังเป็น PENDING
    // ใช้ FOR UPDATE เพื่อป้องกัน race condition
    const expiredOrders = await client.query(
      `SELECT id, created_at 
       FROM concert_ticket.orders 
       WHERE status = 'PENDING' 
       AND created_at < NOW() - INTERVAL '10 minutes'
       FOR UPDATE`
    );

    console.log(`Found ${expiredOrders.rows.length} expired orders to cancel`);

    for (const order of expiredOrders.rows) {
      try {
        // หา order items เพื่อคืนสต็อก
        const orderItems = await client.query(
          `SELECT ticket_type_id, quantity 
           FROM concert_ticket.order_items 
           WHERE order_id = $1`,
          [order.id]
        );

        // ตรวจสอบอีกครั้งว่า order ยังเป็น PENDING อยู่ (ป้องกัน race condition)
        const orderCheck = await client.query(
          `SELECT status FROM concert_ticket.orders WHERE id = $1 FOR UPDATE`,
          [order.id]
        );

        if (orderCheck.rows.length === 0 || orderCheck.rows[0].status !== 'PENDING') {
          console.log(`Order ${order.id} is no longer PENDING, skipping`);
          continue;
        }

        // คืนสต็อกให้กับ ticket types ทั้งหมด
        for (const item of orderItems.rows) {
          await client.query(
            `UPDATE concert_ticket.ticket_types 
             SET sold_quantity = sold_quantity - $1
             WHERE id = $2 
             AND sold_quantity >= $1`,
            [item.quantity, item.ticket_type_id]
          );
        }

        // เปลี่ยนสถานะ order เป็น CANCELLED
        await client.query(
          `UPDATE concert_ticket.orders 
           SET status = 'CANCELLED' 
           WHERE id = $1`,
          [order.id]
        );

        cancelledCount++;
        console.log(`Cancelled order ${order.id} (created at ${order.created_at})`);
      } catch (error) {
        errorCount++;
        console.error(`Error cancelling order ${order.id}:`, error.message);
      }
    }

    await client.query('COMMIT');
    return { cancelled: cancelledCount, errors: errorCount };
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error in cancelExpiredOrders:', error);
    throw error;
  } finally {
    client.release();
  }
}

/**
 * ตรวจสอบและยกเลิก order ที่หมดเวลา (ใช้เรียกจาก API หรือ scheduled task)
 */
async function checkAndCancelExpiredOrders() {
  try {
    const result = await cancelExpiredOrders();
    return {
      success: true,
      ...result,
      message: `Cancelled ${result.cancelled} expired orders, ${result.errors} errors`
    };
  } catch (error) {
    console.error('checkAndCancelExpiredOrders error:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

module.exports = {
  cancelExpiredOrders,
  checkAndCancelExpiredOrders
};

