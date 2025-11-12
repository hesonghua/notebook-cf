import { withDatabase, withErrorHandling, parseRequestBody, parseQueryParams } from './_utils/db-handler.js';
import { authenticateToken } from './_utils/_auth.js';
import { executeQuery } from './_utils/_db.js';

async function noteTagsHandler(request, env) {
  try {
    const user = await authenticateToken(request, env.JWT_SECRET);
    
    return await withDatabase(async (db) => {
      if (request.method === 'GET') {
        const query = parseQueryParams(request);
        const { noteId } = query;
        
        if (!noteId) {
          return Response.json(
            { success: false, message: 'Note ID is required' },
            { status: 400 }
          );
        }
        
        // 验证笔记属于当前用户
        const noteCheck = await executeQuery(db,
          'SELECT id FROM notes WHERE id = ? AND user_id = ?',
          [noteId, user.userId]
        );
        
        if (noteCheck.rows.length === 0) {
          return Response.json(
            { success: false, message: 'Note not found' },
            { status: 404 }
          );
        }
        
        const result = await executeQuery(db,
          `SELECT t.* FROM tags t
           INNER JOIN note_tags nt ON t.id = nt.tag_id
           WHERE nt.note_id = ?
           ORDER BY t.name`,
          [noteId]
        );
          
        return Response.json({
          success: true,
          data: {
            tags: result.rows,
          },
        }, { status: 200 });
        
      } else if (request.method === 'POST') {
        const body = await parseRequestBody(request);
        const { noteId, tagId } = body;

        if (!noteId || !tagId) {
          return Response.json(
            { success: false, message: 'Note ID and Tag ID are required' },
            { status: 400 }
          );
        }

        // 验证笔记和标签都属于当前用户
        const noteCheck = await executeQuery(db,
          'SELECT id FROM notes WHERE id = ? AND user_id = ?',
          [noteId, user.userId]
        );
        
        const tagCheck = await executeQuery(db,
          'SELECT id FROM tags WHERE id = ? AND user_id = ?',
          [tagId, user.userId]
        );
        
        if (noteCheck.rows.length === 0 || tagCheck.rows.length === 0) {
          return Response.json(
            { success: false, message: 'Note or Tag not found' },
            { status: 404 }
          );
        }

        // 检查是否已经存在关联
        const existingRelation = await executeQuery(db,
          'SELECT * FROM note_tags WHERE note_id = ? AND tag_id = ?',
          [noteId, tagId]
        );
        
        if (existingRelation.rows.length > 0) {
          return Response.json(
            { success: false, message: 'Tag already added to note' },
            { status: 409 }
          );
        }

        await executeQuery(db,
          'INSERT INTO note_tags (note_id, tag_id) VALUES (?, ?)',
          [noteId, tagId]
        );
        
        return Response.json(
          { success: true },
          { status: 201 }
        );
        
      } else if (request.method === 'DELETE') {
        const body = await parseRequestBody(request);
        const { noteId, tagId } = body;
        
        if (!noteId || !tagId) {
          return Response.json(
            { success: false, message: 'Note ID and Tag ID are required' },
            { status: 400 }
          );
        }

        // 验证笔记属于当前用户
        const noteCheck = await executeQuery(db,
          'SELECT id FROM notes WHERE id = ? AND user_id = ?',
          [noteId, user.userId]
        );
        
        if (noteCheck.rows.length === 0) {
          return Response.json(
            { success: false, message: 'Note not found' },
            { status: 404 }
          );
        }

        await executeQuery(db,
          'DELETE FROM note_tags WHERE note_id = ? AND tag_id = ?',
          [noteId, tagId]
        );
        
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

export default withErrorHandling(noteTagsHandler);