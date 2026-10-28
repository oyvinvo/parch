use parch_core::cli::cli_argument_parser::{CliAction, CliArgumentParser};
use parch_core::cli::self_update_service::SelfUpdateService;
use parch_core::document::document_models::DocumentError;
use parch_core::document::fs_document_reader::FsDocumentReader;
use parch_core::viewer::viewer_launcher::ViewerLauncher;
use std::env;
use std::process;

fn main() {
    let args: Vec<String> = env::args().collect();
    let parser = CliArgumentParser::new();

    match parser.parse(&args[1..]) {
        Ok(CliAction::DisplayHelp) => {
            println!("{}", CliArgumentParser::help_text());
            process::exit(0);
        }
        Ok(CliAction::DisplayVersion) => {
            println!("parch {}", env!("CARGO_PKG_VERSION"));
            process::exit(0);
        }
        Ok(CliAction::SelfUpdate) => {
            match SelfUpdateService::run_self_update(env!("CARGO_PKG_VERSION")) {
                Ok(msg) => {
                    println!("{}", msg);
                    process::exit(0);
                }
                Err(err) => {
                    eprintln!("Error during self-update: {}", err);
                    process::exit(1);
                }
            }
        }
        Ok(action @ (CliAction::OpenFile { .. } | CliAction::EmptyState)) => {
            if CliArgumentParser::is_headless(&args[1..]) {
                handle_headless_mode(action);
            } else {
                ViewerLauncher::run(action);
            }
        }
        Err(err) => {
            eprintln!("Error: {}", err);
            process::exit(err.exit_code());
        }
    }
}

fn handle_headless_mode(action: CliAction) {
    if let CliAction::OpenFile { path, .. } = action {
        let reader = FsDocumentReader::new();
        match reader.read_document(&path) {
            Ok(_) => process::exit(0),
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
    } else {
        process::exit(0);
    }
}
