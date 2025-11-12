#!/bin/bash

# 本地开发环境设置脚本
echo "🚀 设置 notebook-cf 本地开发环境..."

# 检查是否已安装 wrangler
if ! command -v wrangler &> /dev/null; then
    echo "❌ Wrangler 未安装，请先安装："
    echo "npm install -g wrangler"
    exit 1
fi

# 创建本地数据库目录
echo "📁 创建本地数据库目录..."
mkdir -p .wrangler/state/v3/d1/miniflare-D1Database-abcdef1234567890ab

# 初始化数据库（如果不存在）
echo "🗄️ 初始化本地数据库..."
if [ ! -f ".wrangler/state/v3/d1/miniflare-D1Database-abcdef1234567890ab/notebook-db-dev.sqlite" ]; then
    # 创建空的 SQLite 数据库文件
    touch ".wrangler/state/v3/d1/miniflare-D1Database-abcdef1234567890ab/notebook-db-dev.sqlite"
    echo "✅ 本地数据库文件已创建"
fi

# 确保数据库文件存在且可写
echo "🔍 检查数据库文件..."
if [ -f ".wrangler/state/v3/d1/miniflare-D1Database-abcdef1234567890ab/notebook-db-dev.sqlite" ]; then
    echo "✅ 数据库文件存在"
else
    echo "❌ 数据库文件不存在，创建失败"
    exit 1
fi

# 创建本地 R2 存储目录
echo "📦 创建本地 R2 存储目录..."
mkdir -p .wrangler/state/v3/r2/notebook-images-dev

# 应用数据库迁移
echo "🔄 应用数据库迁移..."
wrangler d1 migrations apply notebook-db-dev --local --verbose

# 创建本地环境变量文件
echo "⚙️ 创建本地环境变量..."
cat > .dev.vars << EOF
# 本地开发环境变量
DATABASE_NAME=notebook-db-dev
TURNSTILE_SITE_KEY=xxxxxxxx
TURNSTILE_ENABLED=false
REGISTER_ENABLED=true
R2_PUBLIC_URL=http://localhost:8787
JWT_SECRET=dev-secret-key-change-in-production
EOF

echo "✅ 本地环境变量已创建"

# 启动开发服务器
echo "🌐 启动开发服务器..."
echo ""
echo "📋 开发环境设置完成！"
echo ""
echo "🔧 可用的命令："
echo "  npm run dev          - 启动开发服务器"
echo "  npm run dev:local    - 使用本地数据库和存储"
echo "  wrangler d1 <command> - 操作本地数据库"
echo "  wrangler r2 <command> - 操作本地R2存储"
echo ""
echo "📝 配置文件："
echo "  wrangler.dev.jsonc - 本地开发配置"
echo "  .dev.vars - 本地环境变量"
echo ""
echo "🚀 运行 'npm run dev:local' 开始本地开发！"