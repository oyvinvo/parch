use std::env;
use std::path::PathBuf;
use thiserror::Error;

#[derive(Debug, PartialEq, Eq, Clone)]
pub enum CliAction {
    EmptyState,
    OpenFile {
        path: PathBuf,
        theme: Option<String>,
    },
    DisplayHelp,
    DisplayVersion,
    SelfUpdate,
}

#[derive(Debug, Error, PartialEq, Eq)]
pub enum CliError {
    #[error("Invalid argument or flag: {0}")]
    InvalidArgument(String),

    #[error("Missing target file: {0}")]
    FileNotFound(String),

    #[error("Binary or corrupted file detected: {0}")]
    BinaryFile(String),
}

impl CliError {
    pub fn exit_code(&self) -> i32 {
        match self {
            CliError::InvalidArgument(_) => 1,
            CliError::FileNotFound(_) => 2,
            CliError::BinaryFile(_) => 3,
        }
    }
}

#[derive(Debug, Default, Clone)]
pub struct CliArgumentParser;

impl CliArgumentParser {
    pub fn new() -> Self {
        Self
    }

    pub fn help_text() -> &'static str {
        "Usage: parch [OPTIONS] [FILE]\n\n\
         Arguments:\n  \
           [FILE]  Path to the Markdown file to open (.md, .markdown, or text file)\n\n\
         Options:\n  \
           -t, --theme <THEME>  Override initial theme: [system | light | dark | sepia]\n  \
           -u, --update         Check for updates and self-update from GitHub Releases (oyvinvo/parch)\n  \
           --headless           Run in headless mode (validate input and exit without GUI)\n  \
           -h, --help           Print help information\n  \
           -V, --version        Print version information\n"
    }

    pub fn is_headless(args: &[String]) -> bool {
        args.iter().any(|a| a == "--headless")
            || env::var("PARCH_HEADLESS")
                .or_else(|_| env::var("PARCHMENT_HEADLESS"))
                .map(|v| v == "1" || v.eq_ignore_ascii_case("true"))
                .unwrap_or(false)
    }

    pub fn parse(&self, args: &[String]) -> Result<CliAction, CliError> {
        if args.is_empty() {
            return Ok(CliAction::EmptyState);
        }

        if self.has_help_flag(args) {
            return Ok(CliAction::DisplayHelp);
        }

        if self.has_version_flag(args) {
            return Ok(CliAction::DisplayVersion);
        }

        if self.has_update_flag(args) {
            return Ok(CliAction::SelfUpdate);
        }

        self.parse_file_and_options(args)
    }

    fn has_help_flag(&self, args: &[String]) -> bool {
        args.iter().any(|a| a == "-h" || a == "--help")
    }

    fn has_version_flag(&self, args: &[String]) -> bool {
        args.iter().any(|a| a == "-V" || a == "--version")
    }

    fn has_update_flag(&self, args: &[String]) -> bool {
        args.iter().any(|a| a == "-u" || a == "--update")
    }

    fn parse_file_and_options(&self, args: &[String]) -> Result<CliAction, CliError> {
        let mut target_file: Option<PathBuf> = None;
        let mut theme: Option<String> = None;
        let mut idx = 0;

        while idx < args.len() {
            let arg = &args[idx];
            if arg == "-t" || arg == "--theme" {
                idx += 1;
                if idx >= args.len() {
                    return Err(CliError::InvalidArgument("Missing value for theme option".into()));
                }
                let val = &args[idx];
                if !self.is_valid_theme(val) {
                    return Err(CliError::InvalidArgument(format!("Invalid theme value: {}", val)));
                }
                theme = Some(val.clone());
            } else if arg == "--headless" {
                // Headless mode flag is handled by is_headless
            } else if arg.starts_with('-') {
                return Err(CliError::InvalidArgument(format!("Unknown option: {}", arg)));
            } else if target_file.is_none() {
                target_file = Some(Self::parse_file_target(arg));
            } else {
                return Err(CliError::InvalidArgument(format!("Unexpected argument: {}", arg)));
            }
            idx += 1;
        }

        match target_file {
            Some(path) => Ok(CliAction::OpenFile { path, theme }),
            None => Ok(CliAction::EmptyState),
        }
    }

    fn parse_file_target(arg: &str) -> PathBuf {
        if let Some(stripped) = arg.strip_prefix("file://") {
            let decoded = Self::percent_decode(stripped);
            PathBuf::from(decoded)
        } else {
            PathBuf::from(arg)
        }
    }

    fn percent_decode(input: &str) -> String {
        let mut bytes = Vec::with_capacity(input.len());
        let mut byte_iter = input.bytes();
        while let Some(b) = byte_iter.next() {
            if b == b'%' {
                let high = byte_iter.next();
                let low = byte_iter.next();
                match (high.and_then(Self::hex_val), low.and_then(Self::hex_val)) {
                    (Some(h), Some(l)) => bytes.push((h << 4) | l),
                    _ => {
                        bytes.push(b'%');
                        if let Some(h) = high {
                            bytes.push(h);
                        }
                        if let Some(l) = low {
                            bytes.push(l);
                        }
                    }
                }
            } else {
                bytes.push(b);
            }
        }
        String::from_utf8_lossy(&bytes).to_string()
    }

    fn hex_val(b: u8) -> Option<u8> {
        match b {
            b'0'..=b'9' => Some(b - b'0'),
            b'a'..=b'f' => Some(b - b'a' + 10),
            b'A'..=b'F' => Some(b - b'A' + 10),
            _ => None,
        }
    }

    fn is_valid_theme(&self, theme: &str) -> bool {
        matches!(theme, "system" | "light" | "dark" | "sepia")
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_empty_arguments_yields_empty_state() {
        let parser = CliArgumentParser::new();
        let args: Vec<String> = vec![];
        let result = parser.parse(&args);
        assert_eq!(result, Ok(CliAction::EmptyState));
    }

    #[test]
    fn test_parse_help_flags() {
        let parser = CliArgumentParser::new();
        assert_eq!(parser.parse(&["-h".to_string()]), Ok(CliAction::DisplayHelp));
        assert_eq!(parser.parse(&["--help".to_string()]), Ok(CliAction::DisplayHelp));
    }

    #[test]
    fn test_parse_version_flags() {
        let parser = CliArgumentParser::new();
        assert_eq!(parser.parse(&["-V".to_string()]), Ok(CliAction::DisplayVersion));
        assert_eq!(parser.parse(&["--version".to_string()]), Ok(CliAction::DisplayVersion));
    }

    #[test]
    fn test_parse_update_flags() {
        let parser = CliArgumentParser::new();
        assert_eq!(parser.parse(&["-u".to_string()]), Ok(CliAction::SelfUpdate));
        assert_eq!(parser.parse(&["--update".to_string()]), Ok(CliAction::SelfUpdate));
    }

    #[test]
    fn test_parse_single_markdown_file() {
        let parser = CliArgumentParser::new();
        let args = vec!["/home/user/docs/readme.md".to_string()];
        let expected = CliAction::OpenFile {
            path: PathBuf::from("/home/user/docs/readme.md"),
            theme: None,
        };
        assert_eq!(parser.parse(&args), Ok(expected));
    }

    #[test]
    fn test_parse_file_with_theme_override() {
        let parser = CliArgumentParser::new();
        let args = vec![
            "-t".to_string(),
            "sepia".to_string(),
            "/home/user/notes.md".to_string(),
        ];
        let expected = CliAction::OpenFile {
            path: PathBuf::from("/home/user/notes.md"),
            theme: Some("sepia".to_string()),
        };
        assert_eq!(parser.parse(&args), Ok(expected));
    }

    #[test]
    fn test_parse_file_with_headless_flag() {
        let parser = CliArgumentParser::new();
        let args = vec![
            "--headless".to_string(),
            "/home/user/notes.md".to_string(),
        ];
        let expected = CliAction::OpenFile {
            path: PathBuf::from("/home/user/notes.md"),
            theme: None,
        };
        assert_eq!(parser.parse(&args), Ok(expected));
        assert!(CliArgumentParser::is_headless(&args));
    }

    #[test]
    fn test_parse_invalid_flag_yields_exit_code_1() {
        let parser = CliArgumentParser::new();
        let args = vec!["--unknown-flag".to_string()];
        let err = parser.parse(&args).unwrap_err();
        assert_eq!(err.exit_code(), 1);
    }

    #[test]
    fn test_parse_missing_theme_value_yields_exit_code_1() {
        let parser = CliArgumentParser::new();
        let args = vec!["--theme".to_string()];
        let err = parser.parse(&args).unwrap_err();
        assert_eq!(err.exit_code(), 1);
    }

    #[test]
    fn test_parse_invalid_theme_value_yields_exit_code_1() {
        let parser = CliArgumentParser::new();
        let args = vec!["--theme".to_string(), "neon".to_string(), "doc.md".to_string()];
        let err = parser.parse(&args).unwrap_err();
        assert_eq!(err.exit_code(), 1);
    }

    #[test]
    fn test_parse_file_uri_strips_file_protocol_prefix() {
        let parser = CliArgumentParser::new();
        let args = vec!["file:///home/user/notes.md".to_string()];
        let result = parser.parse(&args);
        let expected = CliAction::OpenFile {
            path: PathBuf::from("/home/user/notes.md"),
            theme: None,
        };
        assert_eq!(result, Ok(expected));
    }

    #[test]
    fn test_parse_file_uri_percent_decodes_spaces_and_special_chars() {
        let parser = CliArgumentParser::new();
        let args = vec!["file:///home/user/My%20Documents/weekly%20notes%26summary.md".to_string()];
        let result = parser.parse(&args);
        let expected = CliAction::OpenFile {
            path: PathBuf::from("/home/user/My Documents/weekly notes&summary.md"),
            theme: None,
        };
        assert_eq!(result, Ok(expected));
    }
}
