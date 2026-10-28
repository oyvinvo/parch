use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct CheckUpdateResponse {
    pub update_available: bool,
    pub current_version: String,
    pub latest_version: Option<String>,
}

pub struct SelfUpdateService;

impl SelfUpdateService {
    pub fn run_self_update(current_version: &str) -> Result<String, String> {
        let release_json = Self::fetch_release_json(None)?;
        let latest_version = Self::parse_latest_tag(&release_json)?;

        if !Self::is_newer_version(current_version, &latest_version) {
            return Ok(format!("✓ parch v{} is already up to date.", current_version));
        }

        let temp_dir = std::env::temp_dir().join("parch-update");
        Self::download_and_extract(&latest_version, &temp_dir)?;
        Self::execute_installation(&temp_dir)?;
        let _ = fs::remove_dir_all(&temp_dir);

        Ok(format!("✓ Updated parch from v{} to v{}!", current_version, latest_version))
    }

    pub fn check_for_update(current_version: &str) -> CheckUpdateResponse {
        let release_json = match Self::fetch_release_json(Some(3)) {
            Ok(json) => json,
            Err(_) => return Self::empty_update_response(current_version),
        };

        let latest_version = match Self::parse_latest_tag(&release_json) {
            Ok(tag) => tag,
            Err(_) => return Self::empty_update_response(current_version),
        };

        let update_available = Self::is_newer_version(current_version, &latest_version);
        CheckUpdateResponse {
            update_available,
            current_version: current_version.to_string(),
            latest_version: Some(latest_version),
        }
    }

    pub fn parse_latest_tag(release_json: &str) -> Result<String, String> {
        let parsed: serde_json::Value = serde_json::from_str(release_json)
            .map_err(|err| format!("Failed to parse release JSON: {}", err))?;

        let tag_name = parsed
            .get("tag_name")
            .and_then(|v| v.as_str())
            .ok_or_else(|| "Missing 'tag_name' in GitHub release response".to_string())?;

        let version = tag_name.strip_prefix('v').unwrap_or(tag_name);
        Ok(version.to_string())
    }

    pub fn is_newer_version(current: &str, latest: &str) -> bool {
        match (Self::parse_version_tuple(current), Self::parse_version_tuple(latest)) {
            (Some(curr), Some(lat)) => lat > curr,
            _ => false,
        }
    }

