import { Hono } from 'hono';
import { cors } from 'hono/cors';
import loginHandler from './login.js';
import registerHandler from './register.js';
import notesHandler from './notes.js';
import categoriesHandler from './categories.js';
import configHandler from './config.js';

const app = new Hono().basePath('/api');

// 添加 CORS 中间件
app.use('*', cors({
  origin: '*',
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
}));

// 封装一个函数来处理请求和响应
const createHandler = (handler) => async (c) => {
  try {
    const response = await handler(c.req.raw, c.env, c.executionCtx);
    return response;
  } catch (error) {
    console.error('API Error:', error);
    return c.json({ success: false, message: 'Internal Server Error' }, 500);
  }
};

// 定义 API 路由
app.all('/login', createHandler(loginHandler));
app.all('/register', createHandler(registerHandler));
app.all('/notes', createHandler(notesHandler));
app.all('/categories', createHandler(categoriesHandler));
app.all('/config', createHandler(configHandler));

// 404 处理
app.notFound((c) => {
  return c.json({ success: false, message: 'API endpoint not found' }, 404);
});

export default app;
