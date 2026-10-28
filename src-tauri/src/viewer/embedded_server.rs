use crate::document::document_service::{DocumentService, OpenDocumentPayload};
use crate::document::html_sanitizer::HtmlSanitizer;
use crate::document::markdown_compiler::MarkdownCompiler;
use crate::preferences::preferences_models::UserPreferences;
use crate::preferences::preferences_service::PreferencesService;
use serde::{Deserialize, Serialize};
use std::fs;
use std::io::{Read, Write};
use std::net::{TcpListener, TcpStream};
use std::path::{Path, PathBuf};
use std::process::Command;
use std::sync::{Arc, RwLock};
use std::thread;
use std::time::SystemTime;

include!(concat!(env!("OUT_DIR"), "/embedded_assets.rs"));

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct InitialStateResponse {
    pub path: Option<String>,
    pub cli_theme: Option<String>,
    pub payload: Option<OpenDocumentPayload>,
    pub preferences: UserPreferences,
    pub system_dark: bool,
}

#[derive(Deserialize)]
struct OpenDocRequest {
    path: String,
}

#[derive(Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct CompileMarkdownRequest {
    filename: String,
    raw_markdown: String,
}

#[derive(Deserialize)]
struct SetPrefRequest {
    key: String,
    value: String,
}

#[derive(Serialize)]
struct PickFileResponse {
    path: Option<String>,
}

#[derive(Serialize)]
#[serde(tag = "event")]
enum PollEventResponse {
    #[serde(rename = "none")]
    None,
    #[serde(rename = "deleted")]
    Deleted { path: String },
    #[serde(rename = "changed")]
    Changed { payload: OpenDocumentPayload },
}

pub struct ServerState {
    pub current_path: Option<PathBuf>,
    pub cli_theme: Option<String>,
    pub initial_payload: Option<OpenDocumentPayload>,
    pub document_service: DocumentService,
    pub preferences_service: PreferencesService,
    pub last_mtime: Option<SystemTime>,
    pub last_exists: bool,
    pub dist_dir: PathBuf,
}

pub struct EmbeddedServer {
    port: u16,
    _handle: thread::JoinHandle<()>,
}

impl EmbeddedServer {
    pub fn start(
        state: Arc<RwLock<ServerState>>,
    ) -> Result<Self, Box<dyn std::error::Error + Send + Sync>> {
        let listener = TcpListener::bind("127.0.0.1:0")?;
        let port = listener.local_addr()?.port();

        let handle = thread::spawn(move || {
            for stream in listener.incoming() {
                if let Ok(mut stream) = stream {
                    let state_clone = Arc::clone(&state);
                    thread::spawn(move || {
                        let _ = handle_client(&mut stream, &state_clone);
                    });
                }
            }
        });

        Ok(Self {
            port,
            _handle: handle,
        })
    }

    pub fn port(&self) -> u16 {
        self.port
    }

    pub fn url(&self) -> String {
        format!("http://127.0.0.1:{}/", self.port)
    }
}

fn handle_client(
    stream: &mut TcpStream,
    state: &Arc<RwLock<ServerState>>,
) -> Result<(), Box<dyn std::error::Error>> {
    let (headers, body) = match read_http_request(stream) {
        Ok(res) => res,
        Err(_) => return Ok(()),
    };

    if headers.is_empty() {
        return Ok(());
    }

    let request_line = match headers.lines().next() {
        Some(line) => line,
        None => return Ok(()),
    };

    let mut parts = request_line.split_whitespace();
    let method = parts.next().unwrap_or("GET");
    let target = parts.next().unwrap_or("/");

    if method == "OPTIONS" {
        send_cors_response(stream)?;
        return Ok(());
    }

    dispatch_request(stream, state, method, target, &body)
}

fn dispatch_request(
    stream: &mut TcpStream,
    state: &Arc<RwLock<ServerState>>,
    method: &str,
    target: &str,
    body: &str,
) -> Result<(), Box<dyn std::error::Error>> {
    if target.starts_with("/api/") {
        dispatch_api_request(stream, state, method, target, body)
    } else {
        handle_static_file(stream, state, target)
    }
}

