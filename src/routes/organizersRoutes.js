const express = require('express');
const router = express.Router();
const { authenticateToken, requireAdmin } = require('../middlewares/authMiddleware');
const { getAllOrganizers, getOrganizerById, createOrganizer, updateOrganizer, deleteOrganizer } = require('../controllers/organizersController');

/**
 * @swagger
 * /api/organizers:
 *   get:
 *     summary: Get all organizers
 *     tags: [Organizers Management]
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
 *         name: search
 *         schema:
 *           type: string
 *         description: Search by company name or email
 *     responses:
 *       200:
 *         description: List of organizers with pagination
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Organizer'
 *                 pagination:
 *                   $ref: '#/components/schemas/Pagination'
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.get('/', authenticateToken, getAllOrganizers);

/**
 * @swagger
 * /api/organizers/{id}:
 *   get:
 *     summary: Get organizer by ID
 *     tags: [Organizers Management]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Organizer ID
 *     responses:
 *       200:
 *         description: Organizer details
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Organizer'
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Organizer not found
 *       500:
 *         description: Server error
 */
router.get('/:id', authenticateToken, getOrganizerById);

/**
 * @swagger
 * /api/organizers:
 *   post:
 *     summary: Create new organizer (Admin only)
 *     tags: [Organizers Management]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - userId
 *               - companyName
 *             properties:
 *               userId:
 *                 type: integer
 *                 description: User ID (must have ORGANIZER role)
 *               companyName:
 *                 type: string
 *     responses:
 *       201:
 *         description: Organizer created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Organizer'
 *       400:
 *         description: Bad request (user must be ORGANIZER role or organizer already exists)
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Admin access required
 *       404:
 *         description: User not found
 *       500:
 *         description: Server error
 */
router.post('/', authenticateToken, requireAdmin, createOrganizer);

/**
 * @swagger
 * /api/organizers/{id}:
 *   put:
 *     summary: Update organizer (Admin only)
 *     tags: [Organizers Management]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Organizer ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - companyName
 *             properties:
 *               companyName:
 *                 type: string
 *     responses:
 *       200:
 *         description: Organizer updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Organizer'
 *       400:
 *         description: Bad request
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Admin access required
 *       404:
 *         description: Organizer not found
 *       500:
 *         description: Server error
 */
router.put('/:id', authenticateToken, requireAdmin, updateOrganizer);

/**
 * @swagger
 * /api/organizers/{id}:
 *   delete:
 *     summary: Delete organizer (Admin only)
 *     tags: [Organizers Management]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Organizer ID
 *     responses:
 *       200:
 *         description: Organizer deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessMessage'
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Admin access required
 *       404:
 *         description: Organizer not found
 *       500:
 *         description: Server error
 */
router.delete('/:id', authenticateToken, requireAdmin, deleteOrganizer);

module.exports = router;

