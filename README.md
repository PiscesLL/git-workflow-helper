# 🔀 Git 小助手

团队 Git 开发工作流桌面工具。基于 Tauri + Vue 3，适配 macOS 和 Windows。

## 功能

| 功能 | 说明 |
|------|------|
| **创建分支** | 选择类型（feature/fix/docs/refactor/chore），输入内容，自动生成规范分支名并切换 |
| **分支切换** | 可视化列表展示所有分支，点选切换，自动处理未提交修改 |
| **拉取代码** | 一键拉取当前分支最新代码 |
| **提交代码** | 输入 commit message，自动执行 `git add . && git commit` |
| **推送代码** | 推送到远程，自动设置上游跟踪 |
| **一键流水线** | 拉取 → 提交 → 推送 一条龙 |

## 分支规范

| 类型 | 前缀 | 使用场景 |
|------|------|----------|
| ✨ 新功能 | feature/ | 新需求、新功能开发 |
| 🐛 Bug 修复 | fix/ | 线上/测试缺陷修复 |
| 📝 文档 | docs/ | 文档、注释、README 修改 |
| 🔨 代码重构 | refactor/ | 代码重构，不改变业务逻辑 |
| 🔧 工具配置 | chore/ | 构建脚本、依赖、CI、工具配置 |

## 开发

```bash
# 1. 安装前端依赖
npm install

# 2. 生成应用图标（首次需要）
npm run tauri icon src/assets/icon.svg
# 或者用 Python 生成占位图标：
python3 scripts/generate_icons.py

# 3. 启动开发模式（热更新）
npm run tauri dev
```

## 构建

```bash
# macOS DMG
npm run tauri build -- --target universal-apple-darwin

# Windows MSI（需在 Windows 上构建）
npm run tauri build
```

构建产物在 `src-tauri/target/release/bundle/` 下。

## 技术栈

- **桌面框架**: Tauri v1（Rust 后端）
- **前端**: Vue 3 + TypeScript + Vite + Pinia
- **Git 操作**: 通过 Rust 调用系统 git 命令
- **包体积**: ~5MB（安装包）

## 项目结构

```
git-helper/
├── package.json              # npm 依赖配置
├── vite.config.ts            # Vite 配置
├── index.html                # 入口 HTML
├── src/
│   ├── App.vue               # 主布局
│   ├── main.ts               # Vue 启动
│   ├── style.css             # 全局样式
│   ├── types/index.ts        # TypeScript 类型定义
│   ├── stores/git.ts         # Pinia 状态管理（Git 操作）
│   └── components/
│       ├── BranchCreator.vue  # 创建分支面板
│       ├── BranchList.vue     # 分支列表/切换
│       └── QuickActions.vue   # 提交/拉取/推送
├── src-tauri/
│   ├── Cargo.toml            # Rust 依赖
│   ├── tauri.conf.json       # Tauri 窗口/打包配置
│   └── src/
│       ├── main.rs           # 程序入口
│       └── lib.rs            # Git 命令实现（Rust）
└── scripts/
    └── generate_icons.py     # 图标生成脚本
```