fn dispatch_api_request(
    stream: &mut TcpStream,
    state: &Arc<RwLock<ServerState>>,
    method: &str,
    target: &str,
    body: &str,
) -> Result<(), Box<dyn std::error::Error>> {
    match (target, method) {
        ("/api/initial-state", "GET") => handle_api_initial_state(stream, state),
        ("/api/compile-markdown", "POST") => handle_api_compile_markdown(stream, body),
        ("/api/open-document", "POST") => handle_api_open_document(stream, state, body),
        ("/api/pick-file", "POST") => handle_api_pick_file(stream),
        ("/api/preferences", "GET") => handle_api_get_preferences(stream, state),
        ("/api/preferences", "POST") => handle_api_set_preference(stream, state, body),
        ("/api/poll-events", "GET") => handle_api_poll_events(stream, state),
        ("/api/check-update", "GET") => handle_api_check_update(stream),
        ("/api/trigger-update", "POST") => handle_api_trigger_update(stream),
        _ if target.starts_with("/api/asset") && method == "GET" => {
            handle_api_asset(stream, state, target)
        }
        _ => send_error_response(stream, 404, "Endpoint not found"),
    }
}

fn read_http_request(
    stream: &mut TcpStream,
) -> Result<(String, String), Box<dyn std::error::Error>> {
    let mut raw_data = Vec::with_capacity(8192);
    let mut temp = [0u8; 8192];

    loop {
        let n = stream.read(&mut temp)?;
        if n == 0 {
            break;
        }
        raw_data.extend_from_slice(&temp[..n]);
        if find_header_end(&raw_data).is_some() {
            break;
        }
    }

    if raw_data.is_empty() {
        return Ok((String::new(), String::new()));
    }

    let (headers_bytes, mut body_bytes) = if let Some(pos) = find_header_end(&raw_data) {
        let (h, b) = raw_data.split_at(pos);
        (h.to_vec(), b.to_vec())
    } else {
        (raw_data.clone(), Vec::new())
    };

    let header_str = String::from_utf8_lossy(&headers_bytes);
    let content_length = parse_content_length(&header_str);

    while body_bytes.len() < content_length {
        let to_read = (content_length - body_bytes.len()).min(temp.len());
        let n = stream.read(&mut temp[..to_read])?;
        if n == 0 {
            break;
        }
        body_bytes.extend_from_slice(&temp[..n]);
    }

    if content_length > 0 && body_bytes.len() > content_length {
        body_bytes.truncate(content_length);
    }

    let body_str = String::from_utf8_lossy(&body_bytes).to_string();
    Ok((header_str.to_string(), body_str))
}

fn find_header_end(bytes: &[u8]) -> Option<usize> {
    if let Some(pos) = bytes.windows(4).position(|w| w == b"\r\n\r\n") {
        Some(pos + 4)
    } else {
        bytes.windows(2).position(|w| w == b"\n\n").map(|p| p + 2)
    }
}

fn parse_content_length(headers: &str) -> usize {
    for line in headers.lines() {
        let mut parts = line.splitn(2, ':');
        if let (Some(name), Some(val_str)) = (parts.next(), parts.next()) {
            if name.trim().eq_ignore_ascii_case("content-length") {
                if let Ok(val) = val_str.trim().parse::<usize>() {
                    return val;
                }
            }
        }
    }
    0
}

fn handle_api_compile_markdown(
    stream: &mut TcpStream,
    body: &str,
) -> Result<(), Box<dyn std::error::Error>> {
    let req: CompileMarkdownRequest = match serde_json::from_str(body) {
        Ok(r) => r,
        Err(_) => return send_error_response(stream, 400, "Invalid JSON body"),
    };

    let compiler = MarkdownCompiler::new();
    let sanitizer = HtmlSanitizer::new();

    let rendered = compiler.compile(&req.raw_markdown);
    let sanitized_html = sanitizer.sanitize(&rendered.sanitized_html);
    let byte_size = req.raw_markdown.as_bytes().len();

    let payload = OpenDocumentPayload {
        canonical_path: PathBuf::from(&req.filename),
        display_name: req.filename,
        raw_markdown: req.raw_markdown,
        sanitized_html,
        outline: rendered.outline,
        byte_size,
    };

    send_json_response(stream, 200, &payload)
}

pub fn detect_system_dark_mode() -> bool {
    if cfg!(target_os = "macos") {
        return check_macos_dark_mode();
    }

    check_gsettings_setting("color-scheme", &["prefer-dark", "dark"])
        || check_gsettings_setting("gtk-theme", &["-dark", "dark"])
}

