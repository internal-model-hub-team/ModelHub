# Model Hub

这是一个面向模型和数据集托管的最小平台。第一版包含：

- Next.js 模型发现页
- 创建模型表单
- FastAPI 模型创建、列表、搜索和健康检查接口
- PostgreSQL 业务数据库
- Gitea Git 和 Git LFS 托管服务

## 第一次启动

电脑需要安装并打开 Docker Desktop。

在项目根目录运行：

```powershell
docker compose up --build
```

第一次需要下载镜像和依赖，可能等待几分钟。看到服务启动后打开：

| 地址 | 用途 |
| --- | --- |
| http://localhost:3000 | Model Hub 网页 |
| http://localhost:8000/docs | FastAPI 接口文档 |
| http://localhost:3001 | Gitea |

停止项目：

```powershell
docker compose down
```

停止并删除本地数据库和 Gitea 数据：

```powershell
docker compose down -v
```

最后一条命令会删除本地数据，只能在确认不需要这些数据时使用。

## 不使用 Docker 单独运行

前端：

```powershell
cd apps/web
npm.cmd install
npm.cmd run dev
```

后端：

```powershell
cd services/api
python -m venv .venv
.venv\Scripts\python -m pip install -r requirements-dev.txt
.venv\Scripts\python -m uvicorn app.main:app --reload
```

单独运行后端时，数据保存在 `services/api/modelhub.db`。使用 Docker 时，数据保存在 PostgreSQL。

## 三人负责范围

| 人员 | 目录 | 工作 |
| --- | --- | --- |
| 甲 | `apps/web` | Next.js 页面和样式 |
| 乙 | `services/api` | FastAPI、数据库和接口 |
| 丙 | `compose.yaml`、后续的 `infra` | Gitea、Docker、测试和部署 |

每个人从 `main` 创建自己的分支，完成一个小任务后提交 Pull Request。不要直接修改 `main`。

## 当前验收方法

1. 打开 http://localhost:3000，能看到三个示例模型。
2. 点击“创建模型”，填写表单后返回首页并看到新模型。
3. 搜索 `中文`，页面只显示匹配的模型。
4. 打开 http://localhost:8000/api/v1/health，数据库状态为 `connected`。
5. 打开 http://localhost:3001，能进入 Gitea 初始化页面。
