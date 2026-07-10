import os

from app import create_app

app = create_app()

if __name__ == "__main__":
    # Flask binds 127.0.0.1 by default, which a phone on the same Wi-Fi cannot reach.
    # The app rewrites `localhost` to this machine's LAN address (see
    # frontend/src/lib/api.ts), but with a loopback bind nothing is listening there.
    # Device testing therefore needs:
    #
    #     FLASK_RUN_HOST=0.0.0.0 python run.py
    #
    # Loopback stays the default on purpose: binding every interface exposes an
    # unauthenticated DEBUG server to the whole network. That should be a deliberate
    # keystroke, not a default.
    host = os.getenv("FLASK_RUN_HOST", "127.0.0.1")
    port = int(os.getenv("FLASK_RUN_PORT", "5000"))
    app.run(host=host, port=port)
