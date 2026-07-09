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
  // Sanitize: lowercase, replace spaces/special chars with hyphens
  const sanitized = branchContent.value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fff\u3400-\u4dbf-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  return selectedType.value.prefix + sanitized;
});

const canCreate = computed(() => branchContent.value.trim().length > 0);

function handleCreate() {
  if (!canCreate.value) return;
  store.createBranch(selectedType.value, branchContent.value.trim().toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, ""));
  branchContent.value = "";
}
</script>

<template>
  <div>
    <div class="form-row">
      <label>
        <span>分支类型</span>
        <select v-model="selectedType">
          <option v-for="t in BRANCH_TYPES" :key="t.prefix" :value="t">
            {{ t.icon }} {{ t.label }}
          </option>
        </select>
      </label>
      <label>
        <span>开发内容 / 分支名称</span>
        <input
          v-model="branchContent"
          placeholder="如：goods-cart 或 商品购物车"
          @keyup.enter="handleCreate"
        />
      </label>
    </div>

    <div class="preview-box" v-if="previewName">
      {{ previewName }}
    </div>
    <div class="preview-box" v-else style="color:var(--text-secondary)">
      输入内容后将显示分支名称预览
    </div>

    <div style="margin-top:10px;display:flex;gap:8px">
      <button class="btn btn-primary" @click="handleCreate" :disabled="!canCreate || store.loading">
        <span v-if="store.loading" class="spinner"></span>
        <span v-else>✦</span>
        创建并切换
      </button>
      <span style="font-size:11px;color:var(--text-secondary);align-self:center">
        将基于 main 创建分支（已自动拉取最新）
      </span>
    </div>
  </div>
</template>
