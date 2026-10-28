use crate::cli::cli_argument_parser::CliAction;
use crate::document::asset_path_resolver::AssetPathResolver;
use crate::document::document_models::DocumentError;
use crate::document::document_service::DocumentService;
use crate::document::fs_document_reader::FsDocumentReader;
use crate::document::html_sanitizer::HtmlSanitizer;
use crate::document::markdown_compiler::MarkdownCompiler;
use crate::preferences::preferences_service::PreferencesService;
use crate::preferences::xdg_config_store_adapter::XdgConfigStoreAdapter;
use crate::viewer::embedded_server::{EmbeddedServer, ServerState};
use crate::viewer::native_window_launcher::NativeWindowLauncher;
use std::env;
use std::fs;
use std::path::{Path, PathBuf};
use std::process;
use std::sync::{Arc, RwLock};

pub struct ViewerLauncher;

impl ViewerLauncher {
    pub fn run(action: CliAction) {
        let (target_path, cli_theme) = match action {
            CliAction::OpenFile { path, theme } => (Some(path), theme),
            CliAction::EmptyState => (None, None),
            _ => (None, None),
        };

        let doc_service = DocumentService::new(
            FsDocumentReader::new(),
            MarkdownCompiler::new(),
            HtmlSanitizer::new(),
            AssetPathResolver::new(),
        );

        let initial_payload = Self::load_initial_document(&doc_service, target_path.as_deref());
        let pref_service = PreferencesService::new(XdgConfigStoreAdapter::new().default_config_path());

        let last_mtime = target_path
            .as_ref()
            .and_then(|p| fs::metadata(p).ok())
            .and_then(|m| m.modified().ok());
        let last_exists = target_path.as_ref().map(|p| p.exists()).unwrap_or(false);
        let dist_dir = Self::locate_dist_dir();

        let state = Arc::new(RwLock::new(ServerState {
            current_path: target_path,
            cli_theme,
            initial_payload,
            document_service: doc_service,
            preferences_service: pref_service,
            last_mtime,
            last_exists,
            dist_dir,
        }));

        let server = match EmbeddedServer::start(state) {
            Ok(s) => s,
            Err(e) => {
                eprintln!("Failed to start viewer server: {}", e);
                process::exit(1);
            }
        };

        let url = server.url();
        println!("Parch viewer server listening on {}", url);
        let _ = NativeWindowLauncher::launch(&url);
        process::exit(0);
    }

    fn load_initial_document(
        service: &DocumentService,
        path: Option<&Path>,
    ) -> Option<crate::document::document_service::OpenDocumentPayload> {
        let doc_path = match path {
            Some(p) => p,
            None => return None,
        };

        match service.open_document(doc_path) {
            Ok(payload) => Some(payload),
            Err(DocumentError::FileNotFound(msg)) => {
                eprintln!("Error: Target file not found: {}", msg);
                process::exit(2);
            }
            Err(DocumentError::BinaryFileDetected(msg)) => {
                eprintln!("Error: Binary or unsupported file: {}", msg);
                process::exit(3);
            }
            Err(err) => {
                eprintln!("Error: {}", err);
                process::exit(1);
            }
        }
    }

    fn locate_dist_dir() -> PathBuf {
        if let Ok(dir) = env::var("PARCH_DIST_DIR").or_else(|_| env::var("PARCHMENT_DIST_DIR")) {
            let p = PathBuf::from(dir);
            if p.exists() {
                return p;
            }
        }

        if let Ok(exe) = env::current_exe() {
            if let Some(parent) = exe.parent() {
                let candidates = [
                    parent.join("../dist"),
                    parent.join("../../dist"),
                    parent.join("../../../dist"),
                ];
                for candidate in &candidates {
                    if candidate.exists() {
                        return candidate.clone();
                    }
                }
            }
        }

        let manifest_dist = Path::new(env!("CARGO_MANIFEST_DIR")).join("../dist");
        if manifest_dist.exists() {
            return manifest_dist;
        }

        PathBuf::from("dist")
    }
}
