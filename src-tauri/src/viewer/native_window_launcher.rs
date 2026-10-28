use std::process::{Command, ExitStatus};

pub struct NativeWindowLauncher;

impl NativeWindowLauncher {
    pub fn launch(url: &str) -> Result<ExitStatus, std::io::Error> {
        if cfg!(target_os = "macos") {
            return Self::launch_macos(url);
        }

        Self::launch_linux_gtk(url)
    }

    fn launch_macos(url: &str) -> Result<ExitStatus, std::io::Error> {
        let candidates = [
            "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
            "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser",
            "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
        ];

        for browser in candidates {
            if std::path::Path::new(browser).exists() {
                let app_arg = format!("--app={}", url);
                let mut child = Command::new(browser)
                    .args([&app_arg, "--new-window"])
                    .spawn()?;
                return child.wait();
            }
        }

        let _ = Command::new("open").arg(url).status()?;
        loop {
            std::thread::sleep(std::time::Duration::from_secs(3600));
        }
    }

    fn launch_linux_gtk(url: &str) -> Result<ExitStatus, std::io::Error> {
        let python_script = r#"
import sys
import subprocess

try:
    import gi
    gi.require_version('Gtk', '3.0')
    gi.require_version('WebKit2', '4.1')
    from gi.repository import Gtk, WebKit2
except Exception:
    import subprocess
    subprocess.run(['xdg-open', sys.argv[1]])
    sys.exit(0)

def detect_dark_mode():
    try:
        res = subprocess.run(['gsettings', 'get', 'org.gnome.desktop.interface', 'color-scheme'], capture_output=True, text=True)
        val = res.stdout.strip().lower()
        if 'prefer-dark' in val or 'dark' in val:
            return True
        res_theme = subprocess.run(['gsettings', 'get', 'org.gnome.desktop.interface', 'gtk-theme'], capture_output=True, text=True)
        if 'dark' in res_theme.stdout.strip().lower():
            return True
    except Exception:
        pass
    return False

class ParchWindow(Gtk.Window):
    def __init__(self, target_url):
        super().__init__(title="Parch")
        self.set_default_size(1100, 800)
        self.set_position(Gtk.WindowPosition.CENTER)
        self.connect("destroy", Gtk.main_quit)

        if detect_dark_mode():
            gtk_settings = Gtk.Settings.get_default()
            if gtk_settings:
                gtk_settings.set_property("gtk-application-prefer-dark-theme", True)

        settings = WebKit2.Settings()
        settings.set_enable_developer_extras(False)
        settings.set_enable_smooth_scrolling(True)
        settings.set_hardware_acceleration_policy(WebKit2.HardwareAccelerationPolicy.ALWAYS)

        self.webview = WebKit2.WebView.new_with_settings(settings)
        self.webview.load_uri(target_url)

        scrolled = Gtk.ScrolledWindow()
        scrolled.add(self.webview)
        self.add(scrolled)
        self.show_all()

if __name__ == '__main__':
    url_arg = sys.argv[1] if len(sys.argv) > 1 else 'http://127.0.0.1:1420'
    win = ParchWindow(url_arg)
    Gtk.main()
"#;

        Command::new("python3")
            .arg("-c")
            .arg(python_script)
            .arg(url)
            .status()
    }
}
