<script setup lang="ts">
import { onMounted, ref } from "vue";
import { useGitStore } from "@/stores/git";
import ProjectManager from "@/components/ProjectManager.vue";
import BranchCreator from "@/components/BranchCreator.vue";
import BranchList from "@/components/BranchList.vue";
import QuickActions from "@/components/QuickActions.vue";

const store = useGitStore();
const showGitConfig = ref(false);
const showUsernameConfig = ref(false);
const gitPathInput = ref("");
const usernameInput = ref("");
const useUsernameCheck = ref(false);

onMounted(async () => {
  store.loadProjects();
  await store.checkGit();
  if (!store.gitAvailable) {
    showGitConfig.value = true;
  } else if (store.activeProject) {
    // Auto-open last project
    store.setRepo(store.activeProject.localPath);
  }
});

// ─── Git config ──────────────────────────────────────────────────────────────

function openGitConfig() {
  gitPathInput.value = store.savedGitPath;
  showGitConfig.value = true;
}

async function saveGitPath() {
  store.setGitPath(gitPathInput.value);
  await store.checkGit(gitPathInput.value);
  if (store.gitAvailable) {
    showGitConfig.value = false;
  }
}

function openUsernameConfig() {
  usernameInput.value = store.username;
  useUsernameCheck.value = store.useUsername;
  showUsernameConfig.value = true;
}

function saveUsername() {
  store.setUsername(usernameInput.value);
  store.setUseUsername(useUsernameCheck.value);
  showUsernameConfig.value = false;
}

function switchProject() {
  store.setActiveProject(null);
}
</script>