fn check_macos_dark_mode() -> bool {
    let output = match Command::new("defaults")
        .args(["read", "-g", "AppleInterfaceStyle"])
        .output()
    {
        Ok(o) if o.status.success() => o,
        _ => return false,
    };

    let val = String::from_utf8_lossy(&output.stdout).to_lowercase();
    val.contains("dark")
}

fn check_gsettings_setting(key: &str, keywords: &[&str]) -> bool {
    let output = match Command::new("gsettings")
        .args(["get", "org.gnome.desktop.interface", key])
        .output()
    {
        Ok(o) if o.status.success() => o,
        _ => return false,
    };

    let val = String::from_utf8_lossy(&output.stdout).to_lowercase();
    keywords.iter().any(|&kw| val.contains(kw))
}

fn handle_api_initial_state(
    stream: &mut TcpStream,
    state: &Arc<RwLock<ServerState>>,
) -> Result<(), Box<dyn std::error::Error>> {
    let s = state.read().unwrap();
    let prefs = s.preferences_service.get_preferences().unwrap_or_default();
    let response = InitialStateResponse {
        path: s.current_path.as_ref().map(|p| p.to_string_lossy().to_string()),
        cli_theme: s.cli_theme.clone(),
        payload: s.initial_payload.clone(),
        preferences: prefs,
        system_dark: detect_system_dark_mode(),
    };
    send_json_response(stream, 200, &response)
}

fn handle_api_open_document(
    stream: &mut TcpStream,
    state: &Arc<RwLock<ServerState>>,
    body: &str,
) -> Result<(), Box<dyn std::error::Error>> {
    let req: OpenDocRequest = match serde_json::from_str(body) {
        Ok(r) => r,
        Err(_) => return send_error_response(stream, 400, "Invalid JSON body"),
    };

    let target_path = PathBuf::from(&req.path);
    let mut s = state.write().unwrap();
    match s.document_service.open_document(&target_path) {
        Ok(payload) => {
            s.current_path = Some(target_path.clone());
            s.last_mtime = fs::metadata(&target_path).ok().and_then(|m| m.modified().ok());
            s.last_exists = true;
            send_json_response(stream, 200, &payload)
        }
        Err(err) => send_error_response(stream, 404, &err.to_string()),
    }
}

fn handle_api_pick_file(stream: &mut TcpStream) -> Result<(), Box<dyn std::error::Error>> {
    let path = pick_file_native();
    send_json_response(stream, 200, &PickFileResponse { path })
}

fn handle_api_get_preferences(
    stream: &mut TcpStream,
    state: &Arc<RwLock<ServerState>>,
) -> Result<(), Box<dyn std::error::Error>> {
    let s = state.read().unwrap();
    let prefs = s.preferences_service.get_preferences().unwrap_or_default();
    send_json_response(stream, 200, &prefs)
}

fn handle_api_set_preference(
    stream: &mut TcpStream,
    state: &Arc<RwLock<ServerState>>,
    body: &str,
) -> Result<(), Box<dyn std::error::Error>> {
    let req: SetPrefRequest = match serde_json::from_str(body) {
        Ok(r) => r,
        Err(_) => return send_error_response(stream, 400, "Invalid JSON body"),
    };

    let s = state.read().unwrap();
    match s.preferences_service.set_preference(&req.key, &req.value) {
        Ok(updated) => send_json_response(stream, 200, &updated),
        Err(err) => send_error_response(stream, 400, &err.to_string()),
    }
}

fn handle_api_poll_events(
    stream: &mut TcpStream,
    state: &Arc<RwLock<ServerState>>,
) -> Result<(), Box<dyn std::error::Error>> {
    let mut s = state.write().unwrap();
    let current_path = match &s.current_path {
        Some(p) => p.clone(),
        None => return send_json_response(stream, 200, &PollEventResponse::None),
    };

    let exists = current_path.exists();
    if s.last_exists && !exists {
        s.last_exists = false;
        let response = PollEventResponse::Deleted {
            path: current_path.to_string_lossy().to_string(),
        };
        return send_json_response(stream, 200, &response);
    }

    if exists {
        let current_mtime = fs::metadata(&current_path).ok().and_then(|m| m.modified().ok());
        if current_mtime > s.last_mtime {
            s.last_mtime = current_mtime;
            s.last_exists = true;
            if let Ok(payload) = s.document_service.open_document(&current_path) {
                let response = PollEventResponse::Changed { payload };
                return send_json_response(stream, 200, &response);
            }
        }
    }

    send_json_response(stream, 200, &PollEventResponse::None)
}

