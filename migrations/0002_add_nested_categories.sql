-- 迁移脚本：添加多级分类支持
-- 添加 parent_id 字段以支持分类的父子关系
-- 使用 0 表示顶层分类，而不是 null

-- 添加 parent_id 字段，默认值为 0（顶层分类）
ALTER TABLE categories ADD COLUMN parent_id INTEGER DEFAULT 0;

-- 更新现有分类的 parent_id 为 0
UPDATE categories SET parent_id = 0 WHERE parent_id IS NULL;

-- 添加索引以优化父分类查询
CREATE INDEX IF NOT EXISTS idx_categories_parent_id ON categories(parent_id);