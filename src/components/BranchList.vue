<script setup lang="ts">
import { useGitStore } from "@/stores/git";

const store = useGitStore();

function handleSwitch(name: string) {
  if (name === store.currentBranch) return;
  store.switchBranch(name);
}

function handleCheckoutRemote(name: string) {
  store.checkoutRemote(name);
}
</script>

<template>
  <div v-if="store.branches.length === 0" style="text-align:center;padding:20px;color:var(--text-secondary)">
    暂无分支数据
  </div>

  <!-- Local branches -->
  <div v-if="store.branches.some(b => !b.remote)" style="font-size:11px;color:var(--text-secondary);margin-bottom:4px">本地分支</div>
  <ul class="branch-list">
    <li
      v-for="b in store.branches.filter(b => !b.remote)"
      :key="b.name"
      :class="['branch-item', { current: b.current }]"
      @click="handleSwitch(b.name)"
    >
      <div class="branch-name">
        <span :class="['branch-dot', b.current ? 'current' : 'other']"></span>
        <span>{{ b.name }}</span>
      </div>
      <div class="branch-commit" :title="b.lastCommit">{{ b.lastCommit }}</div>
      <button
        v-if="!b.current"
        class="btn btn-outline btn-sm"
        style="flex-shrink:0;margin-left:8px"
        @click.stop="handleSwitch(b.name)"
        :disabled="store.loading"
      >切换</button>
      <span v-else style="font-size:11px;color:var(--success);flex-shrink:0;margin-left:8px">当前</span>
    </li>
  </ul>

  <!-- Remote branches -->
  <div v-if="store.branches.some(b => b.remote)" style="font-size:11px;color:var(--text-secondary);margin:8px 0 4px">远程分支</div>
  <ul class="branch-list">
    <li
      v-for="b in store.branches.filter(b => b.remote)"
      :key="b.name"
      class="branch-item"
    >
      <div class="branch-name">
        <span class="branch-dot" style="background:#93c5fd;width:6px;height:6px"></span>
        <span style="color:var(--text-secondary)">{{ b.name }}</span>
      </div>
      <div class="branch-commit" :title="b.lastCommit" style="color:var(--text-secondary)">{{ b.lastCommit }}</div>
      <button
        class="btn btn-outline btn-sm"
        style="flex-shrink:0;margin-left:8px"
        @click.stop="handleCheckoutRemote(b.name)"
        :disabled="store.loading"
      >拉取</button>
    </li>
  </ul>
</template>
