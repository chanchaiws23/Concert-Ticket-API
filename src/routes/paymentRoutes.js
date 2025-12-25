const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middlewares/authMiddleware');
const {
  generateQRCode,
  confirmPayment,
  uploadMiddleware,
  verifySlipImage,
  getSlipImage,
  getImageByFilename
} = require('../controllers/paymentController');

/**
 * @swagger
 * /api/payments/qr:
 *   post:
 *     summary: Generate PromptPay QR Code
 *     tags: [Payments]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - amount
 *             properties:
 *               amount:
 *                 type: number
 *                 description: Payment amount
 *                 example: 1500.00
 *     responses:
 *       200:
 *         description: QR code generated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 qr_base64:
 *                   type: string
 *                   description: Base64 encoded QR code image
 *       400:
 *         description: Invalid request
 *       500:
 *         description: Server error
 */
router.post('/qr', authenticateToken, generateQRCode);

/**
 * @swagger
 * /api/payments/confirm:
 *   post:
 *     summary: Manually confirm payment (Admin/Order owner only)
 *     tags: [Payments]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - order_id
 *               - amount
 *             properties:
 *               order_id:
 *                 type: integer
 *                 description: Order ID
 *               amount:
 *                 type: number
 *                 description: Payment amount
 *               type:
 *                 type: string
 *                 description: Bank type
 *               displayName:
 *                 type: string
 *                 description: Account display name
 *               value:
 *                 type: string
 *                 description: Account number
 *               completed_at:
 *                 type: string
 *                 format: date-time
 *                 description: Payment completion time
 *     responses:
 *       200:
 *         description: Payment confirmed successfully
 *       400:
 *         description: Invalid request
 *       403:
 *         description: Unauthorized
 *       404:
 *         description: Order not found
 *       500:
 *         description: Server error
 */
router.post('/confirm', authenticateToken, confirmPayment);

/**
 * @swagger
 * /api/payments/verify-slip:
 *   post:
 *     summary: Upload and verify payment slip
 *     tags: [Payments]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - file
 *               - order_id
 *               - amount
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *                 description: Payment slip image
 *               order_id:
 *                 type: integer
 *                 description: Order ID
 *               amount:
 *                 type: number
 *                 description: Payment amount
 *     responses:
 *       200:
 *         description: Slip verified successfully
 *       400:
 *         description: Invalid request
 *       403:
 *         description: Unauthorized
 *       404:
 *         description: Order not found
 *       500:
 *         description: Server error
 */
router.post('/verify-slip', authenticateToken, uploadMiddleware, verifySlipImage);

/**
 * @swagger
 * /api/payments/slip/{order_id}:
 *   get:
 *     summary: Get payment slip image by order ID
 *     tags: [Payments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: order_id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Order ID
 *     responses:
 *       200:
 *         description: Slip image file
 *         content:
 *           image/*:
 *             schema:
 *               type: string
 *               format: binary
 *       403:
 *         description: Unauthorized
 *       404:
 *         description: Slip image not found
 *       500:
 *         description: Server error
 */
router.get('/slip/:order_id', authenticateToken, getSlipImage);

/**
 * @swagger
 * /api/payments/image/{filename}:
 *   get:
 *     summary: Get image by filename
 *     tags: [Payments]
 *     parameters:
 *       - in: path
 *         name: filename
 *         required: true
 *         schema:
 *           type: string
 *         description: Image filename
 *     responses:
 *       200:
 *         description: Image file
 *         content:
 *           image/*:
 *             schema:
 *               type: string
 *               format: binary
 *       404:
 *         description: Image file not found
 */
router.get('/image/:filename(*)', getImageByFilename);

module.exports = router;