fn handle_api_asset(
    stream: &mut TcpStream,
    state: &Arc<RwLock<ServerState>>,
    target: &str,
) -> Result<(), Box<dyn std::error::Error>> {
    let (doc_param, rel_param) = parse_query_params(target);
    if doc_param.is_empty() || rel_param.is_empty() {
        return send_error_response(stream, 400, "Missing doc or rel parameter");
    }

    let s = state.read().unwrap();
    let resolved_uri = match s.document_service.resolve_asset(Path::new(&doc_param), &rel_param) {
        Ok(uri) => uri,
        Err(_) => return send_error_response(stream, 403, "Access to asset prohibited"),
    };

    let local_path_str = resolved_uri.strip_prefix("asset://").unwrap_or(&resolved_uri);
    let bytes = match fs::read(local_path_str) {
        Ok(b) => b,
        Err(_) => return send_error_response(stream, 404, "Asset not found"),
    };

    let mime = mime_from_extension(Path::new(local_path_str));
    send_bytes_response(stream, 200, mime, &bytes)
}

fn handle_static_file(
    stream: &mut TcpStream,
    state: &Arc<RwLock<ServerState>>,
    target: &str,
) -> Result<(), Box<dyn std::error::Error>> {
    let clean_target = target.split('?').next().unwrap_or(target);
    let relative_path = clean_target.trim_start_matches('/');

    let lookup_path = if relative_path.is_empty() || relative_path == "index.html" {
        "index.html"
    } else {
        relative_path
    };

    if let Some(bytes) = get_embedded_file(lookup_path) {
        let mime = mime_from_extension(Path::new(lookup_path));
        return send_bytes_response(stream, 200, mime, bytes);
    } else if !lookup_path.starts_with("assets/") {
        if let Some(bytes) = get_embedded_file("index.html") {
            let mime = mime_from_extension(Path::new("index.html"));
            return send_bytes_response(stream, 200, mime, bytes);
        }
    }

    let dist_dir = {
        let s = state.read().unwrap();
        s.dist_dir.clone()
    };

    let target_file = dist_dir.join(lookup_path);
    let file_to_serve = if target_file.exists() && target_file.is_file() {
        target_file
    } else {
        dist_dir.join("index.html")
    };

    if !file_to_serve.exists() {
        return send_error_response(stream, 404, "Dist files not found");
    }

    let bytes = fs::read(&file_to_serve)?;
    let mime = mime_from_extension(&file_to_serve);
    send_bytes_response(stream, 200, mime, &bytes)
}

fn parse_query_params(target: &str) -> (String, String) {
    let mut doc = String::new();
    let mut rel = String::new();
    if let Some(pos) = target.find('?') {
        let query = &target[pos + 1..];
        for pair in query.split('&') {
            let mut kv = pair.splitn(2, '=');
            let key = kv.next().unwrap_or("");
            let val = kv.next().unwrap_or("");
            let decoded = url_decode(val);
            if key == "doc" {
                doc = decoded;
            } else if key == "rel" {
                rel = decoded;
            }
        }
    }
    (doc, rel)
}

fn url_decode(input: &str) -> String {
    let mut output = String::new();
    let mut chars = input.chars().peekable();
    while let Some(c) = chars.next() {
        if c == '%' {
            let hex: String = chars.by_ref().take(2).collect();
            if let Ok(byte) = u8::from_str_radix(&hex, 16) {
                output.push(byte as char);
            }
        } else if c == '+' {
            output.push(' ');
        } else {
            output.push(c);
        }
    }
    output
}

fn mime_from_extension(path: &Path) -> &'static str {
    match path.extension().and_then(|s| s.to_str()).unwrap_or("") {
        "html" => "text/html; charset=utf-8",
        "css" => "text/css; charset=utf-8",
        "js" | "mjs" => "application/javascript; charset=utf-8",
        "json" => "application/json",
        "svg" => "image/svg+xml",
        "png" => "image/png",
        "jpg" | "jpeg" => "image/jpeg",
        "gif" => "image/gif",
        "webp" => "image/webp",
        "woff2" => "font/woff2",
        _ => "application/octet-stream",
    }
}

