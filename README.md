# Majiang Admin

麻将练习工具的数据分析后台，包含 Express.js 后端和 React 管理面板。

## 项目结构

```
majiang-admin/
├── src/                # Express 后端
│   └── server.js       # API 服务 & 静态文件托管
├── public/             # 构建后的前端文件（deploy 时自动生成）
├── ui/                 # React 管理面板源码
│   ├── src/
│   │   ├── App.tsx     # 主界面
│   │   ├── api.ts      # 后端 API 调用
│   │   └── components/ # UI 组件
│   ├── package.json
│   └── vite.config.ts
├── Dockerfile
├── docker-compose.yml
└── deploy.sh           # 一键部署脚本
```

## 技术栈

- **后端**: Node.js + Express
- **前端**: React 19 + TypeScript + Vite + Tailwind CSS
- **部署**: Docker + 腾讯云 CVM

## 本地开发

### 后端

```bash
npm install
npm run dev        # 端口 3210
```

### 前端

```bash
cd ui
npm install
npm run dev        # Vite 开发服务器，默认代理到后端
```

## 部署到腾讯云

### 环境信息

| 项目 | 值 |
|------|-----|
| 服务器 | 腾讯云 CVM |
| 容器名 | `majiang-admin` |
| 端口 | `3210` |
| 数据卷 | `majiang-admin-data` (持久化 track.json / pv.json) |
| 数据目录 | `/opt/majiang-admin` |

### 一键部署

```bash
./deploy.sh
```

脚本执行流程：
1. 构建 React UI (`ui/` → `public/`)
2. 通过 SCP 上传后端文件到服务器 `/opt/majiang-admin/`
3. 在服务器上 Docker build & restart

### Docker 部署

```bash
# 构建 UI
cd ui && npm run build && cd ..
cp -r ui/dist public/

# Docker 构建 & 运行
docker build -t majiang-admin .
docker run -d \
  --name majiang-admin \
  --restart unless-stopped \
  -p 3210:3210 \
  -v /opt/majiang-optimized:/data/majiang-optimized:ro \
  -v majiang-admin-data:/app/data \
  majiang-admin
```

### 环境变量

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `PORT` | 服务端口 | `3210` |
| `REPO_PATH` | majiang-optimized 代码路径（只读挂载） | `/data/majiang-optimized` |

## API 接口

| 路径 | 方法 | 说明 |
|------|------|------|
| `/api/track` | POST | 数据上报 |
| `/api/overview` | GET | 总览数据（支持日期筛选） |
| `/api/pv/trend` | GET | PV 趋势 |
| `/api/games` | GET | 游戏记录 |
| `/api/modes` | GET | 模式分析 |
| `/api/user-journey` | GET | 用户行为路径 |
| `/api/attribution/geo` | GET | 地域分布 |
| `/api/attribution/browser` | GET | 浏览器 & OS |
| `/api/attribution/source` | GET | 来源分析 |
| `/api/attribution/device` | GET | 设备分布 |
| `/api/events` | GET | 原始事件 |
| `/api/export/json` | GET | JSON 导出 |
| `/api/export/csv` | GET | CSV 导出 |
| `/api/health` | GET | 健康检查 |
