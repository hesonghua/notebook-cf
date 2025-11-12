import { withDatabase, withErrorHandling, parseRequestBody, parseQueryParams } from './_utils/db-handler.js';
import { authenticateToken } from './_utils/_auth.js';
import { executeQuery } from './_utils/_db.js';

async function tagsHandler(request, env) {
  try {
    const user = await authenticateToken(request, env.JWT_SECRET);
    
    return await withDatabase(async (db) => {
      if (request.method === 'GET') {
        const query = parseQueryParams(request);
        const { noteId } = query;
        
        // 如果有noteId参数，返回特定笔记的标签
        if (noteId) {
          const result = await executeQuery(db,
            `SELECT t.* FROM tags t
             INNER JOIN note_tags nt ON t.id = nt.tag_id
             WHERE nt.note_id = ? AND t.user_id = ?`,
            [noteId, user.userId]
          );
          
          return Response.json({
            success: true,
            data: {
              tags: result.rows,
            },
          }, { status: 200 });
        }
        
        // 否则返回用户的所有标签
        const result = await executeQuery(db,
          'SELECT * FROM tags WHERE user_id = ? ORDER BY name',
          [user.userId]
        );

        return Response.json({
          success: true,
          data: {
            tags: result.rows,
          },
        }, { status: 200 });
        
      } else if (request.method === 'POST') {
        const body = await parseRequestBody(request);
        const { name, color } = body;

        if (!name) {
          return Response.json(
            { success: false, message: 'Tag name is required' },
            { status: 400 }
          );
        }

        const result = await executeQuery(db,
          'INSERT INTO tags (user_id, name, color) VALUES (?, ?, ?) RETURNING *',
          [user.userId, name, color || '#5e81ac']
        );
        
        return Response.json(
          { success: true, data: result.rows[0] },
          { status: 201 }
        );
        
      } else if (request.method === 'PUT') {
        const body = await parseRequestBody(request);
        const { id, name, color } = body;

        if (!id) {
          return Response.json(
            { success: false, message: 'Tag ID is required' },
            { status: 400 }
          );
        }

        const result = await executeQuery(db,
          'UPDATE tags SET name = ?, color = ? WHERE id = ? AND user_id = ? RETURNING *',
          [name, color, id, user.userId]
        );

        if (result.rows.length === 0) {
          return Response.json(
            { success: false, message: 'Tag not found' },
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
        
        if (!id) {
          return Response.json(
            { success: false, message: 'Tag ID is required' },
            { status: 400 }
          );
        }
        
        await executeQuery(db, 'DELETE FROM tags WHERE id = ? AND user_id = ?', [id, user.userId]);
        
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

export default withErrorHandling(tagsHandler);