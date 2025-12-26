const pool = require('../config/db');
const QRCode = require('qrcode');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const FormData = require('form-data');

// Configure multer for file upload
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = 'uploads/temp';
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'slip-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ storage: storage });

// Helper function to generate payment code
function generatePaymentCode() {
  const timestamp = Date.now();
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `PAY${timestamp}${random}`;
}

// Helper function to generate PromptPay QR Code payload
// Reference: EMV QR Code Specification and PromptPay Implementation
function generatePromptPayPayload(phoneNumber, amount) {
  // Remove dashes and spaces from phone number
  const cleanPhone = phoneNumber.replace(/[-\s]/g, '');
  
  if (!cleanPhone || cleanPhone.length === 0) {
    throw new Error('Phone number is required');
  }
  
  // PromptPay EMV QR Code Format
  // Structure: [ID][Length][Value]
  
  // 00 = Payload Format Indicator (always 01 for EMV QR Code)
  let payload = '000201';
  
  // 01 = Point of Initiation Method
  // 11 = Static (no amount), 12 = Dynamic (with amount)
  payload += '010212';
  
  // 29 = Merchant Account Information
  // Format: 29[Length][00[Length][AID][ID Type[Length][ID Value]]]
  let merchantInfo = '';
  
  // 00 = Globally Unique Identifier
  const guid = 'A000000677010111'; // PromptPay AID
  merchantInfo += '0016' + guid;
  
  // PromptPay ID Type:
  // 01 = Phone Number (remove leading 0, add country code 66)
  // 02 = National ID (13 digits)
  // 03 = e-Wallet ID (15 digits)
  
  let promptPayId = '';
  
  if (cleanPhone.startsWith('0')) {
    // Phone number: remove leading 0 and add country code 0066 (13 digits total)
    const phoneWithoutZero = cleanPhone.substring(1);
    if (phoneWithoutZero.length !== 9) {
      throw new Error('Invalid phone number length. Must be 10 digits (0XXXXXXXXX)');
    }
    // PromptPay requires 13 digits: 0066 + 9 digits
    const phoneWithCountryCode = '0066' + phoneWithoutZero;
    const phoneLength = String(phoneWithCountryCode.length).padStart(2, '0');
    // Format: 01[Length][Phone with country code]
    promptPayId = `01${phoneLength}${phoneWithCountryCode}`;
  } else if (cleanPhone.length === 13) {
    // National ID (13 digits)
    const idLength = String(cleanPhone.length).padStart(2, '0');
    // Format: 02[Length][National ID]
    promptPayId = `02${idLength}${cleanPhone}`;
  } else {
    throw new Error('Invalid PromptPay account format. Use phone number (starting with 0) or 13-digit National ID');
  }
  
  merchantInfo += promptPayId;
  
  // Add Merchant Account Information to payload
  // Format: 29[Length][Merchant Info]
  const merchantInfoLength = String(merchantInfo.length).padStart(2, '0');
  payload += `29${merchantInfoLength}${merchantInfo}`;
  
  // 53 = Currency Code (764 = Thai Baht)
  payload += '5303764';
  
  // 54 = Transaction Amount (only if amount > 0)
  if (amount && amount > 0) {
    const amountStr = amount.toFixed(2);
    const amountLength = String(amountStr.length).padStart(2, '0');
    // Format: 54[Length][Amount]
    payload += `54${amountLength}${amountStr}`;
  }
  
  // 58 = Country Code (TH = Thailand)
  payload += '5802TH';
  
  // 63 = CRC (Checksum)
  // Calculate CRC16 for payload + '6304'
  const crcString = '6304';
  const crc = calculateCRC16(payload + crcString);
  const crcHex = crc.toString(16).toUpperCase().padStart(4, '0');
  payload += crcString + crcHex;
  
  return payload;
}

// CRC16 calculation for EMV QR Code (CRC-16/CCITT-FALSE)
function calculateCRC16(data) {
  const polynomial = 0x1021;
  let crc = 0xFFFF;
  
  for (let i = 0; i < data.length; i++) {
    const byte = data.charCodeAt(i);
    crc ^= (byte << 8);
    
    for (let j = 0; j < 8; j++) {
      if (crc & 0x8000) {
        crc = ((crc << 1) ^ polynomial) & 0xFFFF;
      } else {
        crc = (crc << 1) & 0xFFFF;
      }
    }
  }
  
  return crc;
}

