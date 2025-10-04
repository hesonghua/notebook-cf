// Cloudflare D1 数据库工具函数
export function getDatabase(env) {
  return env.DB;
}

// 执行 SQL 查询的辅助函数
export async function executeQuery(db, query, params = []) {
  try {
    const trimmedQuery = query.trim().toUpperCase();
    
    // SELECT 查询
    if (trimmedQuery.startsWith('SELECT')) {
      const result = await db.prepare(query).bind(...params).all();
      return {
        rows: result.results || [],
        success: result.success
      };
    }
    
    // INSERT/UPDATE/DELETE 包含 RETURNING 的查询
    if (trimmedQuery.includes('RETURNING')) {
      const result = await db.prepare(query).bind(...params).first();
      return {
        rows: result ? [result] : [],
        success: true
      };
    }
    
    // 其他修改操作（不包含 RETURNING）
    const result = await db.prepare(query).bind(...params).run();
    return {
      rows: [],
      success: result.success,
      meta: result.meta
    };
  } catch (error) {
    console.error('Database query error:', error);
    throw error;
  }
}

// 执行事务的辅助函数
export async function executeTransaction(db, queries) {
  try {
    const statements = queries.map(({ query, params = [] }) => 
      db.prepare(query).bind(...params)
    );
    
    const result = await db.batch(statements);
    return { success: true, results: result };
  } catch (error) {
    console.error('Transaction error:', error);
    throw error;
  }
}