# YX-story

> AI 驱动的交互式叙事平台

## 特性

- 🎭 **角色驱动叙事** - 创建并与 AI 驱动的角色互动
- 🌍 **动态世界构建** - 构建丰富的交互式故事世界
- 💬 **实时 AI 对话** - 与角色进行自然对话
- 🎨 **可自定义主题** - 个性化您的叙事体验
- 📱 **移动端友好** - 在所有设备上无缝体验
- 🔧 **灵活配置** - 支持多种 LLM 提供商（OpenAI、Ollama）

## 快速开始

### 前置要求

- Node.js 18+
- pnpm（推荐）或 npm

### 安装

```bash
# 克隆仓库
git clone https://github.com/yourusername/yx-story.git
cd yx-story

# 安装依赖
pnpm install

# 配置环境变量
cp .env.example .env.local
# 编辑 .env.local 填入你的 API 密钥

# 运行开发服务器
pnpm dev
```

在浏览器中打开 [http://localhost:3000](http://localhost:3000)。

### 生产环境构建

```bash
# 构建项目
pnpm build

# 预览构建
pnpm preview
```

## 配置

在根目录创建 `.env.local` 文件并添加您的配置：

```env
# LLM 配置
NEXT_PUBLIC_CHAT_LLM_TYPE=openai
NEXT_PUBLIC_CHAT_LLM_BASE_URL=https://api.openai.com/v1
NEXT_PUBLIC_CHAT_LLM_MODEL=gpt-4-turbo
NEXT_PUBLIC_CHAT_LLM_API_KEY=your_api_key_here

# 可选：数据库
# 如需持久化存储请配置

# 可选：身份验证
# 如需用户认证请配置
```

查看 `.env.example` 了解所有可用配置选项。

## 技术栈

- **框架**: Next.js 15
- **语言**: TypeScript
- **样式**: Tailwind CSS v4
- **动画**: Framer Motion、GSAP
- **AI/LLM**: LangChain、OpenAI、Ollama
- **状态管理**: Zustand
- **数据库**: SQLite (better-sqlite3)

## 项目结构

```
yx-story/
├── app/                # Next.js 应用目录
├── components/         # React 组件
├── function/           # 业务逻辑
├── hooks/              # 自定义 React Hooks
├── lib/                # 工具和库
├── public/             # 静态资源
└── docs/               # 文档
```

## 许可证

MIT 许可证 - 详见 [LICENSE](LICENSE)。

## 支持

如有问题，请在 GitHub 上提交 Issue。

---

使用 Next.js 和 AI 用❤️构建
