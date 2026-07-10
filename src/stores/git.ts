import { defineStore } from "pinia";
import { ref, computed } from "vue";
import { invoke } from "@tauri-apps/api/tauri";
import type { BranchInfo, GitStatus, LastOperation, BranchType, Project } from "@/types";

const GIT_PATH_KEY = "git-helper-git-path";
const PROJECTS_KEY = "git-helper-projects";
const ACTIVE_KEY = "git-helper-active-project";
const USERNAME_KEY = "git-helper-username";
const USE_USERNAME_KEY = "git-helper-use-username";

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

  // ─── Username ──────────────────────────────────────────────────────────────

  const username = ref(localStorage.getItem(USERNAME_KEY) || "");
  const useUsername = ref(localStorage.getItem(USE_USERNAME_KEY) !== "false");

  function setUsername(name: string) {
    username.value = name;
    localStorage.setItem(USERNAME_KEY, name);
  }

  function setUseUsername(v: boolean) {
    useUsername.value = v;
    localStorage.setItem(USE_USERNAME_KEY, String(v));
  }

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
  const currentOp = ref("");

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
    currentOp.value = "刷新中...";
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
      currentOp.value = "";
    }
  }

  async function createBranch(type: BranchType, name: string) {
    if (!repoPath.value || !name) return;
    currentOp.value = "创建分支中...";
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
      currentOp.value = "";
    }
  }

  async function switchBranch(name: string) {
    if (!repoPath.value || !name || name === currentBranch.value) return;
    currentOp.value = "切换分支中...";
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
      currentOp.value = "";
    }
  }

  async function pull() {
    if (!repoPath.value) return;
    currentOp.value = "拉取中...";
    loading.value = true;
    try {
      const msg = await invoke<string>("git_pull", { path: repoPath.value, gitPath: gp() });
      setOp(true, msg);
      await refreshAll();
    } catch (e: any) {
      setOp(false, String(e));
    } finally {
      loading.value = false;
      currentOp.value = "";
    }
  }

  async function commit(message: string) {
    if (!repoPath.value || !message) return;
    currentOp.value = "提交中...";
    loading.value = true;
    try {
      await invoke<string>("git_add_commit", { path: repoPath.value, message, gitPath: gp() });
      setOp(true, `已提交: ${message}`);
      await refreshAll();
    } catch (e: any) {
      setOp(false, String(e));
    } finally {
      loading.value = false;
      currentOp.value = "";
    }
  }

  async function push() {
    if (!repoPath.value) return;
    currentOp.value = "推送中...";
    loading.value = true;
    try {
      const msg = await invoke<string>("git_push", { path: repoPath.value, gitPath: gp() });
      setOp(true, msg);
      await refreshAll();
    } catch (e: any) {
      setOp(false, String(e));
    } finally {
      loading.value = false;
      currentOp.value = "";
    }
  }

  async function pullCommitPush(message: string) {
    if (!repoPath.value || !message) return;
    currentOp.value = "拉取 → 提交 → 推送中...";
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
      currentOp.value = "";
    }
  }

  async function checkoutRemote(remoteName: string) {
    if (!repoPath.value) return;
    currentOp.value = "拉取远程分支中...";
    loading.value = true;
    try {
      const msg = await invoke<string>("checkout_remote", {
        path: repoPath.value, remoteName, gitPath: gp(),
      });
      setOp(true, msg);
      await refreshAll();
    } catch (e: any) {
      setOp(false, String(e));
    } finally {
      loading.value = false;
      currentOp.value = "";
    }
  }

  function translateError(msg: string): string {
    if (!msg) return msg;
    const rules: [RegExp, string][] = [
      [/not a git repository/i, "不是有效的 Git 仓库，请检查路径是否正确"],
      [/pathspec.*did not match/i, "路径或文件名不匹配"],
      [/already exists/i, "分支或文件已存在"],
      [/CONFLICT/i, "合并冲突，请手动解决"],
      [/Permission denied/i, "权限不足，无法连接远程仓库"],
      [/Authentication failed/i, "认证失败，请检查 Git 凭据配置"],
      [/Could not resolve host/i, "无法解析远程主机，请检查网络连接"],
      [/timed out/i, "连接超时，请检查网络或代理设置"],
      [/failed to push/i, "推送失败，请确认远程仓库状态"],
      [/divergent branches/i, "本地与远程分支已分叉，请先拉取合并"],
      [/Merge conflict/i, "合并冲突，请手动解决"],
      [/branch.*not found/i, "分支不存在"],
      [/remote origin already exists/i, "远程仓库 origin 已存在"],
      [/Could not read/i, "无法读取文件或仓库"],
      [/failed to pull/i, "拉取失败，请检查远程仓库状态"],
      [/no such file or directory/i, "路径不存在，请检查仓库路径"],
      [/is not a git command/i, "Git 命令无效，请检查 Git 版本"],
      [/SSL certificate problem/i, "SSL 证书验证失败，请检查网络或配置"],
    ];
    for (const [pattern, cn] of rules) {
      if (pattern.test(msg)) return cn;
    }
    // If it's a git error (starts with "fatal:" or "error:"), show clean Chinese prefix
    return msg
      .replace(/^fatal:\s*/i, "")
      .replace(/^error:\s*/i, "")
      .replace(/^warning:\s*/i, "警告: ");
  }

  function setOp(success: boolean, message: string) {
    lastOp.value = { success, message: success ? message : translateError(message), timestamp: Date.now() };
  }

  return {
    // Project mgmt
    projects, activeProjectId, activeProject, savedGitPath,
    loadProjects, addProject, updateProject, deleteProject, setActiveProject,
    // Git state
    repoPath, gitPath, gitInfo, repoAccess,
    currentBranch, branches, status, lastOp, loading, currentOp, dirty,
    gitAvailable, repoConnected,
    // Actions
    checkGit, setGitPath, checkRepoAccess,
    setRepo, refreshAll, createBranch, switchBranch, checkoutRemote,
    username, useUsername, setUsername, setUseUsername,
    pull, commit, push, pullCommitPush, setOp,
  };
});
