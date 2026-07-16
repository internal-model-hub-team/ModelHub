# Internal Model Hub

这是一个实验室内部使用的模型与数据集托管平台。前端、后端、数据库和 Gitea 已放在同一个项目中。

## 已有功能

- 注册、登录、退出登录和个人资料
- 模型与数据集发现、搜索、类型/标签筛选和分页
- 创建公开或私有仓库
- 仓库详情、README、许可证和 Gitea 克隆地址
- 个人 API Token 创建、查看和删除
- 401、404、服务器错误、加载中和无结果提示

第一版不包含在线推理、算力托管、社区讨论和在线编辑。模型文件通过 Gitea/Git 提交；网页上传文件接口尚未实现。

## 项目目录

| 目录 | 内容 | 负责人建议 |
| --- | --- | --- |
| `apps/web` | Next.js + Tailwind CSS 前端 | 前端同学 |
| `backend` | FastAPI + SQLAlchemy 后端 | 后端同学 |
| `compose.yaml` | PostgreSQL、Gitea 和完整启动配置 | 部署同学 |

## 最简单的启动方法

先安装并打开 Docker Desktop，然后在项目根目录执行：

```powershell
Copy-Item .env.example .env
docker compose up --build
```

第一次需要下载镜像，可能等待几分钟。启动后打开：

| 地址 | 用途 |
| --- | --- |
| http://localhost:3000 | Model Hub 网页 |
| http://localhost:8000/docs | 后端接口文档 |
| http://localhost:8000/health | 后端健康检查 |
| http://localhost:3001 | Gitea |

停止服务：

```powershell
docker compose down
```

默认 `GITEA_MOCK=true`，创建仓库时会返回可用格式的克隆地址，但不会真的调用 Gitea。三人第一次联调建议先使用这个模式。

## 不用 Docker 启动

后端终端：

```powershell
cd backend
python -m venv .venv
.venv\Scripts\python -m pip install -r requirements.txt
Copy-Item .env.example .env
.venv\Scripts\python -m uvicorn app.main:app --reload --port 8000
```

前端终端：

```powershell
cd apps/web
npm.cmd install
npm.cmd run dev
```

## 检查项目

```powershell
cd backend
.venv\Scripts\python -m pytest -q

cd ..\apps\web
npm.cmd run lint
npm.cmd run build
```

## 接入真实 Gitea

1. 打开 http://localhost:3001 完成 Gitea 初始化并创建管理员账号。
2. 在 Gitea 生成管理员 API Token。
3. 修改根目录 `.env`：设置 `GITEA_MOCK=false` 和 `GITEA_ADMIN_TOKEN=...`。
4. 重新执行 `docker compose up --build`。

真实部署前还需要补充 Alembic 数据库迁移、Gitea 账号同步、Git LFS 配额、审计日志和备份。
