import { withDatabase, withErrorHandling, parseRequestBody } from './_utils/db-handler.js';
import { authenticateToken } from './_utils/_auth.js';
import { executeQuery } from './_utils/_db.js';

// 将扁平的分类列表构建为树形结构
function buildCategoryTree(categories, parentId = 0) {
  const tree = [];
  categories.forEach(category => {
    // 统一处理 parent_id 为数字，确保类型一致
    const categoryId = parseInt(category.parent_id, 10);
    if (categoryId === parentId) {
      const children = buildCategoryTree(categories, category.id);
      if (children.length > 0) {
        category.children = children;
      }
      tree.push(category);
    }
  });
  return tree;
}

async function categoriesHandler(request, env) {
  try {
    const user = await authenticateToken(request, env.JWT_SECRET);
    
    return await withDatabase(async (db) => {
      if (request.method === 'GET') {
        // 获取分类及其笔记数量（扁平结构）
        const result = await executeQuery(db, `
          SELECT
            c.*,
            COALESCE(n.note_count, 0) as note_count
          FROM categories c
          LEFT JOIN (
            SELECT category_id, COUNT(*) as note_count
            FROM notes
            WHERE user_id = ? AND category_id IS NOT NULL
            GROUP BY category_id
          ) n ON c.id = n.category_id
          WHERE c.user_id = ?
          ORDER BY c."order", c.id
        `, [user.userId, user.userId]);
        
        // 构建树形结构
        const categories = result.rows;
        const tree = buildCategoryTree(categories);
        
        return Response.json({
          success: true,
          data: {
            categories: tree,
          },
        }, { status: 200 });
        
      } else if (request.method === 'POST') {
        const body = await parseRequestBody(request);
        const { name, parent_id } = body;
        
        const result = await executeQuery(db,
          'INSERT INTO categories (user_id, name, parent_id) VALUES (?, ?, ?) RETURNING *',
          [user.userId, name, parent_id || 0]
        );
        
        return Response.json(result.rows[0], { status: 201 });
        
      } else if (request.method === 'PUT') {
        const body = await parseRequestBody(request);
        const { id, name, parent_id } = body;
        
        // 验证不能将分类移动到自己的子分类下
        const descendants = await executeQuery(db, `
          WITH RECURSIVE category_tree AS (
            SELECT id FROM categories WHERE id = ? AND user_id = ?
            UNION ALL
            SELECT c.id FROM categories c
            INNER JOIN category_tree ct ON c.parent_id = ct.id
          )
          SELECT id FROM category_tree
        `, [id, user.userId]);
        
        const descendantIds = descendants.rows.map(row => row.id);
        if (descendantIds.includes(parseInt(parent_id))) {
          return Response.json(
            { success: false, message: 'Cannot move category to its own descendant' },
            { status: 400 }
          );
        }
        
        const result = await executeQuery(db,
          'UPDATE categories SET name = ?, parent_id = ? WHERE id = ? AND user_id = ? RETURNING *',
          [name, parent_id || 0, id, user.userId]
        );
        
        return Response.json(result.rows[0], { status: 200 });
        
      } else if (request.method === 'DELETE') {
        const body = await parseRequestBody(request);
        const { id } = body;
        
        // 将子分类的 parent_id 设置为 0（提升为顶级分类）
        await executeQuery(db,
          'UPDATE categories SET parent_id = 0 WHERE parent_id = ? AND user_id = ?',
          [id, user.userId]
        );
        
        // 将该分类及其子分类下的笔记移动到未分类
        const allCategoryIds = await executeQuery(db, `
          WITH RECURSIVE category_tree AS (
            SELECT id FROM categories WHERE id = ? AND user_id = ?
            UNION ALL
            SELECT c.id FROM categories c
            INNER JOIN category_tree ct ON c.parent_id = ct.id
          )
          SELECT id FROM category_tree
        `, [id, user.userId]);
        
        const categoryIds = allCategoryIds.rows.map(row => row.id);
        if (categoryIds.length > 0) {
          const placeholders = categoryIds.map(() => '?').join(',');
          await executeQuery(db,
            `UPDATE notes SET category_id = NULL WHERE category_id IN (${placeholders}) AND user_id = ?`,
            [...categoryIds, user.userId]
          );
        }
        
        // 删除分类
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
