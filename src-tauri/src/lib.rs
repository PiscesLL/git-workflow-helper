use serde::Serialize;
use std::process::Command;

// ─── Data types ──────────────────────────────────────────────────────────────

#[derive(Debug, Serialize)]
pub struct BranchInfo {
    pub name: String,
    pub current: bool,
    pub last_commit: String,
    pub upstream: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct GitStatus {
    pub clean: bool,
    pub staged: usize,
    pub unstaged: usize,
    pub untracked: usize,
}

#[derive(Debug, Serialize)]
pub struct GitInfo {
    pub available: bool,
    pub version: String,
    pub path: String,
}

#[derive(Debug, Serialize)]
pub struct AccessInfo {
    pub reachable: bool,
    pub remote_url: String,
    pub message: String,
    pub auth_method: String,
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

fn git_exe(git_path: &str) -> &str {
    if git_path.is_empty() { "git" } else { git_path }
}

fn git_custom(args: &[&str], path: &str, git_path: &str) -> Result<String, String> {
    Command::new(git_exe(git_path))
        .args(args)
        .current_dir(path)
        .output()
        .map_err(|e| format!("Git 执行失败: {}", e))
        .and_then(|out| {
            if out.status.success() {
                let stdout = String::from_utf8_lossy(&out.stdout).trim().to_string();
                Ok(stdout)
            } else {
                let stderr = String::from_utf8_lossy(&out.stderr).trim().to_string();
                Err(if stderr.is_empty() {
                    format!("Git 命令失败 (exit code: {:?})", out.status.code())
                } else {
                    stderr
                })
            }
        })
}

// ─── System checks ──────────────────────────────────────────────────────────

#[tauri::command]
fn check_git(git_path: Option<String>) -> GitInfo {
    let path = git_path.unwrap_or_default();
    let exe = git_exe(&path);

    match Command::new(exe).arg("--version").output() {
        Ok(out) if out.status.success() => {
            let version = String::from_utf8_lossy(&out.stdout).trim().to_string();
            // Resolve the actual path
            let resolved = if cfg!(target_os = "windows") {
                // On Windows, `where git` gives the path
                match Command::new("where").arg(exe).output() {
                    Ok(w) => String::from_utf8_lossy(&w.stdout).lines().next().unwrap_or(exe).to_string(),
                    Err(_) => exe.to_string(),
                }
            } else {
                // On macOS/Linux, `which git` gives the path
                match Command::new("which").arg(exe).output() {
                    Ok(w) => String::from_utf8_lossy(&w.stdout).trim().to_string(),
                    Err(_) => exe.to_string(),
                }
            };

            GitInfo {
                available: true,
                version,
                path: resolved,
            }
        }
        _ => GitInfo {
            available: false,
            version: String::new(),
            path: exe.to_string(),
        },
    }
}

#[tauri::command]
fn check_repo_access(path: String, git_path: Option<String>) -> AccessInfo {
    let gp = git_path.unwrap_or_default();

    // Get remote URL
    let remote = match git_custom(&["remote", "get-url", "origin"], &path, &gp) {
        Ok(url) => url,
        Err(_) => {
            return AccessInfo {
                reachable: false,
                remote_url: String::new(),
                message: "未找到远程仓库 origin，请先 `git remote add origin <url>`".to_string(),
                auth_method: String::new(),
            }
        }
    };

    // Detect auth method
    let auth_method = if remote.starts_with("git@") {
        "SSH"
    } else if remote.starts_with("https://") {
        "HTTPS"
    } else {
        "其他"
    };

    // Try to reach the remote (dry-run fetch)
    match git_custom(&["fetch", "--dry-run", "origin"], &path, &gp) {
        Ok(_) => AccessInfo {
            reachable: true,
            remote_url: remote,
            message: format!("远程仓库可达（{}）", auth_method),
            auth_method: auth_method.to_string(),
        },
        Err(e) => {
            let msg = if e.contains("Permission denied") || e.contains("Authentication failed") {
                if auth_method == "SSH" {
                    format!(
                        "SSH 认证失败。请确保：\n\
                         1. SSH key 已添加到 ssh-agent：ssh-add ~/.ssh/id_ed25519\n\
                         2. 公钥已添加到 GitHub：cat ~/.ssh/id_ed25519.pub → GitHub Settings → SSH Keys\n\
                         3. 如没有 SSH key：ssh-keygen -t ed25519 -C \"your_email\""
                    )
                } else {
                    format!(
                        "HTTPS 认证失败。请配置 Git 凭据：\n\
                         1. GitHub CLI：gh auth login\n\
                         2. 或配置 credential helper：git config --global credential.helper osxkeychain\n\
                         3. 或个人 access token 替代密码登录"
                    )
                }
            } else if e.contains("Could not resolve host") {
                "无法解析远程主机，请检查网络连接和 DNS 设置".to_string()
            } else if e.contains("timed out") {
                "连接超时，请检查网络或代理设置".to_string()
            } else {
                format!("连接异常: {}", e)
            };

            AccessInfo {
                reachable: false,
                remote_url: remote,
                message: msg,
                auth_method: auth_method.to_string(),
            }
        }
    }
}

// ─── Git commands ────────────────────────────────────────────────────────────

#[tauri::command]
fn get_current_branch(path: String, git_path: Option<String>) -> Result<String, String> {
    let gp = git_path.unwrap_or_default();
    let name = git_custom(&["rev-parse", "--abbrev-ref", "HEAD"], &path, &gp)?;
    if name == "HEAD" {
        let hash = git_custom(&["rev-parse", "--short", "HEAD"], &path, &gp)?;
        Ok(format!("detached@{}", hash))
    } else {
        Ok(name)
    }
}

#[tauri::command]
fn list_branches(path: String, git_path: Option<String>) -> Result<Vec<BranchInfo>, String> {
    let gp = git_path.unwrap_or_default();
    let output = git_custom(
        &[
            "branch",
            "--format",
            "%(HEAD)|%(refname:short)|%(upstream:short)|%(subject)",
        ],
        &path,
        &gp,
    )?;

    let branches: Vec<BranchInfo> = output
        .lines()
        .filter(|l| !l.is_empty())
        .map(|line| {
            let parts: Vec<&str> = line.splitn(4, '|').collect();
            let head = parts.first().unwrap_or(&"");
            let name = parts.get(1).unwrap_or(&"").to_string();
            let upstream = parts.get(2).filter(|u| !u.is_empty()).map(|s| s.to_string());
            let subject = parts.get(3).unwrap_or(&"").to_string();
            BranchInfo {
                current: *head == "*",
                name,
                last_commit: subject,
                upstream,
            }
        })
        .collect();

    Ok(branches)
}

#[tauri::command]
fn create_branch(path: String, name: String, git_path: Option<String>) -> Result<String, String> {
    let gp = git_path.unwrap_or_default();
    git_custom(&["checkout", "main"], &path, &gp)?;
    git_custom(&["pull", "origin", "main"], &path, &gp)?;
    git_custom(&["checkout", "-b", &name], &path, &gp)?;
    Ok(format!("已创建并切换到 {}", name))
}

#[tauri::command]
fn switch_branch(path: String, name: String, git_path: Option<String>) -> Result<String, String> {
    let gp = git_path.unwrap_or_default();
    git_custom(&["checkout", &name], &path, &gp)?;
    Ok(format!("已切换到 {}", name))
}

#[tauri::command]
fn git_pull(path: String, git_path: Option<String>) -> Result<String, String> {
    let gp = git_path.unwrap_or_default();
    let branch = get_current_branch(path.clone(), Some(gp.clone()))?;
    let upstream_exists = git_custom(
        &["rev-parse", "--abbrev-ref", "--symbolic-full-name", "@{upstream}"],
        &path,
        &gp,
    );

    match upstream_exists {
        Ok(_) => {
            git_custom(&["pull"], &path, &gp)?;
            Ok(format!("已拉取 {} 的最新代码", branch))
        }
        Err(_) => {
            git_custom(&["pull", "origin", &branch], &path, &gp)?;
            Ok(format!("已从 origin/{} 拉取代码", branch))
        }
    }
}

#[tauri::command]
fn git_add_commit(path: String, message: String, git_path: Option<String>) -> Result<String, String> {
    let gp = git_path.unwrap_or_default();
    git_custom(&["add", "."], &path, &gp)?;
    git_custom(&["commit", "-m", &message], &path, &gp)?;
    Ok(format!("已提交: {}", message))
}

#[tauri::command]
fn git_push(path: String, git_path: Option<String>) -> Result<String, String> {
    let gp = git_path.unwrap_or_default();
    let branch = get_current_branch(path.clone(), Some(gp.clone()))?;

    let has_upstream = git_custom(
        &["rev-parse", "--abbrev-ref", "--symbolic-full-name", "@{upstream}"],
        &path,
        &gp,
    );

    match has_upstream {
        Ok(_) => {
            git_custom(&["push"], &path, &gp)?;
            Ok(format!("已推送到 origin/{}", branch))
        }
        Err(_) => {
            git_custom(&["push", "--set-upstream", "origin", &branch], &path, &gp)?;
            Ok(format!("已推送到 origin/{}（设置上游跟踪）", branch))
        }
    }
}

#[tauri::command]
fn git_status(path: String, git_path: Option<String>) -> Result<GitStatus, String> {
    let gp = git_path.unwrap_or_default();
    let staged = git_custom(&["diff", "--cached", "--name-only"], &path, &gp)?;
    let unstaged = git_custom(&["diff", "--name-only"], &path, &gp)?;
    let untracked = git_custom(&["ls-files", "--others", "--exclude-standard"], &path, &gp)?;

    let staged_count = if staged.is_empty() { 0 } else { staged.lines().count() };
    let unstaged_count = if unstaged.is_empty() { 0 } else { unstaged.lines().count() };
    let untracked_count = if untracked.is_empty() { 0 } else { untracked.lines().count() };

    Ok(GitStatus {
        clean: staged_count == 0 && unstaged_count == 0 && untracked_count == 0,
        staged: staged_count,
        unstaged: unstaged_count,
        untracked: untracked_count,
    })
}

#[tauri::command]
fn git_stash(path: String, git_path: Option<String>) -> Result<String, String> {
    let gp = git_path.unwrap_or_default();
    git_custom(&["stash", "push", "-m", "git-helper-auto-stash"], &path, &gp)?;
    Ok("已暂存本地修改".to_string())
}

#[tauri::command]
fn git_stash_pop(path: String, git_path: Option<String>) -> Result<String, String> {
    let gp = git_path.unwrap_or_default();
    let list = git_custom(&["stash", "list"], &path, &gp)?;
    if list.contains("git-helper-auto-stash") {
        match git_custom(&["stash", "pop"], &path, &gp) {
            Ok(_) => Ok("已恢复暂存的修改".to_string()),
            Err(e) => {
                if e.contains("CONFLICT") {
                    Ok("已恢复暂存的修改（存在冲突，请手动解决）".to_string())
                } else {
                    Err(e)
                }
            }
        }
    } else {
        Ok("无自动暂存需要恢复".to_string())
    }
}

// ─── App entry ────────────────────────────────────────────────────────────────

pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            check_git,
            check_repo_access,
            get_current_branch,
            list_branches,
            create_branch,
            switch_branch,
            git_pull,
            git_add_commit,
            git_push,
            git_status,
            git_stash,
            git_stash_pop,
        ])
        .run(tauri::generate_context!())
        .expect("启动 Git 小助手失败");
}
