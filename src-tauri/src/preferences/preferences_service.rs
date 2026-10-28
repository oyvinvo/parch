use crate::preferences::preferences_models::{ThemeMode, UserPreferences};
use std::fs;
use std::path::{Path, PathBuf};
use thiserror::Error;

#[derive(Debug, Error, PartialEq, Eq)]
pub enum PreferencesError {
    #[error("I/O error accessing preferences: {0}")]
    Io(String),

    #[error("Serialization or parsing error: {0}")]
    Serialization(String),

    #[error("Invalid preference key or value: {key} = {value}")]
    InvalidPreference { key: String, value: String },
}

#[derive(Debug, Clone)]
pub struct PreferencesService {
    config_path: PathBuf,
}

impl PreferencesService {
    pub fn new(config_path: PathBuf) -> Self {
        Self { config_path }
    }

    pub fn get_preferences(&self) -> Result<UserPreferences, PreferencesError> {
        if !self.config_path.exists() {
            return Ok(UserPreferences::default());
        }
        self.load_from_path(&self.config_path)
    }

    pub fn set_preference(&self, key: &str, value: &str) -> Result<UserPreferences, PreferencesError> {
        let mut prefs = self.get_preferences()?;
        self.apply_preference_update(&mut prefs, key, value)?;
        self.save_to_path(&self.config_path, &prefs)?;
        Ok(prefs)
    }

    pub fn load_from_path(&self, path: &Path) -> Result<UserPreferences, PreferencesError> {
        let content = fs::read_to_string(path).map_err(|e| PreferencesError::Io(e.to_string()))?;
        serde_json::from_str(&content).map_err(|e| PreferencesError::Serialization(e.to_string()))
    }

    pub fn save_to_path(&self, path: &Path, prefs: &UserPreferences) -> Result<(), PreferencesError> {
        if let Some(parent) = path.parent() {
            fs::create_dir_all(parent).map_err(|e| PreferencesError::Io(e.to_string()))?;
        }
        let json = serde_json::to_string_pretty(prefs)
            .map_err(|e| PreferencesError::Serialization(e.to_string()))?;
        fs::write(path, json).map_err(|e| PreferencesError::Io(e.to_string()))
    }

    fn apply_preference_update(
        &self,
        prefs: &mut UserPreferences,
        key: &str,
        value: &str,
    ) -> Result<(), PreferencesError> {
        match key {
            "theme_mode" => {
                prefs.theme_mode = self.parse_theme_mode(value).ok_or_else(|| {
                    PreferencesError::InvalidPreference {
                        key: key.to_string(),
                        value: value.to_string(),
                    }
                })?;
            }
            "toc_visible" => {
                prefs.toc_visible = value.parse::<bool>().map_err(|_| {
                    PreferencesError::InvalidPreference {
                        key: key.to_string(),
                        value: value.to_string(),
                    }
                })?;
            }
            "font_size_px" => {
                prefs.font_size_px = value.parse::<u32>().map_err(|_| {
                    PreferencesError::InvalidPreference {
                        key: key.to_string(),
                        value: value.to_string(),
                    }
                })?;
            }
            "line_width_ch" => {
                prefs.line_width_ch = value.parse::<u32>().map_err(|_| {
                    PreferencesError::InvalidPreference {
                        key: key.to_string(),
                        value: value.to_string(),
                    }
                })?;
            }
            "auto_reload" => {
                prefs.auto_reload = value.parse::<bool>().map_err(|_| {
                    PreferencesError::InvalidPreference {
                        key: key.to_string(),
                        value: value.to_string(),
                    }
                })?;
            }
            _ => {
                return Err(PreferencesError::InvalidPreference {
                    key: key.to_string(),
                    value: value.to_string(),
                });
            }
        }
        Ok(())
    }

    fn parse_theme_mode(&self, value: &str) -> Option<ThemeMode> {
        match value.to_lowercase().as_str() {
            "system" => Some(ThemeMode::System),
            "light" => Some(ThemeMode::Light),
            "dark" => Some(ThemeMode::Dark),
            "sepia" => Some(ThemeMode::Sepia),
            _ => None,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;

    #[test]
    fn test_load_default_preferences_when_file_does_not_exist() {
        let dir = tempdir().unwrap();
        let config_file = dir.path().join("config.json");
        let service = PreferencesService::new(config_file);

        let prefs = service.get_preferences().expect("Should return default preferences");
        assert_eq!(prefs.theme_mode, ThemeMode::System);
        assert_eq!(prefs.version, 1);
        assert!(prefs.toc_visible);
    }

    #[test]
    fn test_set_theme_mode_persists_to_file() {
        let dir = tempdir().unwrap();
        let config_file = dir.path().join("config.json");
        let service = PreferencesService::new(config_file.clone());

        let updated = service
            .set_preference("theme_mode", "sepia")
            .expect("Should update theme mode");
        assert_eq!(updated.theme_mode, ThemeMode::Sepia);

        let reloaded = service.get_preferences().expect("Should reload from disk");
        assert_eq!(reloaded.theme_mode, ThemeMode::Sepia);
    }

    #[test]
    fn test_set_invalid_preference_key_returns_error() {
        let dir = tempdir().unwrap();
        let config_file = dir.path().join("config.json");
        let service = PreferencesService::new(config_file);

        let result = service.set_preference("invalid_key", "value");
        assert!(matches!(result, Err(PreferencesError::InvalidPreference { .. })));
    }
}
