export interface BranchInfo {
  name: string;
  current: boolean;
  remote: boolean;
  lastCommit: string;
  upstream: string | null;
}

export interface GitStatus {
  clean: boolean;
  staged: number;
  unstaged: number;
  untracked: number;
}

export interface BranchType {
  label: string;
  prefix: string;
  icon: string;
}

export const BRANCH_TYPES: BranchType[] = [
  { label: "新功能", prefix: "feature/", icon: "✨" },
  { label: "Bug 修复", prefix: "fix/", icon: "🐛" },
  { label: "文档", prefix: "docs/", icon: "📝" },
  { label: "代码重构", prefix: "refactor/", icon: "🔨" },
  { label: "工具配置", prefix: "chore/", icon: "🔧" },
];

export interface LastOperation {
  success: boolean;
  message: string;
  timestamp: number;
}

export interface Project {
  id: string;
  name: string;
  localPath: string;
  gitUrl: string;
}
