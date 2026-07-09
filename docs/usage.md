# Git 小助手 — 使用文档

## 概述

Git 小助手是一个桌面工具，帮助团队规范 Git 开发流程。它提供分支创建、可视化切换、快捷提交推送等功能，强制遵守团队分支命名规范。

## 安装

### 系统要求

| 平台 | 要求 |
|------|------|
| macOS | macOS 11.0 或更高 |
| Windows | Windows 10 或更高，需 Git for Windows |

### 安装步骤

1. 下载对应平台的安装包（.dmg 或 .msi）
2. 双击安装
3. 首次打开会自动检测 Git，如未安装会引导配置

### 从源码运行（开发模式）

```bash
# 克隆仓库
git clone git@github.com:PiscesLL/git-workflow-helper.git
cd git-workflow-helper

# 安装前端依赖
npm install

# 生成图标
npm run tauri icon src/assets/icon.svg

# 启动开发模式（热更新）
npm run tauri dev
```

## 首次启动

首次打开会弹出 **Git 环境配置** 页面：

1. 工具会自动检测系统是否已安装 Git
2. 如果未检测到，可输入 Git 可执行文件路径
3. macOS 通常无需配置（系统自带）
4. Windows 如果安装 Git for Windows 后仍检测不到，填写完整路径如：`C:\Program Files\Git\bin\git.exe`

## 基本使用流程

### 第一步：打开仓库

1. 在顶部输入框中粘贴仓库路径（如 `/Users/xxx/project`）
2. 按回车或点「打开」
3. 工具会自动检测远程仓库连接状态

### 第二步：授权检测

打开仓库后，工具会自动检查远程仓库连通性：

- **SSH 连接**：如果显示「未授权」，请确认 SSH key 已配置：
  1. `ssh-keygen -t ed25519 -C "your_email@example.com"`（生成 key）
  2. `ssh-add ~/.ssh/id_ed25519`（添加到 ssh-agent）
  3. 将 `~/.ssh/id_ed25519.pub` 内容添加到 GitHub → Settings → SSH Keys

- **HTTPS 连接**：如果认证失败，可以通过以下方式配置：
  1. GitHub CLI：`gh auth login`
  2. 或使用个人 access token 替代密码

- 连接成功后，顶部会显示当前认证方式（SSH / HTTPS）

### 第三步：创建分支

在「创建分支」面板：

1. **选择分支类型**：
   - ✨ 新功能 → `feature/`
   - 🐛 Bug 修复 → `fix/`
   - 📝 文档 → `docs/`
   - 🔨 代码重构 → `refactor/`
   - 🔧 工具配置 → `chore/`

2. **输入分支名称**：
   - 直接输入英文分支名，如 `goods-cart`
   - 工具会自动转小写、空格转连字符、去特殊字符

3. **预览分支名**：下方实时显示完整分支名称

4. 点击「创建并切换」：
   - 自动切换到 `main` 分支
   - 拉取 `main` 最新代码
   - 创建并切换到新分支

### 第四步：开发 & 提交

在「快捷操作」面板：

1. **拉取**：点击 ⬇ 拉取，获取最新代码
2. **提交**：输入 commit message，按回车提交（自动先执行拉取）
   - commit 格式建议：`feat: 完成用户登录`、`fix: 修复支付金额计算错误`
3. **推送**：点击 ⬆ 推送，首次推送自动设置上游跟踪
4. **一键流水线**：点击「拉→提→推」按钮，自动完成拉取 → 提交 → 推送

提交前自动拉取，避免代码冲突。

### 第五步：切换分支

在「分支列表」面板：

- 所有本地分支按列表展示，当前分支绿色高亮
- 每个分支显示最新一次提交信息
- 点击分支项或「切换」按钮切换分支
- 如果当前有未提交的修改，自动暂存 → 切换 → 恢复

### 第六步：合并后清理

功能合并到 main 后，在终端执行清理：

```bash
git checkout main
git pull origin main
git branch -d feature/xxx
```

（此功能后续版本考虑加入工具内）

## 分支规范

### 命名规则

| 类型 | 前缀 | 使用场景 | 示例 |
|------|------|----------|------|
| ✨ 新功能 | feature/ | 新需求、新功能开发 | feature/goods-cart |
| 🐛 Bug 修复 | fix/ | 线上/测试缺陷修复 | fix/login-token-expire |
| 📝 文档 | docs/ | 文档、注释、README 修改 | docs/update-api-readme |
| 🔨 代码重构 | refactor/ | 重构，不改变业务逻辑 | refactor/extract-http |
| 🔧 工具配置 | chore/ | 构建、依赖、CI 配置 | chore/add-eslint-rules |

### 约束规则

- 禁止直接在 main 分支上修改、提交、推送
- 一个需求 / 一个 bug 对应一条独立分支
- 命名全小写，单词用连字符 `-` 连接
- 禁止空格、驼峰、特殊符号

### Commit 注释规范

```
feat:     新增业务功能
fix:      修复程序缺陷
docs:     仅修改文档、注释
refactor: 代码重构，无功能增减
chore:    构建、依赖、工具配置调整
```

示例：
```
feat: 新增商品筛选分页功能
fix: 修复订单列表数据重复问题
refactor: 统一封装接口异常处理
```

## 常见问题

### Q: 工具检测不到 Git

- 确保已安装 Git：终端执行 `git --version`
- macOS：`xcode-select --install` 或 `brew install git`
- Windows：从 [git-scm.com](https://git-scm.com/download/win) 下载安装
- 如果已安装仍检测不到，在设置中手动填写 git 路径

### Q: 远程仓库连接失败

- SSH 方式：确认公钥已添加到 GitHub/GitLab
  ```bash
  ssh -T git@github.com  # 测试连接
  ```
- HTTPS 方式：配置凭据
  ```bash
  gh auth login
  # 或
  git config --global credential.helper osxkeychain
  ```

### Q: 如何配置自定义 Git 路径？

点击右上角 ⚙️ 按钮，在设置页面填写 Git 可执行文件完整路径。路径会保存在本地，下次打开自动使用。

### Q: 分支切换时提示有未提交修改？

工具会自动暂存（stash）未提交的修改，切换分支后自动恢复。如果恢复时产生冲突，工具会提示，请手动解决冲突。

## 技术说明

- **技术栈**：Tauri v1（Rust 后端）+ Vue 3 + TypeScript + Pinia
- **Git 操作**：调用系统 git 命令，无需额外依赖
- **配置存储**：使用 localStorage 持久化 Git 路径
- **安装包体积**：约 5MB
