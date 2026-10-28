use crate::watcher::watcher_models::{WatcherConfig, WatcherEvent};
use notify::{Config, EventKind, RecommendedWatcher, RecursiveMode, Watcher};
use std::path::{Path, PathBuf};
use std::sync::mpsc::{channel, Receiver};
use thiserror::Error;

#[derive(Debug, Error)]
pub enum WatcherError {
    #[error("Failed to watch path: {0}")]
    WatchFailed(String),

    #[error("Watcher channel error: {0}")]
    ChannelError(String),
}

pub struct FileWatcherService {
    target_file: PathBuf,
    config: WatcherConfig,
    _watcher: Option<RecommendedWatcher>,
}

impl FileWatcherService {
    pub fn new(target_file: PathBuf, config: WatcherConfig) -> Self {
        Self {
            target_file,
            config,
            _watcher: None,
        }
    }

    pub fn config(&self) -> &WatcherConfig {
        &self.config
    }

    pub fn target_file(&self) -> &Path {
        &self.target_file
    }

    pub fn set_target_file(&mut self, new_target: PathBuf) {
        self.target_file = new_target;
    }

    pub fn start_watching(&mut self) -> Result<Receiver<WatcherEvent>, WatcherError> {
        let parent_dir = self.target_file.parent().ok_or_else(|| {
            WatcherError::WatchFailed("Target file has no parent directory".into())
        })?;

        let (tx, rx) = channel::<WatcherEvent>();
        let target = self.target_file.clone();

        let mut watcher = RecommendedWatcher::new(
            move |res: Result<notify::Event, notify::Error>| {
                if let Ok(event) = res {
                    for path in &event.paths {
                        if path.file_name() == target.file_name() {
                            let is_deleted = !path.exists()
                                || matches!(event.kind, EventKind::Remove(_));
                            let watcher_event = if is_deleted {
                                WatcherEvent::Deleted(target.clone())
                            } else {
                                WatcherEvent::Modified(target.clone())
                            };
                            let _ = tx.send(watcher_event);
                            break;
                        }
                    }
                }
            },
            Config::default(),
        )
        .map_err(|e| WatcherError::WatchFailed(e.to_string()))?;

        watcher
            .watch(parent_dir, RecursiveMode::NonRecursive)
            .map_err(|e| WatcherError::WatchFailed(e.to_string()))?;

        self._watcher = Some(watcher);
        Ok(rx)
    }

    pub fn is_relevant_event(&self, event_path: &Path) -> bool {
        event_path.file_name() == self.target_file.file_name()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs::File;
    use std::io::Write;
    use tempfile::tempdir;

    #[test]
    fn test_watcher_config_and_target_accessors() {
        let config = WatcherConfig::default();
        let mut watcher = FileWatcherService::new(
            PathBuf::from("/home/user/docs/target.md"),
            config.clone(),
        );

        assert_eq!(watcher.config().debounce_duration, config.debounce_duration);
        assert_eq!(watcher.target_file(), Path::new("/home/user/docs/target.md"));

        watcher.set_target_file(PathBuf::from("/home/user/docs/updated.md"));
        assert_eq!(watcher.target_file(), Path::new("/home/user/docs/updated.md"));
    }

    #[test]
    fn test_is_relevant_event_filters_unrelated_files() {
        let watcher = FileWatcherService::new(
            PathBuf::from("/home/user/docs/target.md"),
            WatcherConfig::default(),
        );

        assert!(watcher.is_relevant_event(Path::new("/home/user/docs/target.md")));
        assert!(!watcher.is_relevant_event(Path::new("/home/user/docs/other.md")));
        assert!(!watcher.is_relevant_event(Path::new("/home/user/docs/.target.md.swp")));
    }

    #[test]
    fn test_file_modification_triggers_modified_event() {
        let dir = tempdir().unwrap();
        let file_path = dir.path().join("live.md");
        {
            let mut f = File::create(&file_path).unwrap();
            writeln!(f, "Initial content").unwrap();
        }

        let mut watcher = FileWatcherService::new(file_path.clone(), WatcherConfig::default());
        let rx = watcher.start_watching().expect("Should start watcher");

        {
            let mut f = std::fs::OpenOptions::new()
                .append(true)
                .open(&file_path)
                .unwrap();
            writeln!(f, "New line added").unwrap();
        }

        let event = rx
            .recv_timeout(std::time::Duration::from_millis(1000))
            .expect("Should receive watcher event");

        assert_eq!(event, WatcherEvent::Modified(file_path));
    }

    #[test]
    fn test_file_deletion_triggers_deleted_event() {
        let dir = tempdir().unwrap();
        let file_path = dir.path().join("to_delete.md");
        File::create(&file_path).unwrap();

        let mut watcher = FileWatcherService::new(file_path.clone(), WatcherConfig::default());
        let rx = watcher.start_watching().expect("Should start watcher");

        std::fs::remove_file(&file_path).unwrap();

        let event = rx
            .recv_timeout(std::time::Duration::from_millis(1000))
            .expect("Should receive deletion event");

        assert_eq!(event, WatcherEvent::Deleted(file_path));
    }
}
