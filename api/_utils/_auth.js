// 使用 Web Crypto API 替代 bcryptjs 和 jsonwebtoken

export async function validateTurnstile(token, remoteip, secretKey) {
  if (!secretKey) {
    console.error('Turnstile secret key not provided');
    return { success: false, 'error-codes': ['missing-secret-key'] };
  }

  try {
    const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            secret: secretKey,
            response: token,
            remoteip: remoteip
        })
    });

    const result = await response.json();
    return result;
  } catch (error) {
    console.error('Turnstile validation error:', error);
    return { success: false, 'error-codes': ['internal-error'] };
  }
}

/**
 * 使用 Web Crypto API 进行密码哈希
 * @param {string} password 
 * @returns {Promise<string>}
 */
export async function hashPassword(password) {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * 验证密码
 * @param {string} password 
 * @param {string} hashedPassword 
 * @returns {Promise<boolean>}
 */
export async function verifyPassword(password, hashedPassword) {
  const hashOfInput = await hashPassword(password);
  return hashOfInput === hashedPassword;
}

/**
 * 生成 JWT token
 * @param {Object} payload 
 * @param {string} secret 
 * @returns {Promise<string>}
 */
export async function generateJWT(payload, secret) {
  const header = {
    alg: 'HS256',
    typ: 'JWT'
  };

  const now = Math.floor(Date.now() / 1000);
  const jwtPayload = {
    ...payload,
    iat: now,
    exp: now + (180 * 24 * 60 * 60) // 180 days
  };

  const encoder = new TextEncoder();
  
  // Encode header and payload
  const encodedHeader = btoa(JSON.stringify(header)).replace(/[=]/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  const encodedPayload = btoa(JSON.stringify(jwtPayload)).replace(/[=]/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  
  // Create signature
  const data = `${encodedHeader}.${encodedPayload}`;
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(data));
  const encodedSignature = btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/[=]/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  
  return `${data}.${encodedSignature}`;
}

/**
 * 验证 JWT token
 * @param {string} token 
 * @param {string} secret 
 * @returns {Promise<Object>}
 */
export async function verifyJWT(token, secret) {
  const parts = token.split('.');
  if (parts.length !== 3) {
    throw new Error('Invalid token format');
  }

  const [encodedHeader, encodedPayload, encodedSignature] = parts;
  
  // Verify signature
  const encoder = new TextEncoder();
  const data = `${encodedHeader}.${encodedPayload}`;
  
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['verify']
  );

  // Decode signature for verification
  const signature = Uint8Array.from(atob(encodedSignature.replace(/-/g, '+').replace(/_/g, '/').padEnd(encodedSignature.length + (4 - encodedSignature.length % 4) % 4, '=')), c => c.charCodeAt(0));
  
  const isValid = await crypto.subtle.verify('HMAC', key, signature, encoder.encode(data));
  
  if (!isValid) {
    throw new Error('Invalid token signature');
  }

  // Decode payload
  const payload = JSON.parse(atob(encodedPayload.replace(/-/g, '+').replace(/_/g, '/').padEnd(encodedPayload.length + (4 - encodedPayload.length % 4) % 4, '=')));
  
  // Check expiration
  const now = Math.floor(Date.now() / 1000);
  if (payload.exp && payload.exp < now) {
    throw new Error('Token expired');
  }

  return payload;
}

/**
 * 验证请求中的 token
 * @param {Request} request 
 * @param {string} secret 
 * @returns {Promise<Object>}
 */
export async function authenticateToken(request, secret) {
  const authHeader = request.headers.get('authorization');
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    const error = new Error('Unauthorized');
    error.status = 401;
    throw error;
  }

  try {
    const payload = await verifyJWT(token, secret);
    return { userId: payload.userId };
  } catch (err) {
    const error = new Error('Forbidden');
    error.status = 403;
    throw error;
  }
}
