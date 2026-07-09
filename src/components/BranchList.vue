<script setup lang="ts">
import { useGitStore } from "@/stores/git";

const store = useGitStore();

function handleSwitch(name: string) {
  if (name === store.currentBranch) return;
  store.switchBranch(name);
}
</script>

<template>
  <div v-if="store.branches.length === 0" style="text-align:center;padding:20px;color:var(--text-secondary)">
    暂无分支数据
  </div>
  <ul class="branch-list" v-else>
    <li
      v-for="b in store.branches"
      :key="b.name"
      :class="['branch-item', { current: b.current }]"
      @click="handleSwitch(b.name)"
    >
      <div class="branch-name">
        <span :class="['branch-dot', b.current ? 'current' : 'other']"></span>
        <span>{{ b.name }}</span>
      </div>
      <div class="branch-commit" :title="b.lastCommit">
        {{ b.lastCommit }}
      </div>
      <button
        v-if="!b.current"
        class="btn btn-outline btn-sm"
        style="flex-shrink:0;margin-left:8px"
        @click.stop="handleSwitch(b.name)"
        :disabled="store.loading"
      >
        切换
      </button>
      <span v-else style="font-size:11px;color:var(--success);flex-shrink:0;margin-left:8px">当前</span>
    </li>
  </ul>
</template>
