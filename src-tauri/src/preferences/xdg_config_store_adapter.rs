use std::env;
use std::path::PathBuf;

#[derive(Debug, Default, Clone)]
pub struct XdgConfigStoreAdapter;

impl XdgConfigStoreAdapter {
    pub fn new() -> Self {
        Self
    }

    pub fn default_config_path(&self) -> PathBuf {
        let base_dir = if let Ok(xdg_home) = env::var("XDG_CONFIG_HOME") {
            if !xdg_home.is_empty() {
                PathBuf::from(xdg_home)
            } else {
                self.fallback_home_config()
            }
        } else {
            self.fallback_home_config()
        };

        base_dir.join("parch").join("config.json")
    }

    fn fallback_home_config(&self) -> PathBuf {
        if let Ok(home) = env::var("HOME") {
            PathBuf::from(home).join(".config")
        } else {
            PathBuf::from(".")
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_default_config_path_contains_parch() {
        let adapter = XdgConfigStoreAdapter::new();
        let path = adapter.default_config_path();
        assert!(path.to_string_lossy().contains("parch/config.json"));
    }
}
