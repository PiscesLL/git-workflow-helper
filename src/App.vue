<script setup lang="ts">
import { onMounted, ref, watch } from "vue";
import { useGitStore } from "@/stores/git";
import BranchCreator from "@/components/BranchCreator.vue";
import BranchList from "@/components/BranchList.vue";
import QuickActions from "@/components/QuickActions.vue";

const store = useGitStore();
const repoInput = ref("");
const showGitConfig = ref(false);
const gitPathInput = ref("");

// ─── Lifecycle ──────────────────────────────────────────────────────────────

onMounted(async () => {
  await store.checkGit();
  if (!store.gitAvailable) {
    showGitConfig.value = true;
  }
});

// ─── Git path ────────────────────────────────────────────────────────────────

function openGitConfig() {
  gitPathInput.value = store.gitPath;
  showGitConfig.value = true;
}

async function saveGitPath() {
  store.setGitPath(gitPathInput.value);
  await store.checkGit(gitPathInput.value);
  if (store.gitAvailable) {
    showGitConfig.value = false;
  }
}

async function skipGitConfig() {
  showGitConfig.value = false;
}

// ─── Repo ────────────────────────────────────────────────────────────────────

function selectRepo() {
  if (repoInput.value.trim()) {
    store.setRepo(repoInput.value.trim());
  }
}

// Re-check access when repo changes
watch(() => store.repoPath, () => {
  repoInput.value = store.repoPath;
});

// Helper to copy SSH setup commands
function copyText(text: string) {
  navigator.clipboard?.writeText(text);
}
</script>

<template>
  <div class="app">
    <!-- Git not found overlay -->
    <div v-if="showGitConfig" class="setup-overlay">
      <div class="setup-card">
        <div class="setup-icon">🔧</div>
        <h2>Git 环境配置</h2>

        <div v-if="!store.gitAvailable" class="setup-status warn">
          ⚠ 未检测到 Git，请配置 Git 可执行文件路径
        </div>
        <div v-else class="setup-status ok">
          ✓ 已检测到 Git：{{ store.gitInfo?.version }}
        </div>

        <div class="setup-section">
          <label>Git 可执行文件路径</label>
          <div class="setup-row">
            <input
              v-model="gitPathInput"
              placeholder="留空则使用系统 PATH 中的 git"
              class="setup-input"
              @keyup.enter="saveGitPath"
            />
            <button class="btn btn-primary" @click="saveGitPath">检测</button>
          </div>
          <div class="setup-hint">
            · macOS 通常不需要填（系统自带 git）<br/>
            · Windows 如果 git 不在 PATH 中，填完整路径如：<br/>
            <code>C:\Program Files\Git\bin\git.exe</code>
          </div>
        </div>

        <div v-if="!store.gitInfo?.available" class="setup-section">
          <div class="setup-hint" style="margin-top:8px">
            <strong>还没有 Git？</strong><br/>
            · macOS: 安装 Xcode Command Line Tools → <code>xcode-select --install</code><br/>
            · Windows: 下载 <a href="#" @click.prevent="copyText('https://git-scm.com/download/win')">git-scm.com</a> 安装<br/>
            · 或通过 Homebrew: <code>brew install git</code>
          </div>
        </div>

        <div style="display:flex;gap:8px;margin-top:16px;justify-content:flex-end">
          <button v-if="store.gitAvailable" class="btn btn-outline" @click="skipGitConfig">跳过</button>
        </div>
      </div>
    </div>

    <!-- Header -->
    <div class="header">
      <div class="header-left">
        <h1>🔀 Git 小助手</h1>
        <div class="header-branch" v-if="store.repoPath">
          <span>{{ store.repoPath.replace(/^.*[\\/]/, '') }}</span>
          <span class="branch-badge">{{ store.currentBranch }}</span>
          <span v-if="store.repoAccess && !store.repoConnected" class="branch-badge" style="background:#fee2e2;color:#dc2626">未授权</span>
          <span v-else-if="store.repoConnected" class="branch-badge" style="background:#dcfce7;color:#16a34a">{{ store.repoAccess?.auth_method }}</span>
          <span v-if="store.dirty" class="branch-badge" style="background:#fef3c7;color:#d97706">有修改</span>
        </div>
      </div>
      <div class="header-actions">
        <button class="btn btn-outline btn-sm" @click="openGitConfig" title="Git 路径配置">⚙️</button>
        <template v-if="!store.repoPath">
          <input
            v-model="repoInput"
            placeholder="粘贴仓库路径，如 /Users/xxx/project"
            style="width:300px"
            @keyup.enter="selectRepo"
          />
          <button class="btn btn-primary" @click="selectRepo" :disabled="!repoInput || !store.gitAvailable">打开</button>
        </template>
        <template v-else>
          <button class="btn btn-outline btn-sm" @click="store.setOp(false, ''); store.repoPath = ''; store.repoAccess = null">切换仓库</button>
          <button class="btn btn-outline btn-sm" @click="store.refreshAll()" :disabled="store.loading">
            <span v-if="store.loading" class="spinner"></span>
            <span v-else>🔄</span>
            刷新
          </button>
        </template>
      </div>
    </div>

    <!-- Access check panel -->
    <div v-if="store.repoPath && store.repoAccess && !store.repoConnected" class="access-panel warn">
      <div class="access-icon">🔒</div>
      <div class="access-body">
        <div style="font-weight:600;margin-bottom:4px">远程仓库不可达（{{ store.repoAccess.auth_method }}）</div>
        <div style="font-size:12px;white-space:pre-wrap;line-height:1.6">{{ store.repoAccess.message }}</div>
      </div>
      <button class="btn btn-outline btn-sm" style="flex-shrink:0" @click="store.checkRepoAccess()">重试</button>
    </div>

    <!-- Main content -->
    <div class="content" v-if="store.repoPath">
      <div class="panel">
        <div class="panel-header">
          <span>📦 创建分支</span>
        </div>
        <div class="panel-body">
          <BranchCreator />
        </div>
      </div>
      <div class="panel">
        <div class="panel-header">
          <span>🌿 分支列表</span>
          <span style="font-size:11px;font-weight:400">
            {{ store.branches.length }} 个分支
          </span>
        </div>
        <div class="panel-body">
          <BranchList />
        </div>
      </div>
    </div>

    <!-- Quick actions -->
    <div class="panel" v-if="store.repoPath" style="flex-shrink:0">
      <div class="panel-header">
        <span>⚡ 快捷操作</span>
        <div class="status-bar">
          <span :class="['status-item', store.status.clean ? 'clean' : 'dirty']">
            {{ store.status.clean ? '✓ 工作区干净' : `⚠ 修改 ${store.status.unstaged + store.status.untracked} 项` }}
          </span>
        </div>
      </div>
      <div class="panel-body">
        <QuickActions />
      </div>
    </div>

    <!-- Bottom bar -->
    <div class="bottom-bar">
      <div v-if="store.lastOp" :class="['op-msg', store.lastOp.success ? 'success' : 'error']">
        <span>{{ store.lastOp.success ? '✓' : '✗' }}</span>
        <span>{{ store.lastOp.message }}</span>
      </div>
      <div v-else>
        <span v-if="store.repoPath">就绪 — 选择分支类型和名称开始工作</span>
        <span v-else-if="store.gitAvailable">输入仓库路径开始使用</span>
        <span v-else>⚠ 未检测到 Git，请先点击右上角 ⚙️ 配置</span>
      </div>
      <div v-if="store.loading" style="display:flex;align-items:center;gap:6px">
        <span class="spinner"></span>
        <span>执行中...</span>
      </div>
    </div>
  </div>
</template>
