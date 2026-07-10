<script setup lang="ts">
import { ref } from "vue";
import { useGitStore } from "@/stores/git";

const store = useGitStore();

const showAdd = ref(false);
const editId = ref<string | null>(null);
const formName = ref("");
const formPath = ref("");
const formUrl = ref("");

function openAdd() {
  editId.value = null;
  formName.value = "";
  formPath.value = "";
  formUrl.value = "";
  showAdd.value = true;
}

function openEdit(id: string) {
  const p = store.projects.find((x) => x.id === id);
  if (!p) return;
  editId.value = id;
  formName.value = p.name;
  formPath.value = p.localPath;
  formUrl.value = p.gitUrl;
  showAdd.value = true;
}

function save() {
  const name = formName.value.trim();
  const path = formPath.value.trim();
  const url = formUrl.value.trim();
  if (!name || !path) return;

  if (editId.value) {
    store.updateProject(editId.value, { name, localPath: path, gitUrl: url });
  } else {
    store.addProject(name, path, url);
  }
  showAdd.value = false;
}

function confirmDelete(id: string) {
  const p = store.projects.find((x) => x.id === id);
  if (p && confirm(`删除项目「${p.name}」？`)) {
    store.deleteProject(id);
  }
}

function handleOpen(id: string) {
  store.setActiveProject(id);
}
</script>

<template>
  <div class="project-page">
    <div class="project-header">
      <h2>📁 项目列表</h2>
      <button class="btn btn-primary" @click="openAdd">+ 添加项目</button>
    </div>

    <!-- Add / Edit dialog -->
    <div v-if="showAdd" class="modal-overlay" @click.self="showAdd = false">
      <div class="modal-card">
        <h3>{{ editId ? '编辑项目' : '添加项目' }}</h3>
        <div class="modal-body">
          <label>
            <span>项目名称</span>
            <input v-model="formName" placeholder="如：Admin 后台" />
          </label>
          <label>
            <span>本地路径</span>
            <input v-model="formPath" placeholder="如：D:\\projects\\admin" />
          </label>
          <label>
            <span>Git 远程地址（可选）</span>
            <input v-model="formUrl" placeholder="如：git@github.com:xxx/xxx.git" />
          </label>
        </div>
        <div class="modal-actions">
          <button class="btn btn-outline" @click="showAdd = false">取消</button>
          <button class="btn btn-primary" @click="save" :disabled="!formName.trim() || !formPath.trim()">
            {{ editId ? '保存' : '添加' }}
          </button>
        </div>
      </div>
    </div>

    <!-- Empty state -->
    <div v-if="store.projects.length === 0" class="project-empty">
      <div class="empty-icon">📂</div>
      <p>还没有添加任何项目</p>
      <p style="font-size:12px;color:var(--text-secondary)">点击上方「+ 添加项目」开始</p>
    </div>

    <!-- Project grid -->
    <div v-else class="project-grid">
      <div
        v-for="p in store.projects"
        :key="p.id"
        class="project-card"
        @dblclick="handleOpen(p.id)"
      >
        <div class="project-card-top">
          <div class="project-icon">📁</div>
          <div class="project-info">
            <div class="project-name">{{ p.name }}</div>
            <div class="project-meta" :title="p.localPath">{{ p.localPath }}</div>
            <div v-if="p.gitUrl" class="project-meta git-url" :title="p.gitUrl">{{ p.gitUrl }}</div>
          </div>
        </div>
        <div class="project-card-actions">
          <button class="btn btn-primary btn-sm" @click="handleOpen(p.id)">打开</button>
          <button class="btn btn-outline btn-sm" @click="openEdit(p.id)">编辑</button>
          <button class="btn btn-outline btn-sm" style="color:var(--danger)" @click="confirmDelete(p.id)">删除</button>
        </div>
      </div>
    </div>
  </div>
</template>
