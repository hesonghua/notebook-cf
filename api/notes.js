import { withDatabase, withErrorHandling, parseRequestBody, parseQueryParams } from './_utils/db-handler.js';
import { authenticateToken } from './_utils/_auth.js';
import { executeQuery } from './_utils/_db.js';

async function notesHandler(request, env) {
  try {
    const user = await authenticateToken(request, env.JWT_SECRET);
    
    return await withDatabase(async (db) => {
      if (request.method === 'GET') {
        const query = parseQueryParams(request);
        const { id, categoryId, search } = query;
        
        // 如果有search参数，执行全文搜索
        if (search) {
          const searchQuery = `%${search}%`;
          const result = await executeQuery(db,
            'SELECT id, title, category_id, created_at FROM notes WHERE user_id = ? AND (title LIKE ? OR content LIKE ?) ORDER BY id DESC',
            [user.userId, searchQuery, searchQuery]
          );
          
          return Response.json({
            success: true,
            data: {
              notes: result.rows,
            },
          }, { status: 200 });
        }
        
        // 如果有id参数，返回单个笔记
        if (id) {
          const result = await executeQuery(db,
            'SELECT * FROM notes WHERE id = ? AND user_id = ?',
            [id, user.userId]
          );
          
          if (result.rows.length === 0) {
            return Response.json(
              { success: false, message: 'Note not found' },
              { status: 404 }
            );
          }
          
          return Response.json(
            { success: true, data: result.rows[0] },
            { status: 200 }
          );
        }
        
        // 否则返回笔记列表，不包含content
        let notesQuery = 'SELECT id, title, category_id, created_at FROM notes WHERE user_id = ?';
        const queryParams = [user.userId];

        if (categoryId) {
          if (categoryId === 'null') {
            notesQuery += ' AND category_id IS NULL';
          } else {
            notesQuery += ' AND category_id = ?';
            queryParams.push(categoryId);
          }
        }
        
        notesQuery += ' ORDER BY id DESC';

        const notesResult = await executeQuery(db, notesQuery, queryParams);

        return Response.json({
          success: true,
          data: {
            notes: notesResult.rows,
          },
        }, { status: 200 });
        
      } else if (request.method === 'POST') {
        const body = await parseRequestBody(request);
        let { title, content, category_id = null } = body;

        if (!title) {
          if (!content) title = 'Untitled';
          else {
            const firstLine = content.split('\n')[0];
            title = firstLine.replace(/^#+\s*/, '') || 'Untitled';
          }
        }
        
        const result = await executeQuery(db,
          'INSERT INTO notes (user_id, title, content, category_id) VALUES (?, ?, ?, ?) RETURNING *',
          [user.userId, title, content || '', category_id]
        );
        
        return Response.json(
          { success: true, data: result.rows[0] },
          { status: 201 }
        );
        
      } else if (request.method === 'PUT') {
        const body = await parseRequestBody(request);
        const { id, ...fieldsToUpdate } = body;

        if (!id) {
          return Response.json(
            { success: false, message: 'Note ID is required' },
            { status: 400 }
          );
        }

        const fieldEntries = Object.entries(fieldsToUpdate);
        if (fieldEntries.length === 0) {
          return Response.json(
            { success: false, message: 'No fields to update' },
            { status: 400 }
          );
        }

        const setClause = fieldEntries
          .map(([key]) => `"${key}" = ?`)
          .join(', ');
        const queryParams = fieldEntries.map(([, value]) => value);
        queryParams.push(id, user.userId);

        const query = `UPDATE notes SET ${setClause} WHERE id = ? AND user_id = ? RETURNING *`;

        const result = await executeQuery(db, query, queryParams);

        if (result.rows.length === 0) {
          return Response.json(
            { success: false, message: 'Note not found' },
            { status: 404 }
          );
        }

        return Response.json(
          { success: true, data: result.rows[0] },
          { status: 200 }
        );
        
      } else if (request.method === 'DELETE') {
        const body = await parseRequestBody(request);
        const { id } = body;
        
        await executeQuery(db, 'DELETE FROM notes WHERE id = ? AND user_id = ?', [id, user.userId]);
        
        return Response.json(
          { success: true },
          { status: 200 }
        );
        
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

export default withErrorHandling(notesHandler);
