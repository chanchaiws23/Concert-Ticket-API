const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const swaggerUi = require('swagger-ui-express');
const swaggerSpec = require('./config/swagger');
const cron = require('node-cron');
const { checkAndCancelExpiredOrders } = require('./services/orderCancellationService');
require('dotenv').config();

// Routes
const authRoutes = require('./routes/authRoutes');
const eventRoutes = require('./routes/eventRoutes');
const orderRoutes = require('./routes/orderRoutes');
const organizerRoutes = require('./routes/organizerRoutes');
const userRoutes = require('./routes/userRoutes');
const adminRoutes = require('./routes/adminRoutes');
const usersRoutes = require('./routes/usersRoutes');
const organizersRoutes = require('./routes/organizersRoutes');
const ticketTypesRoutes = require('./routes/ticketTypesRoutes');
const paymentRoutes = require('./routes/paymentRoutes');

const app = express();

app.use(cors());
app.use(helmet());
app.use(express.json());

// Swagger Documentation
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

app.use('/api/auth', authRoutes);
app.use('/api/events', eventRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/organizer', organizerRoutes);
app.use('/api/user', userRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/organizers', organizersRoutes);
app.use('/api/ticket-types', ticketTypesRoutes);
app.use('/api/payments', paymentRoutes);

/**
 * @swagger
 * /:
 *   get:
 *     summary: Health check endpoint
 *     tags: [Health]
 *     responses:
 *       200:
 *         description: API is running
 *         content:
 *           text/plain:
 *             schema:
 *               type: string
 *               example: API Running (JavaScript Mode)
 */
app.get('/', (req, res) => {
  res.send('API Running (JavaScript Mode)');
});

// Scheduled task: ตรวจสอบและยกเลิก order ที่หมดเวลา ทุก 1 นาที
cron.schedule('* * * * *', async () => {
  try {
    const result = await checkAndCancelExpiredOrders();
    if (result.cancelled > 0) {
      console.log(`[Cron] ${result.message}`);
    }
  } catch (error) {
    console.error('[Cron] Error checking expired orders:', error);
  }
});

console.log('Scheduled task started: Checking expired orders every minute');

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});