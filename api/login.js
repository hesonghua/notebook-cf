import { withDatabase, withErrorHandling, parseRequestBody } from './_utils/db-handler.js';
import { verifyPassword, generateJWT, validateTurnstile } from './_utils/_auth.js';
import { executeQuery } from './_utils/_db.js';




async function loginHandler(request, env) {
  if (request.method !== 'POST') {
    return Response.json(
      { success: false, message: 'Method Not Allowed' },
      { status: 405 }
    );
  }

  const body = await parseRequestBody(request);
  const { username, password, turnstileToken } = body;

  if (env.TURNSTILE_ENABLED === 'true') {
    if (!turnstileToken) {
      return Response.json(
        { success: false, message: 'Turnstile verification required' },
        { status: 400 }
      );
    }

    const ip = request.headers.get('CF-Connecting-IP') || request.headers.get('X-Forwarded-For') || 'unknown';
    const validation = await validateTurnstile(turnstileToken, ip, env.TURNSTILE_SECRET_KEY);
    if (!validation.success) {
      console.log('Invalid turnstile token:', validation['error-codes']);
      return Response.json(
        { success: false, message: 'Invalid verification' },
        { status: 400 }
      );
    }
  }

  if (!username || !password) {
    return Response.json(
      { success: false, message: 'Username and password are required' },
      { status: 400 }
    );
  }

  return await withDatabase(async (db) => {
    const result = await executeQuery(db, 'SELECT * FROM users WHERE username = ?', [username]);
    
    if (result.rows.length === 0) {
      return Response.json(
        { success: false, message: 'Invalid credentials' },
        { status: 401 }
      );
    }

    const user = result.rows[0];
    const isPasswordValid = await verifyPassword(password, user.password);

    if (!isPasswordValid) {
      return Response.json(
        { success: false, message: 'Invalid credentials' },
        { status: 401 }
      );
    }

    const token = await generateJWT({ userId: user.id }, env.JWT_SECRET);
    
    return Response.json(
      { success: true, token },
      { status: 200 }
    );
  }, env);
}

export default withErrorHandling(loginHandler);