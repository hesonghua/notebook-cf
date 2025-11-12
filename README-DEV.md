# 本地开发环境设置指南

本文档说明如何在本地设置和运行 notebook-cf 项目的开发环境。

## 前置条件

1. 安装 Node.js (推荐 v20+)
2. 安装 Wrangler CLI: `npm install -g wrangler`
3. 克隆项目并安装依赖

## 快速开始

### 1. 运行自动设置脚本

```bash
npm run setup:dev
```

这个脚本会自动：
- 检查 Wrangler 是否已安装
- 创建本地数据库目录
- 初始化本地 SQLite 数据库
- 应用数据库迁移
- 创建本地环境变量文件

### 2. 启动开发服务器

```bash
npm run dev:local
```

这将使用本地数据库和存储启动开发服务器。

## 手动设置步骤

如果自动设置脚本无法运行，可以手动执行以下步骤：

### 1. 创建本地数据库

```bash
# 创建数据库目录
mkdir -p .wrangler/state/v3/d1/miniflare-D1Database-abcdef1234567890ab

# 创建空的 SQLite 数据库文件
touch .wrangler/state/v3/d1/miniflare-D1Database-abcdef1234567890ab/notebook-db-dev.sqlite

# 应用数据库迁移
wrangler d1 migrations apply notebook-db-dev --local --compatibility-date=2025-09-27
```

### 2. 创建本地 R2 存储目录

```bash
mkdir -p .wrangler/state/v3/r2/notebook-images-dev
```

### 3. 创建环境变量文件

创建 `.dev.vars` 文件，包含以下内容：

```bash
DATABASE_NAME=notebook-db-dev
TURNSTILE_SITE_KEY=0x4AAAAAAB38IwtjhY2Nu-gX
TURNSTILE_ENABLED=false
REGISTER_ENABLED=true
R2_PUBLIC_URL=http://localhost:8787
JWT_SECRET=dev-secret-key-change-in-production
```

### 4. 启动开发服务器

```bash
wrangler dev --config wrangler.dev.jsonc --local --persist-to ./.wrangler/state
```

## 开发环境配置说明

### 数据库配置
- **类型**: 本地 SQLite 数据库
- **位置**: `.wrangler/state/v3/d1/miniflare-D1Database-abcdef1234567890ab/`
- **名称**: `notebook-db-dev`

### 存储配置
- **类型**: 本地文件系统
- **位置**: `.wrangler/state/v3/r2/notebook-images-dev`
- **访问**: `http://localhost:8787`

### 环境变量
- `TURNSTILE_ENABLED`: 设置为 `false`，本地开发不需要验证码
- `REGISTER_ENABLED`: 设置为 `true`，允许注册新用户
- `JWT_SECRET`: 使用开发密钥，生产环境需要更改

## 功能测试

### 1. 用户注册
访问 `http://localhost:8787/login`，点击注册按钮创建新用户。

### 2. 笔记管理
- 创建笔记
- 编辑笔记（支持自动保存）
- 分类管理
- 标签管理
- 搜索功能
- 导出功能

### 3. 图片上传
- 拖拽图片到编辑器
- 粘贴图片到编辑器
- 图片存储在本地 R2 模拟目录

## 开发工具

### 数据库操作
```bash
# 查看数据库
wrangler d1 execute notebook-db-dev --local "SELECT * FROM notes LIMIT 5"

# 应用新的迁移
wrangler d1 migrations apply notebook-db-dev --local

# 重置数据库
rm .wrangler/state/v3/d1/miniflare-D1Database-abcdef1234567890ab/notebook-db-dev.sqlite
wrangler d1 migrations apply notebook-db-dev --local
```

### R2 存储操作
```bash
# 列出本地存储文件
ls -la .wrangler/state/v3/r2/notebook-images-dev/

# 清理存储
rm -rf .wrangler/state/v3/r2/notebook-images-dev/*
```

## 故障排除

### 1. 数据库连接问题
如果遇到数据库连接错误：
1. 检查数据库文件是否存在
2. 确认迁移已正确应用
3. 检查文件权限

### 2. 端口冲突
如果 8787 端口被占用：
```bash
# 查找占用端口的进程
lsof -i :8787

# 杀死进程
kill -9 <PID>
```

### 3. 重新初始化
如果需要完全重置开发环境：
```bash
# 清理所有本地数据
rm -rf .wrangler/state

# 重新运行设置
npm run setup:dev
```

## 生产环境差异

本地开发环境与生产环境的主要差异：

| 配置项 | 本地开发 | 生产环境 |
|---------|---------|---------|
| 数据库 | 本地 SQLite | Cloudflare D1 |
| 存储 | 本地文件系统 | Cloudflare R2 |
| 验证码 | 禁用 | 启用 |
| 域名 | localhost | 自定义域名 |

## 注意事项

1. **数据持久化**: 本地数据存储在 `.wrangler/state` 目录中，不会被自动清理
2. **安全性**: 开发密钥仅用于本地测试，生产环境必须使用强密钥
3. **兼容性**: 本地环境模拟了 Cloudflare Workers 的部分功能，但不是完全等同
4. **备份**: 定期备份 `.wrangler/state` 目录中的重要数据

## 部署到生产环境

当开发完成后，使用以下命令部署：

```bash
npm run deploy
```

部署前确保：
1. 更新 `wrangler.jsonc` 中的生产环境配置
2. 更改所有密钥和敏感信息
3. 在生产环境测试所有功能