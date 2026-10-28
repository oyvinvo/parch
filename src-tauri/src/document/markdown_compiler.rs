use crate::document::document_models::{RenderedContent, TocItem};
use pulldown_cmark::{html, Event, HeadingLevel, Options, Parser, Tag, TagEnd};
use std::collections::HashMap;

#[derive(Debug, Default, Clone)]
pub struct MarkdownCompiler;

impl MarkdownCompiler {
    pub fn new() -> Self {
        Self
    }

    pub fn compile(&self, markdown: &str) -> RenderedContent {
        let mut options = Options::empty();
        options.insert(Options::ENABLE_TABLES);
        options.insert(Options::ENABLE_TASKLISTS);
        options.insert(Options::ENABLE_STRIKETHROUGH);
        options.insert(Options::ENABLE_HEADING_ATTRIBUTES);

        let parser = Parser::new_ext(markdown, options);
        let mut slug_counts: HashMap<String, usize> = HashMap::new();
        let mut flat_toc: Vec<TocItem> = Vec::new();

        let mut transformed_events: Vec<Event> = Vec::new();
        let mut in_heading: Option<u8> = None;
        let mut heading_text = String::new();
        let mut heading_events: Vec<Event> = Vec::new();

        for event in parser {
            match event {
                Event::Start(Tag::Heading { level, .. }) => {
                    let lvl = self.heading_level_to_u8(level);
                    in_heading = Some(lvl);
                    heading_text.clear();
                    heading_events.clear();
                }
                Event::End(TagEnd::Heading(_)) => {
                    if let Some(lvl) = in_heading.take() {
                        let slug = self.generate_slug(&heading_text, &mut slug_counts);
                        let title = heading_text.trim().to_string();
                        flat_toc.push(TocItem {
                            id: slug.clone(),
                            title,
                            level: lvl,
                            line_number: 0,
                            children: Vec::new(),
                        });

                        let mut inner_html = String::new();
                        html::push_html(&mut inner_html, heading_events.drain(..));
                        let heading_tag = format!(
                            "<h{lvl} id=\"{slug}\">{inner}</h{lvl}>\n",
                            lvl = lvl,
                            slug = slug,
                            inner = inner_html.trim()
                        );
                        transformed_events.push(Event::Html(heading_tag.into()));
                    }
                }
                _ if in_heading.is_some() => {
                    match &event {
                        Event::Text(t) => heading_text.push_str(t),
                        Event::Code(c) => heading_text.push_str(c),
                        _ => {}
                    }
                    heading_events.push(event);
                }
                _ => {
                    transformed_events.push(event);
                }
            }
        }

        let mut raw_html = String::new();
        html::push_html(&mut raw_html, transformed_events.into_iter());

        let final_html = self.transform_github_alerts(&raw_html);
        let outline = self.build_hierarchy(flat_toc);

        RenderedContent {
            sanitized_html: final_html,
            outline,
        }
    }

    fn heading_level_to_u8(&self, level: HeadingLevel) -> u8 {
        match level {
            HeadingLevel::H1 => 1,
            HeadingLevel::H2 => 2,
            HeadingLevel::H3 => 3,
            HeadingLevel::H4 => 4,
            HeadingLevel::H5 => 5,
            HeadingLevel::H6 => 6,
        }
    }

    fn generate_slug(&self, title: &str, counts: &mut HashMap<String, usize>) -> String {
        let base: String = title
            .trim()
            .chars()
            .map(|c| if c.is_alphanumeric() { c.to_ascii_lowercase() } else { '-' })
            .collect();

        let mut slug = String::new();
        let mut last_was_hyphen = true;
        for c in base.chars() {
            if c == '-' {
                if !last_was_hyphen {
                    slug.push('-');
                    last_was_hyphen = true;
                }
            } else {
                slug.push(c);
                last_was_hyphen = false;
            }
        }
        if slug.ends_with('-') {
            slug.pop();
        }
        if slug.is_empty() {
            slug = "section".to_string();
        }

        let count = counts.entry(slug.clone()).or_insert(0);
        let final_slug = if *count == 0 {
            slug
        } else {
            format!("{}-{}", slug, count)
        };
        *count += 1;
        final_slug
    }

    fn build_hierarchy(&self, flat_items: Vec<TocItem>) -> Vec<TocItem> {
        let mut root: Vec<TocItem> = Vec::new();
        let mut stack: Vec<TocItem> = Vec::new();

        for item in flat_items {
            while let Some(top) = stack.last() {
                if top.level >= item.level {
                    let finished = stack.pop().unwrap();
                    if let Some(parent) = stack.last_mut() {
                        parent.children.push(finished);
                    } else {
                        root.push(finished);
                    }
                } else {
                    break;
                }
            }
            stack.push(item);
        }

        while let Some(finished) = stack.pop() {
            if let Some(parent) = stack.last_mut() {
                parent.children.push(finished);
            } else {
                root.push(finished);
            }
        }

        root
    }

