# Model Hub 前端

这是实验室内部 Model Hub 的 Next.js 前端。技术栈为 Next.js 16、React 19、TypeScript、Tailwind CSS 4 和 Lucide 图标。

## 启动

1. 先启动 FastAPI 后端，确认能打开 `http://localhost:8000/docs`。
2. 在当前目录创建 `.env.local`：

```env
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000
```

3. 安装依赖并启动前端：

```powershell
cd apps/web
npm.cmd install
npm.cmd run dev
```

网页地址是 `http://localhost:3000`。

## 页面

| 地址 | 功能 |
| --- | --- |
| `/` | 模型和数据集发现、搜索、类型与标签筛选、分页 |
| `/login` | 登录 |
| `/register` | 注册 |
| `/new` | 创建模型或数据集仓库 |
| `/repositories/{repo_type}/{owner}/{slug}` | 仓库详情 |
| `/account` | 个人资料与 API Token 管理 |

所有产品请求统一由 `src/lib/api.ts` 发出。登录令牌暂时保存在浏览器 `localStorage`，需要登录的请求会自动添加 `Authorization: Bearer <access_token>`。

## 检查

```powershell
npm.cmd run lint
npm.cmd run build
```

当前同学提供的后端文件缺少 `routes/auth.py`、`routes/repositories.py` 和 `routes/tokens.py`，补齐后才能完成真实数据联调。后端还没有模型/数据集文件列表、上传和下载接口，因此新详情页暂时只显示仓库资料、README 和 Gitea 克隆地址。
