use crate::watcher::watcher_models::WatcherEvent;
use notify::{Config, EventKind, RecommendedWatcher, RecursiveMode, Watcher};
use std::path::{Path, PathBuf};
use std::sync::mpsc::{channel, Receiver};

pub struct NotifyWatcherAdapter {
    _watcher: RecommendedWatcher,
}

impl NotifyWatcherAdapter {
    pub fn watch_path(
        target_file: &Path,
    ) -> Result<(Self, Receiver<WatcherEvent>), notify::Error> {
        let parent_dir = target_file
            .parent()
            .unwrap_or(target_file);

        let (tx, rx) = channel::<WatcherEvent>();
        let target = PathBuf::from(target_file);

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
        )?;

        watcher.watch(parent_dir, RecursiveMode::NonRecursive)?;

        Ok((Self { _watcher: watcher }, rx))
    }
}
