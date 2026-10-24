"""etl-service: HTTP-обёртка над ETL (только стандартная библиотека).

GET  /health                        — без токена: жив ли сервис и идёт ли загрузка
POST /internal/etl/load             — запустить загрузку (202; 409, если уже идёт)
GET  /internal/etl/status           — последний запуск из etl.load_run + флаг running
POST /internal/etl/demo-project     — добавить демо-проект для notifier
/internal/* требуют заголовок X-Internal-Token (сравнение за постоянное время).
"""
import hmac
import json
import logging
import os
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

log = logging.getLogger("etl.server")


def serve(url, connect, load_fn, demo_fn):
    port = int(os.environ.get("PORT", "8084"))
    token = os.environ.get("INTERNAL_TOKEN", "internal_dev_token")
    auto = os.environ.get("AUTO_LOAD", "if-empty")       # if-empty | always | never
    lock = threading.Lock()

    def start_load():
        if not lock.acquire(blocking=False):
            return False

        def run():
            try:
                load_fn(url)
            finally:
                lock.release()

        threading.Thread(target=run, daemon=True, name="etl-load").start()
        return True

    def last_run():
        with connect(url, autocommit=True) as c:
            row = c.execute("SELECT id, started_at, finished_at, status, details FROM etl.load_run "
                            "ORDER BY id DESC LIMIT 1").fetchone()
        if not row:
            return None
        return {"id": row[0], "startedAt": row[1].isoformat(), "status": row[3],
                "finishedAt": row[2].isoformat() if row[2] else None, "details": row[4]}

    def autostart():
        try:
            if auto == "never":
                return
            if auto == "if-empty":
                with connect(url, autocommit=True) as c:      # connect() ждёт БД с повторами
                    if c.execute("SELECT 1 FROM etl.load_run WHERE status = 'ok' LIMIT 1").fetchone():
                        log.info("успешная загрузка уже была — автозапуск пропущен (AUTO_LOAD=if-empty)")
                        return
            log.info("автозапуск загрузки (AUTO_LOAD=%s)", auto)
            start_load()
        except Exception:
            log.exception("автозапуск не удался")

    class Handler(BaseHTTPRequestHandler):
        def log_message(self, fmt, *args):
            log.info("%s %s", self.address_string(), fmt % args)

        def send(self, status, body):
            data = json.dumps(body, ensure_ascii=False).encode()
            self.send_response(status)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Content-Length", str(len(data)))
            self.end_headers()
            self.wfile.write(data)

        def err(self, status, code, message):
            self.send(status, {"error": {"code": code, "message": message}})

        def authorized(self):
            got = self.headers.get("X-Internal-Token", "")
            if hmac.compare_digest(got.encode(), token.encode()):
                return True
            self.err(401, "UNAUTHORIZED", "нужен заголовок X-Internal-Token")
            return False

        def do_GET(self):
            path = self.path.split("?")[0]
            if path == "/health":
                return self.send(200, {"status": "ok", "running": lock.locked()})
            if path == "/internal/etl/status":
                if not self.authorized():
                    return
                try:
                    return self.send(200, {"running": lock.locked(), "last": last_run()})
                except Exception as e:
                    log.exception("status")
                    return self.err(502, "UPSTREAM_UNAVAILABLE", f"БД недоступна: {e}")
            self.err(404, "NOT_FOUND", "нет такого пути")

        def do_POST(self):
            path = self.path.split("?")[0]
            if path == "/internal/etl/load":
                if not self.authorized():
                    return
                if not start_load():
                    return self.err(409, "CONFLICT", "загрузка уже идёт")
                return self.send(202, {"status": "started"})
            if path == "/internal/etl/demo-project":
                if not self.authorized():
                    return
                try:
                    res = demo_fn(url)
                except Exception as e:
                    log.exception("demo-project")
                    return self.err(500, "INTERNAL_ERROR", str(e))
                if res is None:
                    return self.err(409, "CONFLICT", "справочник районов пуст — сначала выполните загрузку")
                return self.send(201, {"projectId": res[0], "municipality": res[1]})
            self.err(404, "NOT_FOUND", "нет такого пути")

    threading.Thread(target=autostart, daemon=True, name="etl-autostart").start()
    log.info("etl-service слушает :%d", port)
    ThreadingHTTPServer(("0.0.0.0", port), Handler).serve_forever()
    return 0
