use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum ThemeMode {
    System,
    Light,
    Dark,
    Sepia,
}

impl Default for ThemeMode {
    fn default() -> Self {
        Self::System
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct UserPreferences {
    pub version: u32,
    pub theme_mode: ThemeMode,
    pub toc_visible: bool,
    pub font_size_px: u32,
    pub line_width_ch: u32,
    pub auto_reload: bool,
}

impl Default for UserPreferences {
    fn default() -> Self {
        Self {
            version: 1,
            theme_mode: ThemeMode::System,
            toc_visible: true,
            font_size_px: 16,
            line_width_ch: 75,
            auto_reload: true,
        }
    }
}
