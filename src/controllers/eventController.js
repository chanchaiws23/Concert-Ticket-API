const pool = require('../config/db');

exports.getEvents = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT * FROM concert_ticket.events WHERE is_published = TRUE ORDER BY event_date ASC`
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
      await client.query(
        `INSERT INTO concert_ticket.ticket_types (event_id, name, price, total_quantity)
         VALUES ($1, $2, $3, $4)`,
        [eventId, ticket.name, ticket.price, ticket.quantity]
      );
    }

    await client.query('COMMIT');
    res.status(201).json({ success: true, eventId });
  } catch (error) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: error.message });
  } finally {
    client.release();
  }
};