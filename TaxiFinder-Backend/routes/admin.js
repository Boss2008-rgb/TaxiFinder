'use strict';
const express = require('express');
const router  = express.Router();
const jwt     = require('jsonwebtoken');

// POST /api/admin/login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    const adminEmail    = process.env.ADMIN_EMAIL;
    const adminPassword = process.env.ADMIN_PASSWORD;
    
    if (email !== adminEmail || password !== adminPassword) {
      return res.status(401).json({ error: 'بيانات خاطئة' });
    }
    
    const token = jwt.sign(
      { email, role: 'admin' },
      process.env.JWT_SECRET || 'secret',
      { expiresIn: '24h' }
    );
    
    res.json({ token, email });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/status', (req, res) => {
  res.json({ status: 'admin ok' });
});

module.exports = router;