use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::time::SystemTime;
use thiserror::Error;

pub const MAX_DOCUMENT_SIZE: usize = 10 * 1024 * 1024; // 10 MiB
pub const BINARY_DETECTION_CHUNK_SIZE: usize = 8 * 1024; // 8 KiB

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct DocumentLocation {
    pub canonical_path: PathBuf,
    pub parent_dir: PathBuf,
    pub display_name: String,
    pub extension: String,
    pub last_modified: SystemTime,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct MarkdownDocument {
    pub location: DocumentLocation,
    pub raw_content: String,
    pub byte_size: usize,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TocItem {
    pub id: String,
    pub title: String,
    pub level: u8,
    pub line_number: usize,
    pub children: Vec<TocItem>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RenderedContent {
    pub sanitized_html: String,
    pub outline: Vec<TocItem>,
}

#[derive(Debug, Error, PartialEq, Eq, Clone, Serialize, Deserialize)]
pub enum DocumentError {
    #[error("File not found: {0}")]
    FileNotFound(String),

    #[error("Read access denied: {0}")]
    PermissionDenied(String),

    #[error("The selected file is binary and cannot be viewed as Markdown.")]
    BinaryFileDetected(String),

    #[error("File size ({size} bytes) exceeds limit of {limit} bytes.")]
    FileTooLarge { size: usize, limit: usize },

    #[error("Directory traversal prohibited: {0}")]
    DirectoryTraversalProhibited(String),

    #[error("I/O error: {0}")]
    Io(String),
}

impl DocumentError {
    pub fn error_code(&self) -> &'static str {
        match self {
            DocumentError::FileNotFound(_) => "FILE_NOT_FOUND",
            DocumentError::PermissionDenied(_) => "PERMISSION_DENIED",
            DocumentError::BinaryFileDetected(_) => "BINARY_FILE_DETECTED",
            DocumentError::FileTooLarge { .. } => "FILE_TOO_LARGE",
            DocumentError::DirectoryTraversalProhibited(_) => "DIRECTORY_TRAVERSAL_PROHIBITED",
            DocumentError::Io(_) => "IO_ERROR",
        }
    }
}