fn pick_file_native() -> Option<String> {
    if cfg!(target_os = "macos") {
        return pick_file_macos();
    }

    if let Ok(output) = Command::new("zenity")
        .args(&[
            "--file-selection",
            "--title=Open Markdown File",
            "--file-filter=Markdown files (*.md *.markdown) | *.md *.markdown *.mdown *.mkd",
            "--file-filter=All files | *",
        ])
        .output()
    {
        if output.status.success() {
            let path_str = String::from_utf8_lossy(&output.stdout).trim().to_string();
            if !path_str.is_empty() {
                return Some(path_str);
            }
        }
    }

    let py_script = r#"
import gi
try:
    gi.require_version('Gtk', '3.0')
    from gi.repository import Gtk
    dialog = Gtk.FileChooserDialog(
        title="Open Markdown File",
        action=Gtk.FileChooserAction.OPEN
    )
    dialog.add_buttons(Gtk.STOCK_CANCEL, Gtk.ResponseType.CANCEL, Gtk.STOCK_OPEN, Gtk.ResponseType.OK)
    filter_md = Gtk.FileFilter()
    filter_md.set_name("Markdown files (*.md, *.markdown)")
    filter_md.add_pattern("*.md")
    filter_md.add_pattern("*.markdown")
    filter_md.add_pattern("*.mdown")
    filter_md.add_pattern("*.mkd")
    dialog.add_filter(filter_md)
    filter_all = Gtk.FileFilter()
    filter_all.set_name("All files")
    filter_all.add_pattern("*")
    dialog.add_filter(filter_all)
    response = dialog.run()
    if response == Gtk.ResponseType.OK:
        print(dialog.get_filename())
    dialog.destroy()
except Exception:
    pass
"#;
    if let Ok(output) = Command::new("python3").arg("-c").arg(py_script).output() {
        if output.status.success() {
            let path_str = String::from_utf8_lossy(&output.stdout).trim().to_string();
            if !path_str.is_empty() {
                return Some(path_str);
            }
        }
    }

    None
}

fn pick_file_macos() -> Option<String> {
    let script = "POSIX path of (choose file with prompt \"Open Markdown File\")";
    let output = Command::new("osascript").args(["-e", script]).output().ok()?;
    if !output.status.success() {
        return None;
    }
    let path = String::from_utf8_lossy(&output.stdout).trim().to_string();
    if path.is_empty() {
        None
    } else {
        Some(path)
    }
}

#[derive(Serialize)]
struct TriggerUpdateResponse {
    success: bool,
    message: String,
}

fn handle_api_check_update(stream: &mut TcpStream) -> Result<(), Box<dyn std::error::Error>> {
    let res = crate::cli::self_update_service::SelfUpdateService::check_for_update(env!("CARGO_PKG_VERSION"));
    send_json_response(stream, 200, &res)
}

fn handle_api_trigger_update(stream: &mut TcpStream) -> Result<(), Box<dyn std::error::Error>> {
    match crate::cli::self_update_service::SelfUpdateService::run_self_update(env!("CARGO_PKG_VERSION")) {
        Ok(msg) => send_json_response(
            stream,
            200,
            &TriggerUpdateResponse {
                success: true,
                message: msg,
            },
        ),
        Err(err) => send_json_response(
            stream,
            200,
            &TriggerUpdateResponse {
                success: false,
                message: err,
            },
        ),
    }
}

fn send_cors_response(stream: &mut TcpStream) -> Result<(), Box<dyn std::error::Error>> {
    let header = "HTTP/1.1 204 No Content\r\n\
                  Access-Control-Allow-Origin: *\r\n\
                  Access-Control-Allow-Methods: GET, POST, OPTIONS\r\n\
                  Access-Control-Allow-Headers: Content-Type\r\n\
                  Connection: close\r\n\r\n";
    stream.write_all(header.as_bytes())?;
    Ok(())
}

fn send_json_response<T: Serialize>(
    stream: &mut TcpStream,
    status: u16,
    data: &T,
) -> Result<(), Box<dyn std::error::Error>> {
    let json = serde_json::to_string(data)?;
    let header = format!(
        "HTTP/1.1 {} OK\r\n\
         Content-Type: application/json; charset=utf-8\r\n\
         Access-Control-Allow-Origin: *\r\n\
         Content-Length: {}\r\n\
         Connection: close\r\n\r\n",
        status,
        json.len()
    );
    stream.write_all(header.as_bytes())?;
    stream.write_all(json.as_bytes())?;
    Ok(())
}

