"""
One command Kodro demo. Serves the offline web app on a fixed default port and
opens the browser straight to it, so anyone can run the studio and see it work.

  python scripts/demo.py            # serves on http://localhost:8080
  KODRO_PORT=3000 python scripts/demo.py

No build step, no network: the app is pre-compiled into bundle.js. If the
default port is busy it walks forward to the next free one and prints the URL.
"""
import functools
import http.server
import os
import socketserver
import sys
import threading
import webbrowser

DEFAULT_PORT = int(os.environ.get("KODRO_PORT", "8080"))
WEB = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "src", "robolearn", "assets", "web"))


class Quiet(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a):  # keep the console clean
        pass


class Server(socketserver.TCPServer):
    allow_reuse_address = True


def find_port(start):
    import socket
    for p in range(start, start + 20):
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            if s.connect_ex(("127.0.0.1", p)) != 0:
                return p
    return start


def main():
    if not os.path.exists(os.path.join(WEB, "index.html")):
        print("[Kodro] cannot find the web app at", WEB)
        sys.exit(1)
    if not os.path.exists(os.path.join(WEB, "bundle.js")):
        print("[Kodro] bundle.js missing. Build it once: node scripts/build_web.cjs")
        sys.exit(1)
    port = find_port(DEFAULT_PORT)
    url = "http://localhost:%d/index.html" % port
    handler = functools.partial(Quiet, directory=WEB)
    print("=" * 56)
    print("  Kodro is running. Open it here:")
    print("    " + url)
    print("  Press Ctrl+C to stop.")
    print("=" * 56)
    threading.Timer(1.2, lambda: webbrowser.open(url)).start()
    with Server(("127.0.0.1", port), handler) as httpd:
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\n[Kodro] stopped.")


if __name__ == "__main__":
    main()