    pub fn detect_target_platform() -> &'static str {
        if cfg!(target_os = "macos") {
            if cfg!(target_arch = "aarch64") {
                "macos-arm64"
            } else {
                "macos-x86_64"
            }
        } else {
            "linux-x86_64"
        }
    }

    fn empty_update_response(current_version: &str) -> CheckUpdateResponse {
        CheckUpdateResponse {
            update_available: false,
            current_version: current_version.to_string(),
            latest_version: None,
        }
    }

    fn parse_version_tuple(v: &str) -> Option<(u64, u64, u64)> {
        let mut parts = v.trim_start_matches('v').split('.');
        let major = parts.next()?.parse().ok()?;
        let minor = parts.next()?.parse().ok()?;
        let patch = parts.next()?.parse().ok()?;
        Some((major, minor, patch))
    }

    fn fetch_release_json(timeout_secs: Option<u32>) -> Result<String, String> {
        let mut cmd = Command::new("curl");
        cmd.args([
            "-fsSL",
            "-H",
            "Accept: application/vnd.github+json",
            "-H",
            "User-Agent: parch-updater",
        ]);

        if let Some(secs) = timeout_secs {
            cmd.args(["--max-time", &secs.to_string()]);
        }

        cmd.arg("https://api.github.com/repos/oyvinvo/parch/releases/latest");

        let output = cmd.output().map_err(|e| format!("Failed to run curl: {}", e))?;
        if !output.status.success() {
            let err = String::from_utf8_lossy(&output.stderr);
            return Err(format!("curl error: {}", err.trim()));
        }

        String::from_utf8(output.stdout).map_err(|e| format!("Invalid UTF-8: {}", e))
    }

    fn download_and_extract(latest_version: &str, temp_dir: &Path) -> Result<(), String> {
        if temp_dir.exists() {
            let _ = fs::remove_dir_all(temp_dir);
        }
        fs::create_dir_all(temp_dir).map_err(|e| format!("Failed to create temp dir: {}", e))?;

        let target = Self::detect_target_platform();
        let url = format!(
            "https://github.com/oyvinvo/parch/releases/download/v{}/parch-v{}-{}.tar.gz",
            latest_version, latest_version, target
        );

        let tar_file = temp_dir.join("parch.tar.gz");
        let curl_status = Command::new("curl")
            .args(["-fsSL", "-o", tar_file.to_str().unwrap_or("parch.tar.gz"), &url])
            .status()
            .map_err(|e| format!("curl download failed: {}", e))?;

        if !curl_status.success() {
            return Err(format!("Download failed for URL: {}", url));
        }

        let tar_status = Command::new("tar")
            .args(["-xzf", tar_file.to_str().unwrap_or("parch.tar.gz"), "-C", temp_dir.to_str().unwrap_or(".")])
            .status()
            .map_err(|e| format!("tar extraction failed: {}", e))?;

        if !tar_status.success() {
            return Err("Failed to extract update tarball".to_string());
        }

        Ok(())
    }

    fn execute_installation(temp_dir: &Path) -> Result<(), String> {
        let script_path = Self::find_install_script(temp_dir)?;
        let script_dir = script_path.parent().unwrap_or(temp_dir);
        let repo_root = script_dir.parent().unwrap_or(script_dir);

        let status = Command::new("bash")
            .arg(&script_path)
            .current_dir(repo_root)
            .status()
            .map_err(|e| format!("Failed to execute install script: {}", e))?;

        if !status.success() {
            return Err(format!("Install script failed with code: {:?}", status.code()));
        }

        Ok(())
    }

    fn find_install_script(base: &Path) -> Result<PathBuf, String> {
        let direct = base.join("scripts/install-desktop.sh");
        if direct.exists() {
            return Ok(direct);
        }

        let flat = base.join("install-desktop.sh");
        if flat.exists() {
            return Ok(flat);
        }

        if let Ok(entries) = fs::read_dir(base) {
            for entry in entries.flatten() {
                let path = entry.path();
                if path.is_dir() {
                    let sub_direct = path.join("scripts/install-desktop.sh");
                    if sub_direct.exists() {
                        return Ok(sub_direct);
                    }
                    let sub_flat = path.join("install-desktop.sh");
                    if sub_flat.exists() {
                        return Ok(sub_flat);
                    }
                }
            }
        }

        Err(format!("Could not locate install-desktop.sh in {}", base.display()))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_latest_tag_valid_json_with_v() {
        let json = r#"{"tag_name": "v0.2.0", "name": "Release 0.2.0"}"#;
        assert_eq!(SelfUpdateService::parse_latest_tag(json), Ok("0.2.0".to_string()));
    }

    #[test]
    fn test_parse_latest_tag_valid_json_without_v() {
        let json = r#"{"tag_name": "1.0.4", "name": "Release 1.0.4"}"#;
        assert_eq!(SelfUpdateService::parse_latest_tag(json), Ok("1.0.4".to_string()));
    }

    #[test]
    fn test_parse_latest_tag_invalid_json() {
        let json = "not a json string";
        assert!(SelfUpdateService::parse_latest_tag(json).is_err());
    }

    #[test]
    fn test_parse_latest_tag_missing_tag_name() {
        let json = r#"{"name": "Release without tag"}"#;
        assert!(SelfUpdateService::parse_latest_tag(json).is_err());
    }

    #[test]
    fn test_is_newer_version() {
        assert!(!SelfUpdateService::is_newer_version("0.1.0", "0.1.0"));
        assert!(SelfUpdateService::is_newer_version("0.1.0", "0.2.0"));
        assert!(SelfUpdateService::is_newer_version("0.1.0", "1.0.0"));
        assert!(!SelfUpdateService::is_newer_version("0.2.0", "0.1.0"));
        assert!(SelfUpdateService::is_newer_version("0.1.0", "0.1.1"));
        assert!(SelfUpdateService::is_newer_version("v0.1.0", "v0.2.0"));
        assert!(!SelfUpdateService::is_newer_version("invalid", "0.2.0"));
    }

    #[test]
    fn test_detect_target_platform() {
        let platform = SelfUpdateService::detect_target_platform();
        assert!(
            platform == "linux-x86_64"
                || platform == "macos-arm64"
                || platform == "macos-x86_64"
        );
    }
}
