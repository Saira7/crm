// backend/middleware/ipRestriction.js
const ipRangeCheck = require('ip-range-check');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Default IP ranges that are always allowed (local development, VPN, etc.)
const DEFAULT_ALLOWED_IPS = [
  '127.0.0.1',
  'localhost',
  '10.0.0.0/8',
  '172.16.0.0/12',
  '192.168.0.0/16',
   '206.84.189.0/24',
   '110.39.173.0/24',
   '79.139.84.0/24',


];

/** Normalize and extract client IP (prefer XFF, then X-Real-IP, then socket) */
function getClientIP(req) {
  const headerXff = req.headers['x-forwarded-for'] || req.headers['X-Forwarded-For'];
  if (typeof headerXff === 'string' && headerXff.trim() !== '') {
    const parts = headerXff.split(',').map(p => p.trim()).filter(Boolean);
    if (parts.length > 0) {
      const ip = parts[0];
      if (ip.startsWith('::ffff:')) return ip.split('::ffff:')[1];
      if (ip === '::1') return '127.0.0.1';
      return ip;
    }
  }

  const xreal = req.headers['x-real-ip'];
  if (typeof xreal === 'string' && xreal.trim() !== '') {
    if (xreal.startsWith('::ffff:')) return xreal.split('::ffff:')[1];
    if (xreal === '::1') return '127.0.0.1';
    return xreal;
  }

  const remote = req.socket && (req.socket.remoteAddress || req.connection?.remoteAddress);
  if (!remote) return null;
  if (remote.startsWith('::ffff:')) return remote.split('::ffff:')[1];
  if (remote === '::1') return '127.0.0.1';
  return remote;
}

/** Convert wildcard like 192.168.1.* -> 192.168.1.0/24 (supports trailing '*' blocks only).
 *  If pattern already looks like CIDR or exact IP, return as-is (after trimming/stripping quotes).
 */
function normalizePattern(raw) {
  if (!raw) return null;
  let p = String(raw).trim();

  // strip surrounding quotes if present
  if ((p.startsWith('"') && p.endsWith('"')) || (p.startsWith("'") && p.endsWith("'"))) {
    p = p.slice(1, -1).trim();
  }

  // If already CIDR-ish, just return
  if (p.includes('/')) return p;

  // If contains wildcard '*', only handle trailing octet wildcards like a.b.c.* or a.b.*.*
  if (p.includes('*')) {
    const parts = p.split('.').map(x => x.trim());
    // Only accept up to 4 parts; ensure non-wildcard parts are numeric
    const normalizedParts = [];
    let wildcardCount = 0;
    for (let i = 0; i < 4; i++) {
      const part = parts[i] ?? '*';
      if (part === '*') {
        wildcardCount++;
        normalizedParts.push('0');
      } else {
        normalizedParts.push(part);
      }
    }
    // Determine prefix length: number of non-wildcard octets * 8
    // Count non-wildcard as parts before first '*'
    let nonWildcard = 0;
    for (const part of parts) {
      if (part === '*') break;
      nonWildcard++;
    }
    const prefix = Math.max(0, Math.min(32, nonWildcard * 8));
    const base = normalizedParts.slice(0, 4).join('.');
    return `${base}/${prefix}`;
  }

  // otherwise return the trimmed pattern (exact ip or host)
  return p;
}

/** ipMatches: uses ip-range-check after normalizing pattern if necessary */
function ipMatches(addr, pattern) {
  if (!addr || !pattern) return false;
  const norm = normalizePattern(pattern);
  if (!norm) return false;
  try {
    return ipRangeCheck(addr, norm);
  } catch (err) {
    // fallback to exact comparison if library throws
    return addr === norm;
  }
}

/**
 * Check if IP matches any pattern in a list
 */
function ipMatchesAny(addr, patterns) {
  if (!addr || !patterns || !Array.isArray(patterns)) return false;
  return patterns.some(pattern => ipMatches(addr, pattern));
}

/**
 * checkIPRestriction middleware (with default IP restrictions)
 */
