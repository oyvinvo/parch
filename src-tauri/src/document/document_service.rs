use crate::document::asset_path_resolver::AssetPathResolver;
use crate::document::document_models::{DocumentError, TocItem};
use crate::document::fs_document_reader::FsDocumentReader;
use crate::document::html_sanitizer::HtmlSanitizer;
use crate::document::markdown_compiler::MarkdownCompiler;
use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct OpenDocumentPayload {
    pub canonical_path: PathBuf,
    pub display_name: String,
    pub raw_markdown: String,
    pub sanitized_html: String,
    pub outline: Vec<TocItem>,
    pub byte_size: usize,
}

#[derive(Debug, Clone)]
pub struct DocumentService {
    reader: FsDocumentReader,
    compiler: MarkdownCompiler,
    sanitizer: HtmlSanitizer,
    asset_resolver: AssetPathResolver,
}

impl DocumentService {
    pub fn new(
        reader: FsDocumentReader,
        compiler: MarkdownCompiler,
        sanitizer: HtmlSanitizer,
        asset_resolver: AssetPathResolver,
    ) -> Self {
        Self {
            reader,
            compiler,
            sanitizer,
            asset_resolver,
        }
    }

    pub fn open_document(&self, path: &Path) -> Result<OpenDocumentPayload, DocumentError> {
        let doc = self.reader.read_document(path)?;
        let rendered = self.compiler.compile(&doc.raw_content);
        let sanitized = self.sanitizer.sanitize(&rendered.sanitized_html);

        Ok(OpenDocumentPayload {
            canonical_path: doc.location.canonical_path,
            display_name: doc.location.display_name,
            raw_markdown: doc.raw_content,
            sanitized_html: sanitized,
            outline: rendered.outline,
            byte_size: doc.byte_size,
        })
    }

    pub fn resolve_asset(&self, doc_path: &Path, rel_asset: &str) -> Result<String, DocumentError> {
        self.asset_resolver.resolve_asset_path(doc_path, rel_asset)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Write;
    use tempfile::NamedTempFile;

    #[test]
    fn test_open_document_end_to_end_pipeline() {
        let mut file = NamedTempFile::new().unwrap();
        writeln!(file, "# Welcome\n\nParagraph text.").unwrap();

        let service = DocumentService::new(
            FsDocumentReader::new(),
            MarkdownCompiler::new(),
            HtmlSanitizer::new(),
            AssetPathResolver::new(),
        );

        let payload = service.open_document(file.path()).expect("Should open and parse document");
        assert_eq!(payload.display_name, file.path().file_name().unwrap().to_str().unwrap());
        assert!(payload.raw_markdown.contains("# Welcome"));
        assert!(payload.sanitized_html.contains("<h1"));
        assert_eq!(payload.outline.len(), 1);
        assert_eq!(payload.outline[0].title, "Welcome");
    }

    #[test]
    fn test_open_document_missing_file_returns_error() {
        let service = DocumentService::new(
            FsDocumentReader::new(),
            MarkdownCompiler::new(),
            HtmlSanitizer::new(),
            AssetPathResolver::new(),
        );

        let result = service.open_document(Path::new("/tmp/missing_123.md"));
        assert!(result.is_err());
    }
}