// API สร้าง PromptPay QR Code
exports.generateQRCode = async (req, res) => {
  const { amount } = req.body;
  
  if (!amount) {
    return res.status(400).json({ success: false, message: 'amount is required' });
  }

  if (isNaN(amount) || parseFloat(amount) <= 0) {
    return res.status(400).json({ success: false, message: 'amount must be a positive number' });
  }

  try {
    const promptpayAccount = process.env.PROMPTPAY_ACCOUNT || '';
    if (!promptpayAccount) {
      return res.status(500).json({ success: false, message: 'PromptPay account not configured' });
    }

    const payload = generatePromptPayPayload(promptpayAccount, Number(amount));
    
    // Debug: log payload เพื่อตรวจสอบ
    console.log('Generated PromptPay payload:', payload);
    console.log('Payload length:', payload.length);
    console.log('PromptPay Account:', promptpayAccount);
    console.log('Amount:', amount);
    
    // ตรวจสอบว่า payload ไม่ว่างและมีรูปแบบถูกต้อง
    if (!payload || payload.length < 20) {
      return res.status(500).json({ 
        success: false, 
        message: 'Invalid payload generated',
        error: 'Payload is too short or empty'
      });
    }
    
    // ตรวจสอบว่า payload เริ่มต้นด้วย 000201 (EMV QR Code format)
    if (!payload.startsWith('000201')) {
      return res.status(500).json({ 
        success: false, 
        message: 'Invalid payload format',
        error: 'Payload does not start with EMV QR Code format indicator'
      });
    }
    
    // ตรวจสอบว่า payload จบด้วย CRC (6304 + 4 hex digits)
    if (!payload.match(/6304[0-9A-F]{4}$/)) {
      return res.status(500).json({ 
        success: false, 
        message: 'Invalid payload CRC',
        error: 'Payload does not have valid CRC checksum'
      });
    }
    
    // Generate QR Code using Promise
    try {
      const qr_base64 = await QRCode.toDataURL(payload, { 
        width: 300,
        margin: 2,
        errorCorrectionLevel: 'M',
        type: 'image/png',
        quality: 0.92,
        color: {
          dark: '#000000',
          light: '#FFFFFF'
        }
      });
      
      // ตรวจสอบว่า qr_base64 ถูกต้อง
      if (!qr_base64 || !qr_base64.startsWith('data:image/png;base64,')) {
        console.error('Invalid QR code format:', qr_base64 ? qr_base64.substring(0, 50) : 'null');
        return res.status(500).json({ 
          success: false, 
          message: 'Invalid QR code format generated'
        });
      }
      
      console.log('QR code generated successfully, length:', qr_base64.length);
      console.log('QR code preview (first 100 chars):', qr_base64.substring(0, 100));
      
      res.json({ 
        success: true, 
        qr_base64,
        format: 'data_uri',
        mime_type: 'image/png'
      });
    } catch (qrError) {
      console.error('QR generation error:', qrError);
      return res.status(500).json({ 
        success: false, 
        message: 'QR generation failed', 
        error: qrError.message 
      });
    }
  } catch (err) {
    console.error('QR generation error:', err);
    res.status(500).json({ 
      success: false, 
      message: 'QR generation failed', 
      error: err && err.message ? err.message : String(err) 
    });
  }
};

