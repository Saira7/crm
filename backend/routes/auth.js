// routes/auth.js
const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { PrismaClient } = require('@prisma/client');
const { getClientIP, ipMatches } = require('../middleware/ipRestriction');

const prisma = new PrismaClient();
const router = express.Router();

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    // Get client IP
    const clientIP = getClientIP(req);
    console.log(`Login attempt from IP: ${clientIP} for email: ${email}`);

    // Find user with role and IP restrictions
    const user = await prisma.user.findUnique({
      where: { email },
      include: {
        role: {
          include: {
            ipRestrictions: {
              where: { isActive: true }
            }
          }
        },
        team: true
      }
    });

    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Verify password
    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Check IP restrictions BEFORE allowing login
    
    // 1. Check user-level IP restrictions
    if (user.ipRestricted && user.allowedIPs && user.allowedIPs.length > 0) {
      const isAllowed = user.allowedIPs.some(allowedIP => ipMatches(clientIP, allowedIP));
      
      if (!isAllowed) {
        console.log(`❌ Login denied: User ${email} - IP ${clientIP} not authorized`);
        return res.status(403).json({
          error: 'Access denied from this IP address',
          message: 'Your account is restricted to specific IP addresses. Please contact your administrator.',
          clientIP: clientIP
        });
      }
    }

    // 2. Check role-level IP restrictions
    if (user.role.ipRestricted) {
      let isAllowed = false;

      // Check legacy allowedIPs array
      if (user.role.allowedIPs && user.role.allowedIPs.length > 0) {
        isAllowed = user.role.allowedIPs.some(allowedIP => ipMatches(clientIP, allowedIP));
      }

      // Check IPRestriction table
      if (!isAllowed && user.role.ipRestrictions && user.role.ipRestrictions.length > 0) {
        isAllowed = user.role.ipRestrictions.some(restriction => 
          ipMatches(clientIP, restriction.ipAddress)
        );
      }

      if (!isAllowed) {
        console.log(`❌ Login denied: Role ${user.role.name} - IP ${clientIP} not authorized`);
        return res.status(403).json({
          error: 'Access denied from this IP address',
          message: `Your role (${user.role.name}) is restricted to specific IP addresses. Please contact your administrator.`,
          clientIP: clientIP
        });
      }
    }

    console.log(`✅ Login successful: ${email} from ${clientIP}`);

    // Update last login IP and time
    await prisma.user.update({
      where: { id: user.id },
      data: {
        lastLoginIP: clientIP,
        lastLoginAt: new Date()
      }
    });

    // Create JWT token
    const token = jwt.sign(
      { userId: user.id, role: user.role.name },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '24h' }
    );

    // Return user data without password
    const { password: _, ...userWithoutPassword } = user;

    res.json({
      token,
      user: userWithoutPassword
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Server error during login' });
  }
});

module.exports = router;