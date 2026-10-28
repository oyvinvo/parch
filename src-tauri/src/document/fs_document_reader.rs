use crate::document::document_models::{
    DocumentError, DocumentLocation, MarkdownDocument, BINARY_DETECTION_CHUNK_SIZE,
    MAX_DOCUMENT_SIZE,
};
use std::fs;
use std::path::Path;
use std::time::SystemTime;

#[derive(Debug, Default, Clone)]
pub struct FsDocumentReader;

impl FsDocumentReader {
    pub fn new() -> Self {
        Self
    }

    pub fn read_document(&self, path: &Path) -> Result<MarkdownDocument, DocumentError> {
        let canonical_path = self.resolve_canonical_path(path)?;
        let metadata = fs::metadata(&canonical_path)
            .map_err(|e| DocumentError::Io(e.to_string()))?;

        let byte_size = metadata.len() as usize;
        if byte_size > MAX_DOCUMENT_SIZE {
            return Err(DocumentError::FileTooLarge {
                size: byte_size,
                limit: MAX_DOCUMENT_SIZE,
            });
        }

        let bytes = fs::read(&canonical_path)
            .map_err(|e| DocumentError::Io(e.to_string()))?;

        self.verify_non_binary(&bytes, &canonical_path)?;

        let raw_content = String::from_utf8(bytes)
            .map_err(|_| DocumentError::BinaryFileDetected(canonical_path.to_string_lossy().to_string()))?;

        let location = self.build_location(&canonical_path, metadata.modified().unwrap_or(SystemTime::now()));

        Ok(MarkdownDocument {
            location,
            raw_content,
            byte_size,
        })
    }

    fn resolve_canonical_path(&self, path: &Path) -> Result<std::path::PathBuf, DocumentError> {
        if !path.exists() {
            return Err(DocumentError::FileNotFound(path.to_string_lossy().to_string()));
        }

        path.canonicalize()
            .map_err(|_| DocumentError::FileNotFound(path.to_string_lossy().to_string()))
    }

    fn verify_non_binary(&self, bytes: &[u8], path: &Path) -> Result<(), DocumentError> {
        let inspect_len = bytes.len().min(BINARY_DETECTION_CHUNK_SIZE);
        let chunk = &bytes[..inspect_len];

        if chunk.contains(&0x00) {
            return Err(DocumentError::BinaryFileDetected(
                path.to_string_lossy().to_string(),
            ));
        }

        Ok(())
    }

    fn build_location(&self, canonical_path: &Path, last_modified: SystemTime) -> DocumentLocation {
        let parent_dir = canonical_path
            .parent()
            .unwrap_or(canonical_path)
            .to_path_buf();

        let display_name = canonical_path
            .file_name()
            .and_then(|n| n.to_str())
            .unwrap_or("document")
            .to_string();

        let extension = canonical_path
            .extension()
            .and_then(|e| e.to_str())
            .unwrap_or("")
            .to_string();

        DocumentLocation {
            canonical_path: canonical_path.to_path_buf(),
            parent_dir,
            display_name,
            extension,
            last_modified,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Write;
    use tempfile::NamedTempFile;

    #[test]
    fn test_read_valid_utf8_markdown_file() {
        let mut file = NamedTempFile::new().unwrap();
        writeln!(file, "# Hello Parchment\nThis is a test.").unwrap();

        let reader = FsDocumentReader::new();
        let doc = reader.read_document(file.path()).expect("Should read valid document");

        assert_eq!(doc.raw_content, "# Hello Parchment\nThis is a test.\n");
        assert!(doc.byte_size > 0);
        assert_eq!(doc.location.display_name, file.path().file_name().unwrap().to_str().unwrap());
    }

    #[test]
    fn test_read_non_existent_file_returns_file_not_found() {
        let reader = FsDocumentReader::new();
        let non_existent_path = Path::new("/tmp/parchment_non_existent_file_xyz_123.md");
        let result = reader.read_document(non_existent_path);

        match result {
            Err(DocumentError::FileNotFound(path)) => {
                assert!(path.contains("parchment_non_existent_file_xyz_123.md"));
            }
            other => panic!("Expected FileNotFound, got {:?}", other),
        }
    }

    #[test]
    fn test_read_binary_file_returns_binary_file_detected() {
        let mut file = NamedTempFile::new().unwrap();
        let mut binary_data = vec![b'A'; 100];
        binary_data[42] = 0x00; // null byte
        file.write_all(&binary_data).unwrap();

        let reader = FsDocumentReader::new();
        let result = reader.read_document(file.path());

        match result {
            Err(DocumentError::BinaryFileDetected(_)) => {}
            other => panic!("Expected BinaryFileDetected, got {:?}", other),
        }
    }

    #[test]
    fn test_read_file_exceeding_max_size_returns_file_too_large() {
        let mut file = NamedTempFile::new().unwrap();
        let chunk = vec![b'a'; 1024 * 1024]; // 1 MiB chunk
        for _ in 0..11 {
            file.write_all(&chunk).unwrap();
        }

        let reader = FsDocumentReader::new();
        let result = reader.read_document(file.path());

        match result {
            Err(DocumentError::FileTooLarge { size, limit }) => {
                assert_eq!(limit, MAX_DOCUMENT_SIZE);
                assert!(size > MAX_DOCUMENT_SIZE);
            }
            other => panic!("Expected FileTooLarge, got {:?}", other),
        }
    }

    #[test]
    fn test_canonical_path_resolution() {
        let mut file = NamedTempFile::new().unwrap();
        writeln!(file, "Sample text").unwrap();

        let reader = FsDocumentReader::new();
        let doc = reader.read_document(file.path()).unwrap();
        assert!(doc.location.canonical_path.is_absolute());
        assert!(!doc.location.canonical_path.to_string_lossy().contains(".."));
    }
}
