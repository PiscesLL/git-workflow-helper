<script setup lang="ts">
import { ref } from "vue";
import { useGitStore } from "@/stores/git";

const store = useGitStore();
const commitMsg = ref("");

function handleCommit() {
  if (!commitMsg.value.trim()) return;
  store.commit(commitMsg.value.trim());
  commitMsg.value = "";
}

function handlePullCommitPush() {
  if (!commitMsg.value.trim()) return;
  store.pullCommitPush(commitMsg.value.trim());
  commitMsg.value = "";
}
</script>

<template>
  <div class="quick-grid">
    <button class="btn btn-outline" @click="store.pull()" :disabled="store.loading">
      <span>⬇</span> 拉取
    </button>
    <button class="btn btn-success" @click="store.push()" :disabled="store.loading">
      <span>⬆</span> 推送
    </button>
  </div>

  <div class="commit-form">
    <input
      v-model="commitMsg"
      placeholder="输入 commit message，如: feat: 完成用户登录"
      style="flex:1"
      @keyup.enter="handleCommit"
    />
    <button class="btn btn-primary" @click="handleCommit" :disabled="!commitMsg.trim() || store.loading">
      提交
    </button>
    <button
      class="btn btn-primary"
      style="background:var(--warning);color:#fff"
      @click="handlePullCommitPush"
      :disabled="!commitMsg.trim() || store.loading"
      title="自动拉取 → 提交 → 推送"
    >
      拉→提→推
    </button>
  </div>

  <div style="margin-top:8px;font-size:11px;color:var(--text-secondary);display:flex;gap:16px">
    <span>📌 提交前自动执行拉取，避免冲突</span>
    <span>📌 commit 格式: 类型: 描述</span>
  </div>
</template>
