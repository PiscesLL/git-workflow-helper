import { defineStore } from "pinia";
import { ref, computed } from "vue";
import { invoke } from "@tauri-apps/api/tauri";
import type { BranchInfo, GitStatus, LastOperation, BranchType, Project } from "@/types";

const GIT_PATH_KEY = "git-helper-git-path";
const PROJECTS_KEY = "git-helper-projects";
const ACTIVE_KEY = "git-helper-active-project";

function uid(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

export const useGitStore = defineStore("git", () => {
  // ─── Project management ───────────────────────────────────────────────────

  const projects = ref<Project[]>([]);
  const activeProjectId = ref<string | null>(null);
  const savedGitPath = ref(localStorage.getItem(GIT_PATH_KEY) || "");

  const activeProject = computed(() =>
    projects.value.find((p) => p.id === activeProjectId.value) ?? null
  );

  // Persist
  function saveProjects() {
    localStorage.setItem(PROJECTS_KEY, JSON.stringify(projects.value));
  }
  function saveActive() {
    if (activeProjectId.value) localStorage.setItem(ACTIVE_KEY, activeProjectId.value);
    else localStorage.removeItem(ACTIVE_KEY);
  }

  function loadProjects() {
    try {
      const raw = localStorage.getItem(PROJECTS_KEY);
      if (raw) projects.value = JSON.parse(raw);
    } catch { projects.value = []; }

    const saved = localStorage.getItem(ACTIVE_KEY);
    if (saved && projects.value.some((p) => p.id === saved)) {
      activeProjectId.value = saved;
    }
  }

  function addProject(name: string, localPath: string, gitUrl: string) {
    const p: Project = { id: uid(), name, localPath, gitUrl };
    projects.value.push(p);
    saveProjects();
    return p;
  }

  function updateProject(id: string, data: Partial<Project>) {
    const p = projects.value.find((x) => x.id === id);
    if (p) {
      Object.assign(p, data);
      saveProjects();
    }
  }

  function deleteProject(id: string) {
    projects.value = projects.value.filter((x) => x.id !== id);
    if (activeProjectId.value === id) {
      activeProjectId.value = null;
      saveActive();
    }
    saveProjects();
  }

  function setActiveProject(id: string | null) {
    activeProjectId.value = id;
    saveActive();
    if (id) {
      const p = projects.value.find((x) => x.id === id);
      if (p) setRepo(p.localPath);
    } else {
      setRepo("");
    }
  }

  // ─── Repo & Git ────────────────────────────────────────────────────────────

  const repoPath = ref("");
  const gitPath = ref(savedGitPath.value);
  const gitInfo = ref<{ available: boolean; version: string; path: string } | null>(null);
  const repoAccess = ref<{ reachable: boolean; remote_url: string; message: string; auth_method: string } | null>(null);
  const currentBranch = ref("");
  const branches = ref<BranchInfo[]>([]);
  const status = ref<GitStatus>({ clean: true, staged: 0, unstaged: 0, untracked: 0 });
  const lastOp = ref<LastOperation | null>(null);
  const loading = ref(false);

  const dirty = computed(() => !status.value.clean);
  const gitAvailable = computed(() => gitInfo.value?.available ?? false);
  const repoConnected = computed(() => repoAccess.value?.reachable ?? false);

  // ─── Git detection ─────────────────────────────────────────────────────────

  async function checkGit(path?: string) {
    const gp = path ?? gitPath.value;
    const result = await invoke<any>("check_git", { gitPath: gp || null });
    gitInfo.value = result;
    if (result.available && gp) {
      setGitPath(gp);
    }
    return result.available;
  }

  function setGitPath(path: string) {
    gitPath.value = path;
    savedGitPath.value = path;
    localStorage.setItem(GIT_PATH_KEY, path);
  }

  // ─── Repo access check ─────────────────────────────────────────────────────

  async function checkRepoAccess() {
    if (!repoPath.value) return;
    try {
      const result = await invoke<any>("check_repo_access", {
        path: repoPath.value,
        gitPath: gitPath.value || null,
      });
      repoAccess.value = result;
      return result.reachable;
    } catch (e) {
      repoAccess.value = { reachable: false, remote_url: "", message: String(e), auth_method: "" };
      return false;
    }
  }

  function setRepo(path: string) {
    repoPath.value = path;
    repoAccess.value = null;
    if (path) {
      refreshAll();
      checkRepoAccess();
    }
  }

  // ─── Git operations ────────────────────────────────────────────────────────

  function gp(): string | null {
    return gitPath.value || null;
  }

  async function refreshAll() {
    if (!repoPath.value) return;
    loading.value = true;
    try {
      const [b, s, cur] = await Promise.all([
        invoke<BranchInfo[]>("list_branches", { path: repoPath.value, gitPath: gp() }),
        invoke<GitStatus>("git_status", { path: repoPath.value, gitPath: gp() }),
        invoke<string>("get_current_branch", { path: repoPath.value, gitPath: gp() }),
      ]);
      branches.value = b;
      status.value = s;
      currentBranch.value = cur;
    } catch (e: any) {
      setOp(false, String(e));
    } finally {
      loading.value = false;
    }
  }

  async function createBranch(type: BranchType, name: string) {
    if (!repoPath.value || !name) return;
    loading.value = true;
    try {
      const fullName = type.prefix + name;
      await invoke<string>("create_branch", {
        path: repoPath.value, name: fullName, gitPath: gp(),
      });
      setOp(true, `已创建并切换到 ${fullName}`);
      await refreshAll();
    } catch (e: any) {
      setOp(false, String(e));
    } finally {
      loading.value = false;
    }
  }

  async function switchBranch(name: string) {
    if (!repoPath.value || !name || name === currentBranch.value) return;
    loading.value = true;
    try {
      if (dirty.value) {
        await invoke<string>("git_stash", { path: repoPath.value, gitPath: gp() });
        await invoke<string>("switch_branch", { path: repoPath.value, name, gitPath: gp() });
        await invoke<string>("git_stash_pop", { path: repoPath.value, gitPath: gp() });
        setOp(true, `已切换到 ${name}（已暂存并恢复本地修改）`);
      } else {
        await invoke<string>("switch_branch", { path: repoPath.value, name, gitPath: gp() });
        setOp(true, `已切换到 ${name}`);
      }
      await refreshAll();
    } catch (e: any) {
      setOp(false, String(e));
    } finally {
      loading.value = false;
    }
  }

  async function pull() {
    if (!repoPath.value) return;
    loading.value = true;
    try {
      const msg = await invoke<string>("git_pull", { path: repoPath.value, gitPath: gp() });
      setOp(true, msg);
      await refreshAll();
    } catch (e: any) {
      setOp(false, String(e));
    } finally {
      loading.value = false;
    }
  }

  async function commit(message: string) {
    if (!repoPath.value || !message) return;
    loading.value = true;
    try {
      await invoke<string>("git_add_commit", { path: repoPath.value, message, gitPath: gp() });
      setOp(true, `已提交: ${message}`);
      await refreshAll();
    } catch (e: any) {
      setOp(false, String(e));
    } finally {
      loading.value = false;
    }
  }

  async function push() {
    if (!repoPath.value) return;
    loading.value = true;
    try {
      const msg = await invoke<string>("git_push", { path: repoPath.value, gitPath: gp() });
      setOp(true, msg);
      await refreshAll();
    } catch (e: any) {
      setOp(false, String(e));
    } finally {
      loading.value = false;
    }
  }

  async function pullCommitPush(message: string) {
    if (!repoPath.value || !message) return;
    loading.value = true;
    try {
      await invoke<string>("git_pull", { path: repoPath.value, gitPath: gp() });
      await invoke<string>("git_add_commit", { path: repoPath.value, message, gitPath: gp() });
      const pushMsg = await invoke<string>("git_push", { path: repoPath.value, gitPath: gp() });
      setOp(true, `拉取 → 提交 → 推送完成: ${pushMsg}`);
      await refreshAll();
    } catch (e: any) {
      setOp(false, String(e));
    } finally {
      loading.value = false;
    }
  }

  function setOp(success: boolean, message: string) {
    lastOp.value = { success, message, timestamp: Date.now() };
  }

  return {
    // Project mgmt
    projects, activeProjectId, activeProject, savedGitPath,
    loadProjects, addProject, updateProject, deleteProject, setActiveProject,
    // Git state
    repoPath, gitPath, gitInfo, repoAccess,
    currentBranch, branches, status, lastOp, loading, dirty,
    gitAvailable, repoConnected,
    // Actions
    checkGit, setGitPath, checkRepoAccess,
    setRepo, refreshAll, createBranch, switchBranch,
    pull, commit, push, pullCommitPush, setOp,
  };
});
