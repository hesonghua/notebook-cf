import { withDatabase, withErrorHandling, parseRequestBody } from './_utils/db-handler.js';
import { hashPassword, validateTurnstile } from './_utils/_auth.js';
import { executeQuery } from './_utils/_db.js';

async function registerHandler(request, env) {
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

  if (password.length < 8) {
    return Response.json(
      { success: false, message: 'Password must be at least 8 characters long' },
      { status: 400 }
    );
  }

  return await withDatabase(async (db) => {
    try {
      const hashedPassword = await hashPassword(password);
      const result = await executeQuery(db, 
        'INSERT INTO users (username, password) VALUES (?, ?) RETURNING id, username',
        [username, hashedPassword]
      );
      
      return Response.json(
        { success: true, data: result.rows[0] },
        { status: 201 }
      );
    } catch (error) {
      // SQLite unique constraint violation
      if (error.message && error.message.includes('UNIQUE constraint failed')) {
        return Response.json(
          { success: false, message: 'Username already exists' },
          { status: 409 }
        );
      }
      throw error;
    }
  }, env);
}

export default withErrorHandling(registerHandler);