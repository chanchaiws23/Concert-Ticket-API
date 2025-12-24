const jwt = require('jsonwebtoken');

exports.authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) return res.status(401).json({ message: 'Unauthorized' });

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ message: 'Invalid Token' });
    req.user = user; // ใน JS บรรทัดนี้ผ่านฉลุย ไม่ต้อง declare type
    next();
  });
};

exports.requireOrganizer = (req, res, next) => {
  if (req.user?.role !== 'ORGANIZER') {
    return res.status(403).json({ message: 'Organizer access required' });
  }
  next();
};

exports.requireAdmin = (req, res, next) => {
  if (req.user?.role !== 'ADMIN') {
    return res.status(403).json({ message: 'Admin access required' });
  }
  next();
};