    fn transform_github_alerts(&self, html_input: &str) -> String {
        let alert_types = ["NOTE", "TIP", "IMPORTANT", "WARNING", "CAUTION"];
        let mut result = html_input.to_string();

        for alert_type in &alert_types {
            let lower_type = alert_type.to_lowercase();
            let patterns = [
                format!("<blockquote>\n<p>[!{}]", alert_type),
                format!("<blockquote><p>[!{}]", alert_type),
                format!("<blockquote>\n<p>[!{}]\n", alert_type),
            ];

            for pattern in &patterns {
                while let Some(start_pos) = result.find(pattern.as_str()) {
                    let rest = &result[start_pos..];
                    if let Some(end_rel) = rest.find("</blockquote>") {
                        let end_pos = start_pos + end_rel + 13;
                        let block = &result[start_pos..end_pos];

                        let open_tag = format!(
                            "<aside class=\"markdown-alert markdown-alert-{}\" data-alert-type=\"{}\">\n<p>",
                            lower_type, lower_type
                        );

                        // Strip pattern and replace closing blockquote with closing aside
                        let without_prefix = block.replacen(pattern.as_str(), "", 1);
                        let inner_clean = without_prefix.trim_start();
                        let inner_clean = inner_clean.strip_prefix("<br />").unwrap_or(inner_clean).trim_start();
                        let inner_clean = inner_clean.strip_prefix("<br>").unwrap_or(inner_clean).trim_start();
                        let without_suffix = inner_clean.replacen("</blockquote>", "</aside>", 1);

                        let replaced_block = format!("{}{}", open_tag, without_suffix);
                        result.replace_range(start_pos..end_pos, &replaced_block);
                    } else {
                        break;
                    }
                }
            }
        }

        result
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_compile_gfm_tables() {
        let compiler = MarkdownCompiler::new();
        let markdown = "| Col A | Col B |\n|---|---|\n| Cell 1 | Cell 2 |";
        let rendered = compiler.compile(markdown);

        assert!(rendered.sanitized_html.contains("<table>"));
        assert!(rendered.sanitized_html.contains("<th>Col A</th>"));
        assert!(rendered.sanitized_html.contains("<td>Cell 1</td>"));
    }

    #[test]
    fn test_compile_task_lists() {
        let compiler = MarkdownCompiler::new();
        let markdown = "- [x] Finished task\n- [ ] Pending task";
        let rendered = compiler.compile(markdown);

        assert!(rendered.sanitized_html.contains("type=\"checkbox\""));
        assert!(rendered.sanitized_html.contains("disabled"));
        assert!(rendered.sanitized_html.contains("checked"));
    }

    #[test]
    fn test_compile_github_note_alert() {
        let compiler = MarkdownCompiler::new();
        let markdown = "> [!NOTE]\n> This is useful information.";
        let rendered = compiler.compile(markdown);

        assert!(rendered.sanitized_html.contains("markdown-alert-note"));
        assert!(rendered.sanitized_html.contains("data-alert-type=\"note\""));
        assert!(rendered.sanitized_html.contains("This is useful information."));
    }

    #[test]
    fn test_compile_github_warning_alert() {
        let compiler = MarkdownCompiler::new();
        let markdown = "> [!WARNING]\n> Critical danger ahead.";
        let rendered = compiler.compile(markdown);

        assert!(rendered.sanitized_html.contains("markdown-alert-warning"));
        assert!(rendered.sanitized_html.contains("data-alert-type=\"warning\""));
        assert!(rendered.sanitized_html.contains("Critical danger ahead."));
    }

    #[test]
    fn test_standard_blockquote_remains_unaltered() {
        let compiler = MarkdownCompiler::new();
        let markdown = "> Regular literary quotation.";
        let rendered = compiler.compile(markdown);

        assert!(rendered.sanitized_html.contains("<blockquote>"));
        assert!(!rendered.sanitized_html.contains("markdown-alert"));
    }

    #[test]
    fn test_heading_outline_hierarchy_extraction() {
        let compiler = MarkdownCompiler::new();
        let markdown = "# Title\n\n## Subtitle A\n\n### Detail A1\n\n## Subtitle B";
        let rendered = compiler.compile(markdown);

        assert_eq!(rendered.outline.len(), 1);
        let root = &rendered.outline[0];
        assert_eq!(root.title, "Title");
        assert_eq!(root.level, 1);
        assert_eq!(root.children.len(), 2);
        assert_eq!(root.children[0].title, "Subtitle A");
        assert_eq!(root.children[0].children[0].title, "Detail A1");
        assert_eq!(root.children[1].title, "Subtitle B");
    }

    #[test]
    fn test_duplicate_heading_slug_disambiguation() {
        let compiler = MarkdownCompiler::new();
        let markdown = "# Overview\n\n## Overview\n\n### Overview";
        let rendered = compiler.compile(markdown);

        assert!(rendered.sanitized_html.contains("id=\"overview\""));
        assert!(rendered.sanitized_html.contains("id=\"overview-1\""));
        assert!(rendered.sanitized_html.contains("id=\"overview-2\""));
    }

    #[test]
    fn test_mermaid_fenced_code_block_preserved() {
        let compiler = MarkdownCompiler::new();
        let markdown = "```mermaid\ngraph TD\n  A --> B\n```";
        let rendered = compiler.compile(markdown);

        assert!(rendered.sanitized_html.contains("language-mermaid"));
        assert!(rendered.sanitized_html.contains("graph TD"));
    }
}
