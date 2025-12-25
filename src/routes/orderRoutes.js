const express = require('express');
const router = express.Router();
const { getMyOrders, purchaseTickets, getOrderById, checkExpiredOrders } = require('../controllers/orderController');
const { authenticateToken } = require('../middlewares/authMiddleware');

/**
 * @swagger
 * /api/orders/purchase:
 *   post:
 *     summary: Purchase tickets for events
 *     tags: [Orders]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/PurchaseTicketsRequest'
 *           example:
 *             items:
 *               - ticketTypeId: 1
 *                 quantity: 2
 *               - ticketTypeId: 2
 *                 quantity: 1
 *     responses:
 *       201:
 *         description: Tickets purchased successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/PurchaseTicketsResponse'
 *       400:
 *         description: Bad request (e.g., tickets sold out, or has pending order)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 error:
 *                   type: string
 *                   example: "You have a pending order. Please complete payment first."
 *                 pendingOrderId:
 *                   type: integer
 *                   description: ID ของ order ที่ยังไม่ได้ชำระเงิน (ถ้ามี)
 *                   example: 123
 *                 timeRemaining:
 *                   type: number
 *                   description: เวลาที่เหลือ (นาที) ก่อน order จะถูกยกเลิกอัตโนมัติ (ถ้ามี)
 *                   example: 5.5
 *                 orderTotalAmount:
 *                   type: number
 *                   description: จำนวนเงินของ order ที่ค้างชำระ (ถ้ามี)
 *                   example: 1500
 *             examples:
 *               pendingOrder:
 *                 summary: Has pending order
 *                 value:
 *                   success: false
 *                   error: "You have a pending order (Order ID: 123). Please complete payment first or wait for auto cancellation."
 *                   pendingOrderId: 123
 *                   timeRemaining: 5.5
 *                   orderTotalAmount: 1500
 *               ticketsSoldOut:
 *                 summary: Tickets sold out
 *                 value:
 *                   success: false
 *                   error: "Ticket ID 1 (VIP) is not available (only 5 tickets left)"
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Unauthorized
 */
router.post('/purchase', authenticateToken, purchaseTickets);

/**
 * @swagger
 * /api/orders/my-orders:
 *   get:
 *     summary: Get current user's orders
 *     tags: [Orders]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of user's orders
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Order'
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Unauthorized
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get('/my-orders', authenticateToken, getMyOrders);

/**
 * @swagger
 * /api/orders/{id}:
 *   get:
 *     summary: Get order details by ID (own orders only)
 *     tags: [Orders]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Order ID
 *     responses:
 *       200:
 *         description: Order details
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Order'
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Unauthorized
 *       403:
 *         description: Forbidden (not the owner of the order)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: You are not authorized to view this order
 *       404:
 *         description: Order not found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Order not found
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get('/:id', authenticateToken, getOrderById);

/**
 * @swagger
 * /api/orders/check-expired:
 *   post:
 *     summary: Check and cancel expired orders (Admin only)
 *     tags: [Orders]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Expired orders check result
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 cancelled:
 *                   type: integer
 *                   description: Number of cancelled orders
 *                 errors:
 *                   type: integer
 *                   description: Number of errors
 *                 message:
 *                   type: string
 *       403:
 *         description: Forbidden (not admin)
 *       500:
 *         description: Server error
 */
router.post('/check-expired', authenticateToken, checkExpiredOrders);

module.exports = router;