async function checkIPRestriction(req, res, next) {
  try {
    const clientIP = getClientIP(req) || req.ip || null;

    if (!clientIP) {
      console.warn('checkIPRestriction: cannot determine client IP — denying by default');
      return res.status(403).json({ error: 'Access denied: unknown client IP' });
    }

    // requireAuth should populate req.user with at least { id }
    const requester = req.user;
    if (!requester || !requester.id) {
      return next();
    }

    // fetch fresh user and role restrictions
    const user = await prisma.user.findUnique({
      where: { id: requester.id },
      include: {
        role: {
          include: {
            ipRestrictions: { where: { isActive: true }, orderBy: { createdAt: 'desc' } }
          }
        }
      }
    });

    if (!user) {
      return res.status(403).json({ error: 'Access denied' });
    }

    console.log(`[IP CHECK] Client IP: ${clientIP}, User: ${user.email}, Role: ${user.role?.name}`);

    // ===== STEP 1: Check if user is explicitly exempt from IP restrictions =====
    if (user.ipRestricted === false) {
      console.log(`[IP CHECK] User ${user.email} is exempt from IP restrictions`);
      return next();
    }

    // ===== STEP 2: Check default allowed IPs (always allowed) =====
    if (ipMatchesAny(clientIP, DEFAULT_ALLOWED_IPS)) {
      console.log(`[IP CHECK] IP ${clientIP} matches default allowed ranges`);
      return next();
    }

    // ===== STEP 3: USER-LEVEL WHITELIST (if user has specific restrictions) =====
if (user.ipRestricted) {
  const userPatterns = Array.isArray(user.allowedIPs) ? user.allowedIPs : [];
  console.log('[IP CHECK] Checking user-level patterns:', userPatterns);

  if (userPatterns.length > 0) {
    // Only enforce if user has explicit patterns defined
    if (ipMatchesAny(clientIP, userPatterns)) {
      console.log(`[IP CHECK] User-level IP match for ${clientIP}`);
      return next();
    } else {
      console.warn(`IP DENY (user whitelist) ${clientIP} for user ${user.email}`);
      return res.status(403).json({
        error: 'Access denied from this IP address',
        message: 'Your account is restricted to specific IP addresses. Contact administrator.',
        clientIP
      });
    }
  } else {
    // No user-level patterns — fall through to role-level checks
    console.log('[IP CHECK] No user-level patterns, deferring to role-level');
  }
}


    // ===== STEP 4: ROLE-LEVEL WHITELIST =====
    if (user.role) {
      const legacyRoleIPs = Array.isArray(user.role.allowedIPs) ? user.role.allowedIPs : [];
      const roleRestrictions = Array.isArray(user.role.ipRestrictions) ? 
        user.role.ipRestrictions.map(r => r.ipAddress) : [];

      const allRolePatterns = [...legacyRoleIPs, ...roleRestrictions];
      console.log('[IP CHECK] Checking role-level patterns:', allRolePatterns);

      if (ipMatchesAny(clientIP, allRolePatterns)) {
        console.log(`[IP CHECK] Role-level IP match for ${clientIP}`);
        return next();
      }

      // If role has IP restrictions but IP doesn't match
      if (user.role.ipRestricted && allRolePatterns.length > 0) {
        console.warn(`IP DENY (role whitelist) ${clientIP} for user ${user.email} role ${user.role.name}`);
        return res.status(403).json({
          error: 'Access denied from this IP address',
          message: `Your role (${user.role.name}) is restricted to specific IP addresses. Contact administrator.`,
          clientIP
        });
      }
    }

    // ===== STEP 5: If no specific restrictions found, apply system default restrictions =====
    // You can add system-wide default IP restrictions here if needed
    // For now, we'll allow access if no specific restrictions are set
    
    console.log(`[IP CHECK] No specific IP restrictions found for ${clientIP}, allowing access`);
    return next();

  } catch (err) {
    console.error('checkIPRestriction error:', err);
    // Fail-closed: return 500 (do not silently allow)
    return res.status(500).json({ error: 'IP restriction check failed' });
  }
}

module.exports = {
  getClientIP,
  ipMatches,
  ipMatchesAny,
  checkIPRestriction,
  normalizePattern,
  DEFAULT_ALLOWED_IPS
};