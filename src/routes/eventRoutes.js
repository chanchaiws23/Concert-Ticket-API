const express = require('express');
const router = express.Router();
const { createEvent, getEventDetail, getEvents } = require('../controllers/eventController');
const { authenticateToken, requireOrganizer } = require('../middlewares/authMiddleware');

router.get('/', getEvents);
router.get('/:id', getEventDetail);
router.post('/', authenticateToken, requireOrganizer, createEvent); 

module.exports = router;