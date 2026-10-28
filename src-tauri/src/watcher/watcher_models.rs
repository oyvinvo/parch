use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::time::Duration;

pub const DEFAULT_DEBOUNCE_MS: u64 = 150;

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub enum WatcherEvent {
    Modified(PathBuf),
    Deleted(PathBuf),
}

#[derive(Debug, Clone)]
pub struct WatcherConfig {
    pub debounce_duration: Duration,
}

impl Default for WatcherConfig {
    fn default() -> Self {
        Self {
            debounce_duration: Duration::from_millis(DEFAULT_DEBOUNCE_MS),
        }
    }
}
