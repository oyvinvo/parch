use ammonia::{Builder, UrlRelative};

#[derive(Debug, Default, Clone)]
pub struct HtmlSanitizer;

impl HtmlSanitizer {
    pub fn new() -> Self {
        Self
    }

    pub fn sanitize(&self, html: &str) -> String {
        let mut builder = Builder::default();

        builder.url_relative(UrlRelative::PassThrough);
        builder.add_url_schemes(&["file"]);

        builder.add_tags(&["aside", "mark", "input"]);

        builder.add_tag_attributes("aside", &["class", "data-alert-type", "role", "aria-label"]);
        builder.add_tag_attributes("h1", &["id", "class"]);
        builder.add_tag_attributes("h2", &["id", "class"]);
        builder.add_tag_attributes("h3", &["id", "class"]);
        builder.add_tag_attributes("h4", &["id", "class"]);
        builder.add_tag_attributes("h5", &["id", "class"]);
        builder.add_tag_attributes("h6", &["id", "class"]);
        builder.add_tag_attributes("input", &["type", "disabled", "checked"]);
        builder.add_tag_attributes("code", &["class"]);
        builder.add_tag_attributes("mark", &["class"]);

        builder.clean(html).to_string()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_relative_and_file_links_preserved() {
        let sanitizer = HtmlSanitizer::new();
        let html = r##"<a href="./other.md#section">Other</a><a href="#heading-1">Jump</a><a href="file:///tmp/test.md">Local</a>"##;
        let clean = sanitizer.sanitize(html);

        assert!(clean.contains(r#"href="./other.md#section""#));
        assert!(clean.contains(r##"href="#heading-1""##));
        assert!(clean.contains(r#"href="file:///tmp/test.md""#));
    }

    #[test]
    fn test_script_tags_are_stripped() {
        let sanitizer = HtmlSanitizer::new();
        let dirty = "<p>Hello <script>alert(window.origin)</script> world</p>";
        let clean = sanitizer.sanitize(dirty);

        assert!(!clean.contains("<script>"));
        assert!(!clean.contains("alert(window.origin)"));
        assert!(clean.contains("Hello"));
        assert!(clean.contains("world"));
    }

    #[test]
    fn test_onerror_and_event_handlers_are_stripped() {
        let sanitizer = HtmlSanitizer::new();
        let dirty = r#"<img src="x" onerror="fetch('http://attacker.com')" />"#;
        let clean = sanitizer.sanitize(dirty);

        assert!(!clean.contains("onerror"));
        assert!(!clean.contains("fetch("));
        assert!(clean.contains("<img"));
    }

    #[test]
    fn test_javascript_protocol_is_stripped() {
        let sanitizer = HtmlSanitizer::new();
        let dirty = r#"<a href="javascript:alert('pwned')">Click here</a>"#;
        let clean = sanitizer.sanitize(dirty);

        assert!(!clean.contains("javascript:"));
        assert!(clean.contains("Click here"));
    }

    #[test]
    fn test_safe_gfm_markup_preserved() {
        let sanitizer = HtmlSanitizer::new();
        let safe = r#"<aside class="markdown-alert markdown-alert-note" data-alert-type="note"><p>Safe note</p></aside>"#;
        let clean = sanitizer.sanitize(safe);

        assert!(clean.contains("markdown-alert-note"));
        assert!(clean.contains("data-alert-type=\"note\""));
        assert!(clean.contains("Safe note"));
    }
}
