const express = require('express');
const router = express.Router();
const { authenticateToken, requireOrganizer, requireAdmin } = require('../middlewares/authMiddleware');
const { getAllTicketTypes, getTicketTypeById, createTicketType, updateTicketType, deleteTicketType } = require('../controllers/ticketTypesController');

/**
 * @swagger
 * /api/ticket-types:
 *   get:
 *     summary: Get all ticket types
 *     tags: [Ticket Types Management]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *         description: Items per page
 *       - in: query
 *         name: eventId
 *         schema:
 *           type: integer
 *         description: Filter by event ID
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search by ticket name or event title
 *     responses:
 *       200:
 *         description: List of ticket types with pagination
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/TicketType'
 *                 pagination:
 *                   $ref: '#/components/schemas/Pagination'
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.get('/', authenticateToken, getAllTicketTypes);

/**
 * @swagger
 * /api/ticket-types/{id}:
 *   get:
 *     summary: Get ticket type by ID
 *     tags: [Ticket Types Management]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Ticket Type ID
 *     responses:
 *       200:
 *         description: Ticket type details
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/TicketType'
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Ticket type not found
 *       500:
 *         description: Server error
 */
router.get('/:id', authenticateToken, getTicketTypeById);

/**
 * @swagger
 * /api/ticket-types:
 *   post:
 *     summary: Create new ticket type (Organizer/Admin only)
 *     tags: [Ticket Types Management]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - eventId
 *               - name
 *               - price
 *               - totalQuantity
 *             properties:
 *               eventId:
 *                 type: integer
 *               name:
 *                 type: string
 *               price:
 *                 type: number
 *                 format: float
 *               totalQuantity:
 *                 type: integer
 *     responses:
 *       201:
 *         description: Ticket type created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/TicketType'
 *       400:
 *         description: Bad request
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Not authorized (must be organizer of the event or admin)
 *       404:
 *         description: Event not found
 *       500:
 *         description: Server error
 */
router.post('/', authenticateToken, createTicketType);

/**
 * @swagger
 * /api/ticket-types/{id}:
 *   put:
 *     summary: Update ticket type (Organizer/Admin only)
 *     tags: [Ticket Types Management]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Ticket Type ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               price:
 *                 type: number
 *                 format: float
 *               totalQuantity:
 *                 type: integer
 *     responses:
 *       200:
 *         description: Ticket type updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/TicketType'
 *       400:
 *         description: Bad request (totalQuantity cannot be less than sold_quantity)
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Not authorized (must be organizer of the event or admin)
 *       404:
 *         description: Ticket type not found
 *       500:
 *         description: Server error
 */
router.put('/:id', authenticateToken, updateTicketType);

/**
 * @swagger
 * /api/ticket-types/{id}:
 *   delete:
 *     summary: Delete ticket type (Organizer/Admin only)
 *     tags: [Ticket Types Management]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Ticket Type ID
 *     responses:
 *       200:
 *         description: Ticket type deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessMessage'
 *       400:
 *         description: Cannot delete ticket type with sold tickets
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Not authorized (must be organizer of the event or admin)
 *       404:
 *         description: Ticket type not found
 *       500:
 *         description: Server error
 */
router.delete('/:id', authenticateToken, deleteTicketType);

module.exports = router;

