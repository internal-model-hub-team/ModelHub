# Internal Model Hub

这是一个实验室内部使用的模型与数据集托管平台。前端、后端、数据库和 Gitea 已放在同一个项目中。

## 已有功能

- 注册、登录、退出登录和个人资料
- 平台账号自动同步为同名 Gitea 账号
- 模型与数据集发现、搜索、类型/标签筛选和分页
- 创建公开或私有仓库
- 仓库详情、许可证和 Gitea 克隆地址
- README 实际写入 Gitea 仓库
- 网页上传、目录浏览和鉴权下载
- 大模型文件自动使用 Git LFS 存储
- 个人 API Token 创建、查看和删除
- 401、404、服务器错误、加载中和无结果提示

第一版不包含在线推理、算力托管、社区讨论和在线编辑。

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

默认 `GITEA_MOCK=true`，文件和仓库会写入本地模拟目录，适合第一次开发联调。要验证真实 Gitea 和 Git LFS，请按照下面的“接入真实 Gitea”操作。

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

先启动基础服务：

```powershell
docker compose up -d postgres gitea
```

创建平台专用的 Gitea 管理员（密码只用于本机开发，请自行替换）：

```powershell
docker compose exec --user git gitea gitea admin user create --username modelhub-admin --password "ChangeMe-123456" --email "modelhub@local.test" --admin --must-change-password=false
docker compose exec --user git gitea gitea admin user generate-access-token --username modelhub-admin --token-name modelhub-backend --scopes all
```

复制第二条命令输出的 Token，然后修改根目录 `.env`：

```env
GITEA_MOCK=false
GITEA_ADMIN_USERNAME=modelhub-admin
GITEA_ADMIN_TOKEN=刚才生成的Token
```

最后启动完整平台：

```powershell
docker compose up -d --build
```

上传 `.safetensors`、`.gguf`、`.bin`、`.pt`、`.pth`、`.onnx` 文件，或者上传超过 10 MB 的其他文件时，后端会自动使用 Git LFS。阈值和扩展名可通过 `.env` 中的 `LFS_THRESHOLD_BYTES`、`LFS_EXTENSIONS` 修改。

开发环境中的 `GITEA_ROOT_URL=http://host.docker.internal:3001/` 是为了让浏览器和后端容器都能访问 Gitea 返回的绝对 LFS 地址。部署到服务器时，应把它替换成用户和容器都能访问的 HTTPS 域名。

## 文件接口

| 方法 | 地址 | 用途 |
| --- | --- | --- |
| `GET` | `/api/v1/repositories/{repo_type}/{owner}/{slug}/files` | 浏览仓库目录 |
| `POST` | `/api/v1/repositories/{repo_type}/{owner}/{slug}/files` | 上传文件 |
| `GET` | `/api/v1/repositories/{repo_type}/{owner}/{slug}/files/{path}` | 下载文件 |
| `DELETE` | `/api/v1/repositories/{repo_type}/{owner}/{slug}/files/{path}` | 删除文件 |

私有仓库的列表和下载需要登录，只有仓库所有者可以上传或删除文件。README 的创建和修改会同步到 Gitea。

真实生产部署前仍需要补充 Alembic 数据库迁移、Git LFS 配额、对象存储、审计日志、备份和 HTTPS。
