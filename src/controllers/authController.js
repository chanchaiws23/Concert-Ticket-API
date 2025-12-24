const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../config/db');

exports.register = async (req, res) => {
  const { email, password, role, firstName, lastName, companyName } = req.body;
  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    const hashedPassword = await bcrypt.hash(password, 10);

    const userRes = await client.query(
      `INSERT INTO concert_ticket.users (email, password_hash, role, first_name, last_name) 
       VALUES ($1, $2, $3, $4, $5) RETURNING id`,
      [email, hashedPassword, role || 'USER', firstName, lastName]
    );
    const userId = userRes.rows[0].id;

    if (role === 'ORGANIZER' && companyName) {
      await client.query(
        `INSERT INTO concert_ticket.organizers (user_id, company_name) VALUES ($1, $2)`,
        [userId, companyName]
      );
    }

    await client.query('COMMIT');
    res.status(201).json({ message: 'User registered successfully' });
  } catch (error) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: error.message });
  } finally {
    client.release();
  }
};

exports.login = async (req, res) => {
  const { email, password } = req.body;
  try {
    const result = await pool.query(
      `SELECT u.*, o.id as organizer_id 
       FROM concert_ticket.users u
       LEFT JOIN concert_ticket.organizers o ON u.id = o.user_id
       WHERE u.email = $1`, 
      [email]
    );

    if (result.rows.length === 0) return res.status(400).json({ message: 'User not found' });
    const user = result.rows[0];

    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) return res.status(400).json({ message: 'Invalid credentials' });

    const token = jwt.sign(
      { id: user.id, role: user.role, organizerId: user.organizer_id },
      process.env.JWT_SECRET,
      { expiresIn: '1d' }
    );

    res.json({ token, role: user.role, name: user.first_name });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};