import { getDatabase, executeQuery } from './_db.js';

/**
 * 统一的数据库处理函数 (适配 Cloudflare D1)
 * @param {Function} handler - 数据库操作函数，接收db作为参数
 * @param {Object} env - Cloudflare 环境变量
 * @returns {Promise} 返回handler的执行结果
 */
export async function withDatabase(handler, env) {
  const db = getDatabase(env);
  return await handler(db);
}

/**
 * 统一的API错误处理
 * @param {Function} handler - API处理函数
 * @returns {Function} 返回包装后的处理函数
 */
export function withErrorHandling(handler) {
  return async (request, env, ctx) => {
    try {
      return await handler(request, env, ctx);
    } catch (error) {
      console.error('API Error:', error);
      return Response.json(
        { 
          success: false, 
          message: 'Internal Server Error',
          ...(env.NODE_ENV === 'development' && { error: error.message })
        },
        { status: 500 }
      );
    }
  };
}

/**
 * 解析请求体
 * @param {Request} request 
 * @returns {Promise<Object>}
 */
export async function parseRequestBody(request) {
  const contentType = request.headers.get('content-type');
  if (contentType?.includes('application/json')) {
    return await request.json();
  }
  return {};
}

/**
 * 解析查询参数
 * @param {Request} request 
 * @returns {Object}
 */
export function parseQueryParams(request) {
  const url = new URL(request.url);
  const params = {};
  for (const [key, value] of url.searchParams) {
    params[key] = value;
  }
  return params;
}