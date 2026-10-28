use crate::document::document_models::DocumentError;
use std::path::Path;

#[derive(Debug, Default, Clone)]
pub struct AssetPathResolver;

impl AssetPathResolver {
    pub fn new() -> Self {
        Self
    }

    pub fn resolve_asset_path(
        &self,
        document_path: &Path,
        relative_asset: &str,
    ) -> Result<String, DocumentError> {
        let parent_dir = self.resolve_parent_dir(document_path)?;

        if self.contains_traversal(relative_asset) {
            return Err(DocumentError::DirectoryTraversalProhibited(
                relative_asset.to_string(),
            ));
        }

        let clean_path = relative_asset.trim_start_matches("./");
        let candidate = parent_dir.join(clean_path);

        let canonical_parent = parent_dir
            .canonicalize()
            .unwrap_or_else(|_| parent_dir.to_path_buf());

        let target = if candidate.exists() {
            candidate
                .canonicalize()
                .unwrap_or_else(|_| candidate.clone())
        } else {
            canonical_parent.join(clean_path)
        };

        if !target.starts_with(&canonical_parent) {
            return Err(DocumentError::DirectoryTraversalProhibited(
                relative_asset.to_string(),
            ));
        }

        Ok(format!("asset://{}", target.to_string_lossy()))
    }

    fn resolve_parent_dir<'a>(&self, doc_path: &'a Path) -> Result<&'a Path, DocumentError> {
        doc_path
            .parent()
            .ok_or_else(|| DocumentError::FileNotFound(doc_path.to_string_lossy().to_string()))
    }

    fn contains_traversal(&self, path: &str) -> bool {
        path.starts_with("../") || path.contains("/../") || path == ".."
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs::File;
    use tempfile::tempdir;

    #[test]
    fn test_resolve_valid_relative_asset() {
        let dir = tempdir().unwrap();
        let doc_path = dir.path().join("readme.md");
        File::create(&doc_path).unwrap();

        let img_dir = dir.path().join("images");
        std::fs::create_dir(&img_dir).unwrap();
        let img_path = img_dir.join("arch.png");
        File::create(&img_path).unwrap();

        let resolver = AssetPathResolver::new();
        let resolved = resolver
            .resolve_asset_path(&doc_path, "./images/arch.png")
            .expect("Should resolve valid relative asset");

        assert!(resolved.starts_with("asset://"));
        assert!(resolved.ends_with("arch.png"));
    }

    #[test]
    fn test_directory_traversal_prohibited() {
        let dir = tempdir().unwrap();
        let doc_path = dir.path().join("doc.md");
        File::create(&doc_path).unwrap();

        let resolver = AssetPathResolver::new();
        let result = resolver.resolve_asset_path(&doc_path, "../../../../etc/shadow");

        match result {
            Err(DocumentError::DirectoryTraversalProhibited(_)) => {}
            other => panic!("Expected DirectoryTraversalProhibited, got {:?}", other),
        }
    }
}