fn send_bytes_response(
    stream: &mut TcpStream,
    status: u16,
    content_type: &str,
    bytes: &[u8],
) -> Result<(), Box<dyn std::error::Error>> {
    let header = format!(
        "HTTP/1.1 {} OK\r\n\
         Content-Type: {}\r\n\
         Access-Control-Allow-Origin: *\r\n\
         Content-Length: {}\r\n\
         Connection: close\r\n\r\n",
        status,
        content_type,
        bytes.len()
    );
    stream.write_all(header.as_bytes())?;
    stream.write_all(bytes)?;
    Ok(())
}

fn send_error_response(
    stream: &mut TcpStream,
    status: u16,
    message: &str,
) -> Result<(), Box<dyn std::error::Error>> {
    let err_json = format!("{{\"error\":\"{}\"}}", message);
    let header = format!(
        "HTTP/1.1 {} Error\r\n\
         Content-Type: application/json; charset=utf-8\r\n\
         Access-Control-Allow-Origin: *\r\n\
         Content-Length: {}\r\n\
         Connection: close\r\n\r\n",
        status,
        err_json.len()
    );
    stream.write_all(header.as_bytes())?;
    stream.write_all(err_json.as_bytes())?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::document::asset_path_resolver::AssetPathResolver;
    use crate::document::fs_document_reader::FsDocumentReader;
    use crate::document::html_sanitizer::HtmlSanitizer;
    use crate::document::markdown_compiler::MarkdownCompiler;
    use std::io::Read;
    use std::net::TcpStream;
    use tempfile::tempdir;

    #[test]
    fn test_mime_from_extension() {
        assert_eq!(mime_from_extension(Path::new("index.html")), "text/html; charset=utf-8");
        assert_eq!(mime_from_extension(Path::new("style.css")), "text/css; charset=utf-8");
        assert_eq!(mime_from_extension(Path::new("app.js")), "application/javascript; charset=utf-8");
        assert_eq!(mime_from_extension(Path::new("icon.svg")), "image/svg+xml");
        assert_eq!(mime_from_extension(Path::new("file.unknown")), "application/octet-stream");
    }

    #[test]
    fn test_url_decode() {
        assert_eq!(url_decode("hello%20world"), "hello world");
        assert_eq!(url_decode("hello+world"), "hello world");
        assert_eq!(url_decode("pure-text"), "pure-text");
    }

    #[test]
    fn test_parse_query_params() {
        let (doc, rel) = parse_query_params("/api/asset?doc=%2Ftmp%2Ftest.md&rel=img%2Fa.png");
        assert_eq!(doc, "/tmp/test.md");
        assert_eq!(rel, "img/a.png");

        let (empty_doc, empty_rel) = parse_query_params("/api/asset");
        assert_eq!(empty_doc, "");
        assert_eq!(empty_rel, "");
    }

    #[test]
    fn test_embedded_server_lifecycle_and_initial_state() {
        let dir = tempdir().unwrap();
        let doc_service = DocumentService::new(
            FsDocumentReader::new(),
            MarkdownCompiler::new(),
            HtmlSanitizer::new(),
            AssetPathResolver::new(),
        );
        let pref_service = PreferencesService::new(dir.path().join("config.json"));

        let state = Arc::new(RwLock::new(ServerState {
            current_path: None,
            cli_theme: Some("dark".into()),
            initial_payload: None,
            document_service: doc_service,
            preferences_service: pref_service,
            last_mtime: None,
            last_exists: false,
            dist_dir: dir.path().to_path_buf(),
        }));

        let server = EmbeddedServer::start(state).expect("Server should start");
        assert!(server.port() > 0);
        assert!(server.url().starts_with("http://127.0.0.1:"));

        let mut stream = TcpStream::connect(format!("127.0.0.1:{}", server.port())).unwrap();
        let request = format!(
            "GET /api/initial-state HTTP/1.1\r\nHost: 127.0.0.1:{}\r\nConnection: close\r\n\r\n",
            server.port()
        );
        stream.write_all(request.as_bytes()).unwrap();

        let mut response = String::new();
        stream.read_to_string(&mut response).unwrap();
        assert!(response.contains("HTTP/1.1 200 OK"));
        assert!(response.contains("\"cliTheme\":\"dark\""));
        assert!(response.contains("\"systemDark\":"));

        // Test POST /api/compile-markdown
        let mut compile_stream = TcpStream::connect(format!("127.0.0.1:{}", server.port())).unwrap();
        let payload_json = r##"{"filename":"note.md","rawMarkdown":"# Hello World\n\nBold **text**"}"##;
        let compile_req = format!(
            "POST /api/compile-markdown HTTP/1.1\r\nHost: 127.0.0.1:{}\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{}",
            server.port(),
            payload_json.len(),
            payload_json
        );
        compile_stream.write_all(compile_req.as_bytes()).unwrap();

        let mut compile_res = String::new();
        compile_stream.read_to_string(&mut compile_res).unwrap();
        assert!(compile_res.contains("HTTP/1.1 200 OK"));
        assert!(compile_res.contains("\"displayName\":\"note.md\""));
        assert!(compile_res.contains("\"sanitizedHtml\":"));
        assert!(compile_res.contains("<h1"));
        assert!(compile_res.contains("<strong>text</strong>"));
        assert!(compile_res.contains("\"outline\":"));
    }

    #[test]
    fn test_embedded_server_large_markdown_compilation() {
        let dir = tempdir().unwrap();
        let doc_service = DocumentService::new(
            FsDocumentReader::new(),
            MarkdownCompiler::new(),
            HtmlSanitizer::new(),
            AssetPathResolver::new(),
        );
        let pref_service = PreferencesService::new(dir.path().join("config.json"));

        let state = Arc::new(RwLock::new(ServerState {
            current_path: None,
            cli_theme: None,
            initial_payload: None,
            document_service: doc_service,
            preferences_service: pref_service,
            last_mtime: None,
            last_exists: false,
            dist_dir: dir.path().to_path_buf(),
        }));

        let server = EmbeddedServer::start(state).expect("Server should start");

        // Create a large markdown (> 16 KB) with multiple headers
        let mut large_md = String::from("# Large Document Title\n\n");
        for i in 1..=500 {
            large_md.push_str(&format!("## Section {}\n\nParagraph text line with content {}\n\n", i, i));
        }
        let req_struct = CompileMarkdownRequest {
            filename: "large.md".into(),
            raw_markdown: large_md,
        };
        let body_json = serde_json::to_string(&req_struct).unwrap();
        assert!(body_json.len() > 16384);

        let mut stream = TcpStream::connect(format!("127.0.0.1:{}", server.port())).unwrap();
        let request = format!(
            "POST /api/compile-markdown HTTP/1.1\r\nHost: 127.0.0.1:{}\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{}",
            server.port(),
            body_json.len(),
            body_json
        );
        stream.write_all(request.as_bytes()).unwrap();

        let mut res = String::new();
        stream.read_to_string(&mut res).unwrap();
        assert!(res.contains("HTTP/1.1 200 OK"));
        assert!(res.contains("\"displayName\":\"large.md\""));
        assert!(res.contains("<h1"));
        assert!(res.contains("Large Document Title"));
        assert!(res.contains("Section 500"));
    }

    #[test]
    fn test_detect_system_dark_mode_does_not_panic() {
        let _ = detect_system_dark_mode();
    }

    #[test]
    fn test_get_embedded_file_does_not_panic() {
        let _ = get_embedded_file("non-existent-file.xyz");
    }

    #[test]
    fn test_check_update_endpoint_returns_json() {
        let dir = tempdir().unwrap();
        let doc_service = DocumentService::new(
            FsDocumentReader::new(),
            MarkdownCompiler::new(),
            HtmlSanitizer::new(),
            AssetPathResolver::new(),
        );
        let pref_service = PreferencesService::new(dir.path().join("config.json"));

        let state = Arc::new(RwLock::new(ServerState {
            current_path: None,
            cli_theme: None,
            initial_payload: None,
            document_service: doc_service,
            preferences_service: pref_service,
            last_mtime: None,
            last_exists: false,
            dist_dir: dir.path().to_path_buf(),
        }));

        let server = EmbeddedServer::start(state).expect("Server should start");
        let mut stream = TcpStream::connect(format!("127.0.0.1:{}", server.port())).unwrap();
        let request = format!(
            "GET /api/check-update HTTP/1.1\r\nHost: 127.0.0.1:{}\r\nConnection: close\r\n\r\n",
            server.port()
        );
        stream.write_all(request.as_bytes()).unwrap();

        let mut res = String::new();
        stream.read_to_string(&mut res).unwrap();
        assert!(res.contains("HTTP/1.1 200 OK"));
        assert!(res.contains("updateAvailable"));
        assert!(res.contains("currentVersion"));
    }
}