// API manual confirm การชำระเงิน (อัปเดตสถานะเป็น paid)
exports.confirmPayment = async (req, res) => {
  const { order_id, type, displayName, value, amount, completed_at } = req.body;
  const client = await pool.connect();

  try {
    // ตรวจสอบข้อมูลที่จำเป็น
    if (!order_id || !amount) {
      return res.status(400).json({ 
        success: false, 
        message: 'order_id and amount are required' 
      });
    }

    // ตรวจสอบว่า order มีอยู่และเป็นของ user นี้หรือไม่
    const orderCheck = await client.query(
      `SELECT id, total_amount, status, user_id 
       FROM concert_ticket.orders 
       WHERE id = $1`,
      [order_id]
    );

    if (orderCheck.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    const order = orderCheck.rows[0];

    // ตรวจสอบว่าเป็น owner ของ order หรือไม่ (หรือเป็น admin)
    if (req.user.role !== 'ADMIN' && order.user_id !== req.user.id) {
      return res.status(403).json({ 
        success: false, 
        message: 'You are not authorized to confirm this payment' 
      });
    }

    // ตรวจสอบว่า order ยังไม่ได้ชำระเงิน
    if (order.status === 'PAID') {
      return res.status(400).json({ 
        success: false, 
        message: 'Order already paid' 
      });
    }

    // ตรวจสอบว่ามี payment ที่สำเร็จแล้วหรือไม่
    const existingPayment = await client.query(
      `SELECT id FROM concert_ticket.payments 
       WHERE order_id = $1 AND status = 'PAID'`,
      [order_id]
    );

    if (existingPayment.rows.length > 0) {
      return res.status(400).json({ 
        success: false, 
        message: 'Payment already confirmed for this order' 
      });
    }

    await client.query('BEGIN');

    // แปลง completed_at เป็น Date
    let completedAt = completed_at ? new Date(completed_at) : new Date();
    const paymentCode = generatePaymentCode();

    // สร้าง payment record
    const paymentRes = await client.query(
      `INSERT INTO concert_ticket.payments 
       (order_id, payment_code, bank_name, account_name, account_number, amount, status, completed_at)
       VALUES ($1, $2, $3, $4, $5, $6, 'PAID', $7)
       RETURNING id, payment_code, completed_at`,
      [
        order_id,
        paymentCode,
        type || null,
        displayName || null,
        value || null,
        amount,
        completedAt
      ]
    );

    const payment = paymentRes.rows[0];

    // อัปเดต order status เป็น PAID
    // ไม่ต้องเพิ่ม sold_quantity อีก เพราะตัดไปแล้วตอนซื้อ
    await client.query(
      `UPDATE concert_ticket.orders 
       SET status = 'PAID' 
       WHERE id = $1`,
      [order_id]
    );

    await client.query('COMMIT');

    res.json({
      success: true,
      message: 'Payment confirmed',
      data: {
        payment_id: payment.id,
        payment_code: payment.payment_code,
        order_id: order_id,
        completed_at: payment.completed_at
      }
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Confirm payment error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Database error', 
      error: error.message 
    });
  } finally {
    client.release();
  }
};

// Upload middleware สำหรับ verify slip
exports.uploadMiddleware = upload.single('file');

// API อัปโหลดและตรวจสอบสลิป
exports.verifySlipImage = async (req, res) => {
  const { order_id, amount } = req.body;
  
  if (!req.file) {
    return res.status(400).json({ success: false, message: 'file is required' });
  }

  if (!order_id || !amount) {
    // ลบไฟล์ที่อัปโหลดแล้ว
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    return res.status(400).json({ 
      success: false, 
      message: 'order_id and amount are required' 
    });
  }

  const client = await pool.connect();

  try {
    // ตรวจสอบว่า order มีอยู่และเป็นของ user นี้หรือไม่
    const orderCheck = await client.query(
      `SELECT id, total_amount, status, user_id 
       FROM concert_ticket.orders 
       WHERE id = $1`,
      [order_id]
    );

    if (orderCheck.rows.length === 0) {
      if (req.file && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    const order = orderCheck.rows[0];

    if (req.user.role !== 'ADMIN' && order.user_id !== req.user.id) {
      if (req.file && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }
      return res.status(403).json({ 
        success: false, 
        message: 'You are not authorized to verify this payment' 
      });
    }

    // ตรวจสอบว่า order ยังไม่ได้ชำระเงิน
    if (order.status === 'PAID') {
      if (req.file && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }
      return res.status(400).json({ 
        success: false, 
        message: 'Order already paid' 
      });
    }

    // ตรวจสอบว่ามี payment ที่สำเร็จแล้วหรือไม่
    const existingPayment = await client.query(
      `SELECT id FROM concert_ticket.payments 
       WHERE order_id = $1 AND status = 'PAID'`,
      [order_id]
    );

    if (existingPayment.rows.length > 0) {
      if (req.file && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }
      await client.release();
      return res.status(400).json({ 
        success: false, 
        message: 'Payment already confirmed for this order' 
      });
    }

    const urlSlipOK = process.env.SLIPOK_URL;
    const secretKey = process.env.SLIPOK_SECRET_KEY;

    if (!urlSlipOK || !secretKey) {
      if (req.file && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }
      return res.status(500).json({ 
        success: false, 
        message: 'Slip verification service not configured' 
      });
    }

    const formData = new FormData();
    formData.append('files', fs.createReadStream(req.file.path));
    formData.append('log', 'true');
    formData.append('amount', amount);

    let response;
    try {
      response = await axios.post(
        urlSlipOK,
        formData,
        {
          headers: {
            ...formData.getHeaders(),
            'x-authorization': secretKey,
          },
          maxBodyLength: Infinity,
          maxContentLength: Infinity,
          validateStatus: function (status) {
            // รับ status code ทั้งหมด (ไม่ throw error สำหรับ 4xx, 5xx)
            return status >= 200 && status < 600;
          },
        }
      );
    } catch (networkError) {
      // Network error (ไม่มี response จาก server)
      if (req.file && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }
      await client.release();
      console.error('Network error calling SlipOK API:', networkError.message);
      return res.status(500).json({
        success: false,
        message: 'Slip verification service unavailable',
        error: networkError.message
      });
    }

    await client.query('BEGIN');

    // ถ้า slip verification สำเร็จ
    if (response.data && response.data.success) {
      // สร้างชื่อไฟล์ใหม่
      const timestamp = Date.now();
      const originalName = req.file.originalname;
      const extension = path.extname(originalName);
      const newFileName = `slip_${order_id}_${timestamp}${extension}`;
      
      // สร้างโฟลเดอร์ slips ถ้ายังไม่มี
      const slipDir = 'uploads/slips';
      if (!fs.existsSync(slipDir)) {
        fs.mkdirSync(slipDir, { recursive: true });
      }

      const newFilePath = path.join(slipDir, newFileName);

      // ย้ายไฟล์ไปยังโฟลเดอร์ slips
      fs.renameSync(req.file.path, newFilePath);

      // สร้าง payment record ใหม่
      const paymentCode = generatePaymentCode();
      const paymentRes = await client.query(
        `INSERT INTO concert_ticket.payments 
         (order_id, payment_code, amount, slip_image_path, status, completed_at)
         VALUES ($1, $2, $3, $4, 'PAID', CURRENT_TIMESTAMP)
         RETURNING id, payment_code`,
        [order_id, paymentCode, amount, newFilePath]
      );

      // อัปเดต order status เป็น PAID
      // ไม่ต้องเพิ่ม sold_quantity อีก เพราะตัดไปแล้วตอนซื้อ
      await client.query(
        `UPDATE concert_ticket.orders 
         SET status = 'PAID' 
         WHERE id = $1`,
        [order_id]
      );

      await client.query('COMMIT');

      res.json({
        success: true,
        data: response.data,
        slip_path: newFilePath,
        payment_id: paymentRes.rows[0].id,
        payment_code: paymentRes.rows[0].payment_code
      });
    } else {
      // ถ้า verification ไม่สำเร็จ ให้ลบไฟล์
      if (req.file && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }
      await client.query('ROLLBACK');
      
      // ตรวจสอบ status code จาก SlipOK API
      const statusCode = response.status || 400;
      const errorMessage = response.data?.message || response.data?.details?.message || 'Slip verification failed';
      
      return res.status(statusCode).json({ 
        success: false, 
        message: 'slip verification failed',
        error: `Request failed with status code ${statusCode}`,
        details: response.data || {}
      });
    }
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Slip verification error:', err?.response?.data || err.message);
    
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    
    // ตรวจสอบว่าเป็น error จาก API หรือ database error
    if (err?.response?.data) {
      // Error จาก SlipOK API (ควรไม่เกิดขึ้นเพราะใช้ validateStatus แล้ว)
      const statusCode = err.response.status || 400;
      return res.status(statusCode).json({
        success: false,
        message: 'slip verification failed',
        error: `Request failed with status code ${statusCode}`,
        details: err.response.data
      });
    }
    
    // Database error หรือ error อื่นๆ
    res.status(500).json({
      success: false,
      message: 'Slip verification failed',
      error: err.message,
      details: err?.response?.data
    });
  } finally {
    client.release();
  }
};

// API ดึงรูปสลิป
exports.getSlipImage = async (req, res) => {
  const { order_id } = req.params;

  try {
    const result = await pool.query(
      `SELECT slip_image_path, order_id 
       FROM concert_ticket.payments 
       WHERE order_id = $1`,
      [order_id]
    );

    if (result.rows.length === 0 || !result.rows[0].slip_image_path) {
      return res.status(404).json({ success: false, message: 'Slip image not found' });
    }

    const payment = result.rows[0];

    // ตรวจสอบสิทธิ์ (owner หรือ admin)
    const orderCheck = await pool.query(
      `SELECT user_id FROM concert_ticket.orders WHERE id = $1`,
      [order_id]
    );

    if (orderCheck.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    if (req.user.role !== 'ADMIN' && orderCheck.rows[0].user_id !== req.user.id) {
      return res.status(403).json({ 
        success: false, 
        message: 'You are not authorized to view this slip' 
      });
    }

    const imagePath = payment.slip_image_path;

    // ตรวจสอบว่าไฟล์มีอยู่จริง
    if (!fs.existsSync(imagePath)) {
      return res.status(404).json({ success: false, message: 'Image file not found' });
    }

    // ส่งไฟล์รูปภาพ
    res.sendFile(path.resolve(imagePath));
  } catch (error) {
    console.error('Get slip image error:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

// API แสดงรูปภาพจาก path โดยตรง
exports.getImageByFilename = (req, res) => {
  const filename = req.params.filename;
  const imagePath = path.join('uploads', 'slips', filename);

  // ตรวจสอบว่าไฟล์มีอยู่จริง
  if (!fs.existsSync(imagePath)) {
    return res.status(404).json({ success: false, message: 'Image file not found' });
  }

  // ส่งไฟล์รูปภาพ
  res.sendFile(path.resolve(imagePath));
};