<template>
  <div class="app">
    <!-- Git config overlay -->
    <div v-if="showGitConfig" class="setup-overlay">
      <div class="setup-card">
        <div class="setup-icon">🔧</div>
        <h2>Git 环境配置</h2>
        <div v-if="!store.gitAvailable" class="setup-status warn">⚠ 未检测到 Git</div>
        <div v-else class="setup-status ok">✓ {{ store.gitInfo?.version }}</div>
        <div class="setup-section">
          <label>Git 可执行文件路径</label>
          <div class="setup-row">
            <input v-model="gitPathInput" placeholder="留空则使用系统 PATH" class="setup-input" @keyup.enter="saveGitPath" />
            <button class="btn btn-primary" @click="saveGitPath">检测</button>
          </div>
          <div class="setup-hint">
            · macOS 通常不填（系统自带）<br/>
            · Windows 填如：<code>C:\Program Files\Git\bin\git.exe</code>
          </div>
        </div>
        <div style="display:flex;gap:8px;margin-top:16px;justify-content:flex-end">
          <button v-if="store.gitAvailable" class="btn btn-outline" @click="showGitConfig = false">关闭</button>
        </div>
      </div>
    </div>

    <!-- Username config overlay -->
    <div v-if="showUsernameConfig" class="setup-overlay" @click.self="showUsernameConfig = false">
      <div class="setup-card">
        <div class="setup-icon">👤</div>
        <h2>用户名设置</h2>
        <div class="setup-section">
          <label style="display:flex;flex-direction:column;gap:3px">
            <span>用户名</span>
            <input v-model="usernameInput" placeholder="如：zhangsan" class="setup-input" @keyup.enter="saveUsername" />
          </label>
          <div style="margin-top:8px;display:flex;align-items:center;gap:6px;font-size:13px">
            <input type="checkbox" id="use-uname" v-model="useUsernameCheck" />
            <label for="use-uname" style="cursor:pointer">创建分支时添加用户名前缀</label>
          </div>
          <div class="setup-hint" style="margin-top:8px">
            开启后创建的分支格式：<code>feature/zhangsan/goods-cart</code>
          </div>
        </div>
        <div class="modal-actions">
          <button class="btn btn-outline" @click="showUsernameConfig = false">关闭</button>
          <button class="btn btn-primary" @click="saveUsername">保存</button>
        </div>
      </div>
    </div>

    <!-- ─── LOADING OVERLAY ─── -->
    <div v-if="store.loading" class="loading-overlay">
      <div class="loading-card">
        <div class="loading-spinner">
          <div class="spinner-ring"></div>
          <div class="spinner-ring spinner-ring-inner"></div>
        </div>
        <div class="loading-text">{{ store.currentOp || '执行中...' }}</div>
        <div class="loading-dots">
          <span></span><span></span><span></span>
        </div>
      </div>
    </div>

    <!-- ─── HEADER ─── -->
    <div class="header">
      <div class="header-left">
        <h1 @click="switchProject" style="cursor:pointer">🔀 Git 小助手</h1>

        <!-- Project tabs -->
        <div v-if="store.activeProject" class="project-tabs">
          <span class="project-tab active">{{ store.activeProject.name }}</span>
          <span v-for="p in store.projects.filter(x => x.id !== store.activeProjectId)" :key="p.id"
                class="project-tab" @click="store.setActiveProject(p.id)">{{ p.name }}</span>
          <span class="project-tab add-tab" @click="switchProject">+</span>
        </div>

        <!-- Branch / status badges -->
        <div v-if="store.repoPath" class="header-badges">
          <span class="badge badge-branch">{{ store.currentBranch }}</span>
          <span v-if="store.repoAccess && !store.repoConnected" class="badge badge-danger">未授权</span>
          <span v-else-if="store.repoConnected" class="badge badge-success">{{ store.repoAccess?.auth_method }}</span>
          <span v-if="store.dirty" class="badge badge-warn">有修改</span>
        </div>
      </div>

      <div class="header-actions">
        <button class="btn btn-outline btn-sm" @click="openUsernameConfig" title="用户名设置">👤</button>
        <button class="btn btn-outline btn-sm" @click="openGitConfig" title="Git 路径配置">⚙️</button>
        <button v-if="store.repoPath" class="btn btn-outline btn-sm" @click="store.refreshAll()" :disabled="store.loading">
          <span v-if="store.loading" class="spinner"></span>
          <span v-else>🔄</span>
        </button>
      </div>
    </div>

    <!-- ─── PROJECT MANAGER ─── -->
    <ProjectManager v-if="!store.activeProject" />

    <!-- ─── WORKSPACE ─── -->
    <template v-if="store.activeProject">
      <!-- Access warning -->
      <div v-if="store.repoAccess && !store.repoConnected" class="access-panel warn">
        <div class="access-icon">🔒</div>
        <div class="access-body">
          <div style="font-weight:600;margin-bottom:4px">远程仓库不可达（{{ store.repoAccess.auth_method }}）</div>
          <div style="font-size:12px;white-space:pre-wrap;line-height:1.6">{{ store.repoAccess.message }}</div>
        </div>
        <button class="btn btn-outline btn-sm" style="flex-shrink:0" @click="store.checkRepoAccess()">重试</button>
      </div>

      <!-- Main panels -->
      <div class="content">
        <div class="panel">
          <div class="panel-header"><span>📦 创建分支</span></div>
          <div class="panel-body"><BranchCreator /></div>
        </div>
        <div class="panel">
          <div class="panel-header">
            <span>🌿 分支列表</span>
            <span style="font-size:11px;font-weight:400">{{ store.branches.length }} 个</span>
          </div>
          <div class="panel-body"><BranchList /></div>
        </div>
      </div>

      <!-- Quick actions -->
      <div class="panel" style="flex-shrink:0">
        <div class="panel-header">
          <span>⚡ 快捷操作</span>
          <div class="status-bar">
            <span :class="['status-item', store.status.clean ? 'clean' : 'dirty']">
              {{ store.status.clean ? '✓ 工作区干净' : `⚠ 修改 ${store.status.unstaged + store.status.untracked} 项` }}
            </span>
          </div>
        </div>
        <div class="panel-body"><QuickActions /></div>
      </div>
    </template>

    <!-- ─── BOTTOM BAR ─── -->
    <div class="bottom-bar">
      <div v-if="store.lastOp" :class="['op-msg', store.lastOp.success ? 'success' : 'error']">
        <span>{{ store.lastOp.success ? '✓' : '✗' }}</span>
        <span>{{ store.lastOp.message }}</span>
      </div>
      <div v-else>
        <span v-if="store.activeProject">就绪 — 选择分支类型和名称开始工作</span>
        <span v-else-if="store.gitAvailable">选择或添加一个项目开始使用</span>
        <span v-else>⚠ 未检测到 Git，请点击 ⚙️ 配置</span>
      </div>
      <div v-if="store.loading" style="display:flex;align-items:center;gap:6px">
        <span class="spinner"></span>
        <span>执行中...</span>
      </div>
    </div>
  </div>
</template>
