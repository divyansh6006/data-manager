/**
 * ============================================================================
 * Skill Labs Data Manager - Core Application Service
 *
 * Designed and Developed by:
 *   DIVYANSH KUMAR SHARMA
 *   Associate Product Manager - AI Product and Platforms
 *   Skill Labs Resource Service Private Limited
 *   Phone: +91 6006291486
 *   Email: divyansh6005@gmail.com
 *
 * Description:
 *   Session management, JWT authentication middleware, and role-based guards.
 *
 * Copyright (c) 2026. All rights reserved.
 * ============================================================================
 */

const jwt = require('jsonwebtoken');
const db = require('./db');

const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET || JWT_SECRET.trim() === '') {
  throw new Error(
    'FATAL: JWT_SECRET environment variable is missing or empty. ' +
    'Set a long, random JWT_SECRET before starting the server.'
  );
}

/**
 * Generates a JSON Web Token for the authenticated user and device session.
 * 
 * @param {Object} user - The authenticated user object from the database.
 * @param {string} deviceId - The active device/browser identifier.
 * @returns {string} Signed JWT.
 */
function generateToken(user, deviceId) {
  return jwt.sign(
    {
      id: user.id,
      email: user.company_email,
      role: user.role,
      deviceId: deviceId
    },
    JWT_SECRET,
    { expiresIn: '8h' }
  );
}

/**
 * Express middleware to authenticate API requests using Bearer JWT tokens.
 * Verifies user status, active state, and handles single-session active device tracking.
 * 
 * @param {Object} req - Express request object.
 * @param {Object} res - Express response object.
 * @param {Function} next - Express next middleware callback.
 */
async function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);

    // Fetch user from DB to verify active status and session device conflict
    const user = await db('users').where({ id: decoded.id }).first();

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (!user.active) {
      return res.status(403).json({ error: 'User account is inactive' });
    }

    // Single session check: if the database device_id has changed, invalidate current session
    if (decoded.deviceId && user.device_id !== decoded.deviceId) {
      return res.status(401).json({ error: 'Session terminated. Logged in from another device/browser.' });
    }

    req.user = user;
    req.sessionDeviceId = decoded.deviceId;
    next();
  } catch (err) {
    return res.status(403).json({ error: 'Invalid or expired token' });
  }
}

/**
 * Express middleware to restrict API endpoint access to authorized user roles.
 * 
 * @param {string[]} allowedRoles - Array of roles permitted to access the resource (e.g. ['admin', 'counselor']).
 * @returns {Function} Express middleware callback.
 */
function requireRole(allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Forbidden: Insufficient permissions' });
    }

    next();
  };
}

module.exports = {
  generateToken,
  authenticateToken,
  requireRole,
  JWT_SECRET
};