import { withDatabase, withErrorHandling, parseRequestBody } from './_utils/db-handler.js';
import { authenticateToken } from './_utils/_auth.js';
import { executeQuery } from './_utils/_db.js';

async function categoriesHandler(request, env) {
  try {
    const user = await authenticateToken(request, env.JWT_SECRET);
    
    return await withDatabase(async (db) => {
      if (request.method === 'GET') {
        // 获取分类及其笔记数量
        const result = await executeQuery(db, `
          SELECT
            c.*,
            COALESCE(n.note_count, 0) as note_count
          FROM categories c
          LEFT JOIN (
            SELECT category_id, COUNT(*) as note_count
            FROM notes
            WHERE user_id = ?
            GROUP BY category_id
          ) n ON c.id = n.category_id
          WHERE c.user_id = ?
          ORDER BY c.id DESC
        `, [user.userId, user.userId]);
        
        return Response.json(result.rows, { status: 200 });
        
      } else if (request.method === 'POST') {
        const body = await parseRequestBody(request);
        const { name } = body;
        
        const result = await executeQuery(db,
          'INSERT INTO categories (user_id, name) VALUES (?, ?) RETURNING *',
          [user.userId, name]
        );
        
        return Response.json(result.rows[0], { status: 201 });
        
      } else if (request.method === 'PUT') {
        const body = await parseRequestBody(request);
        const { id, name } = body;
        
        const result = await executeQuery(db,
          'UPDATE categories SET name = ? WHERE id = ? AND user_id = ? RETURNING *',
          [name, id, user.userId]
        );
        
        return Response.json(result.rows[0], { status: 200 });
        
      } else if (request.method === 'DELETE') {
        const body = await parseRequestBody(request);
        const { id } = body;
        
        // First, update notes in this category to have null category_id
        await executeQuery(db, 'UPDATE notes SET category_id = NULL WHERE category_id = ? AND user_id = ?', [id, user.userId]);
        // Then, delete the category
        await executeQuery(db, 'DELETE FROM categories WHERE id = ? AND user_id = ?', [id, user.userId]);
        
        return new Response(null, { status: 204 });
        
      } else {
        return Response.json(
          { success: false, message: 'Method Not Allowed' },
          { status: 405 }
        );
      }
    }, env);
    
  } catch (error) {
    if (error.status === 401 || error.status === 403) {
      return Response.json(
        { success: false, message: error.message },
        { status: error.status }
      );
    }
    throw error;
  }
}

export default withErrorHandling(categoriesHandler);
