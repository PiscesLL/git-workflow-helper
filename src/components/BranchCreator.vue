<script setup lang="ts">
import { ref, computed } from "vue";
import { useGitStore } from "@/stores/git";
import { BRANCH_TYPES } from "@/types";
import type { BranchType } from "@/types";

const store = useGitStore();
const selectedType = ref<BranchType>(BRANCH_TYPES[0]);
const branchContent = ref("");

const previewName = computed(() => {
  if (!branchContent.value.trim()) return "";
  const sanitized = branchContent.value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fff\u3400-\u4dbf-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  let fullName = selectedType.value.prefix + sanitized;
  if (store.useUsername && store.username) {
    fullName = selectedType.value.prefix + store.username + "/" + sanitized;
  }
  return fullName;
});

const canCreate = computed(() => branchContent.value.trim().length > 0);

function handleCreate() {
  if (!canCreate.value) return;
  const name = branchContent.value.trim().toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
  store.createBranch(selectedType.value, name);
  branchContent.value = "";
}
</script>

<template>
  <div>
    <div class="form-row">
      <label>
        <span>分支类型</span>
        <select v-model="selectedType">
          <option v-for="t in BRANCH_TYPES" :key="t.prefix" :value="t">{{ t.icon }} {{ t.label }}</option>
        </select>
      </label>
      <label>
        <span>开发内容 / 分支名称</span>
        <input v-model="branchContent" placeholder="如：goods-cart" @keyup.enter="handleCreate" />
      </label>
    </div>

    <div class="preview-box" v-if="previewName">{{ previewName }}</div>
    <div class="preview-box" v-else style="color:var(--text-secondary)">输入后显示分支名称预览</div>

    <div v-if="store.useUsername && store.username" style="margin-top:6px;font-size:11px;color:var(--text-secondary)">
      将创建 <code>{{ store.username }}/</code> 前缀的分支
    </div>

    <div style="margin-top:10px;display:flex;gap:8px;align-items:center">
      <button class="btn btn-primary" @click="handleCreate" :disabled="!canCreate || store.loading">
        <span v-if="store.loading" class="spinner"></span>
        <span v-else>✦</span>
        创建并切换
      </button>
      <span style="font-size:11px;color:var(--text-secondary)">
        将基于默认分支创建（已自动拉取最新）
      </span>
    </div>
  </div>
</template>
