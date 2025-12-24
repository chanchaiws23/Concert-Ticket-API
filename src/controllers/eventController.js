const pool = require('../config/db');

exports.getEvents = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT e.*, 
        COALESCE(json_agg(json_build_object(
          'id', t.id,
          'name', t.name,
          'price', t.price,
          'total_quantity', t.total_quantity,
          'sold_quantity', t.sold_quantity
        )) FILTER (WHERE t.id IS NOT NULL), '[]') as ticket_types
       FROM concert_ticket.events e
       LEFT JOIN concert_ticket.ticket_types t ON e.id = t.event_id
       WHERE e.is_published = TRUE
       GROUP BY e.id
       ORDER BY e.event_date ASC`
    );
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.getEventDetail = async (req, res) => {
  const { id } = req.params;
  try {
    const eventRes = await pool.query(`SELECT * FROM concert_ticket.events WHERE id = $1`, [id]);
    const ticketsRes = await pool.query(`SELECT * FROM concert_ticket.ticket_types WHERE event_id = $1`, [id]);
    
    if (eventRes.rows.length === 0) return res.status(404).json({ message: 'Event not found' });
    res.json({ ...eventRes.rows[0], ticket_types: ticketsRes.rows });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.createEvent = async (req, res) => {
  const { title, description, venue, eventDate, posterUrl, ticketTypes } = req.body;
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    const eventRes = await client.query(
      `INSERT INTO concert_ticket.events (organizer_id, title, description, venue, event_date, poster_url, is_published)
       VALUES ($1, $2, $3, $4, $5, $6, TRUE) RETURNING id`,
      [req.user.organizerId, title, description, venue, eventDate, posterUrl]
    );
    const eventId = eventRes.rows[0].id;

    for (const ticket of ticketTypes) {
      const quantity = ticket.total_quantity || ticket.quantity;
      await client.query(
        `INSERT INTO concert_ticket.ticket_types (event_id, name, price, total_quantity)
         VALUES ($1, $2, $3, $4)`,
        [eventId, ticket.name, ticket.price, quantity]
      );
    }

    await client.query('COMMIT');
    res.status(201).json({ id: eventId, message: 'Event created successfully' });
  } catch (error) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: error.message });
  } finally {
    client.release();
  }
};

exports.getOrganizerEvents = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT e.*, 
        COALESCE(json_agg(json_build_object(
          'id', t.id,
          'name', t.name,
          'price', t.price,
          'total_quantity', t.total_quantity,
          'sold_quantity', t.sold_quantity
        )) FILTER (WHERE t.id IS NOT NULL), '[]') as ticket_types
       FROM concert_ticket.events e
       LEFT JOIN concert_ticket.ticket_types t ON e.id = t.event_id
       WHERE e.organizer_id = $1
       GROUP BY e.id
       ORDER BY e.event_date ASC`,
      [req.user.organizerId]
    );
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.updateEvent = async (req, res) => {
  const { id } = req.params;
  const { title, description, venue, eventDate, posterUrl, ticketTypes } = req.body;
  const client = await pool.connect();

  try {
    // ตรวจสอบว่า event เป็นของ organizer นี้หรือไม่
    const eventCheck = await client.query(
      `SELECT organizer_id FROM concert_ticket.events WHERE id = $1`,
      [id]
    );

    if (eventCheck.rows.length === 0) {
      return res.status(404).json({ message: 'Event not found' });
    }

    if (eventCheck.rows[0].organizer_id !== req.user.organizerId) {
      return res.status(403).json({ message: 'You are not authorized to update this event' });
    }

    await client.query('BEGIN');

    // อัปเดต event
    if (title || description || venue || eventDate || posterUrl) {
      const updateFields = [];
      const updateValues = [];
      let paramCount = 1;

      if (title) {
        updateFields.push(`title = $${paramCount++}`);
        updateValues.push(title);
      }
      if (description) {
        updateFields.push(`description = $${paramCount++}`);
        updateValues.push(description);
      }
      if (venue) {
        updateFields.push(`venue = $${paramCount++}`);
        updateValues.push(venue);
      }
      if (eventDate) {
        updateFields.push(`event_date = $${paramCount++}`);
        updateValues.push(eventDate);
      }
      if (posterUrl) {
        updateFields.push(`poster_url = $${paramCount++}`);
        updateValues.push(posterUrl);
      }

      updateValues.push(id);
      await client.query(
        `UPDATE concert_ticket.events SET ${updateFields.join(', ')} WHERE id = $${paramCount}`,
        updateValues
      );
    }

    // อัปเดต ticket types ถ้ามี
    if (ticketTypes && Array.isArray(ticketTypes)) {
      for (const ticket of ticketTypes) {
        if (ticket.id) {
          // อัปเดต ticket type ที่มีอยู่
          await client.query(
            `UPDATE concert_ticket.ticket_types 
             SET name = $1, price = $2, total_quantity = $3 
             WHERE id = $4 AND event_id = $5`,
            [ticket.name, ticket.price, ticket.total_quantity || ticket.quantity, ticket.id, id]
          );
        } else {
          // สร้าง ticket type ใหม่
          await client.query(
            `INSERT INTO concert_ticket.ticket_types (event_id, name, price, total_quantity)
             VALUES ($1, $2, $3, $4)`,
            [id, ticket.name, ticket.price, ticket.total_quantity || ticket.quantity]
          );
        }
      }
    }

    await client.query('COMMIT');
    res.json({ message: 'Event updated successfully' });
  } catch (error) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: error.message });
  } finally {
    client.release();
  }
};

exports.deleteEvent = async (req, res) => {
  const { id } = req.params;
  const client = await pool.connect();

  try {
    // ตรวจสอบว่า event เป็นของ organizer นี้หรือไม่
    const eventCheck = await client.query(
      `SELECT organizer_id FROM concert_ticket.events WHERE id = $1`,
      [id]
    );

    if (eventCheck.rows.length === 0) {
      return res.status(404).json({ message: 'Event not found' });
    }

    if (eventCheck.rows[0].organizer_id !== req.user.organizerId) {
      return res.status(403).json({ message: 'You are not authorized to delete this event' });
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