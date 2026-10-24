"""
Текущий 6-значный код 2FA (TOTP, RFC 6238) — для тестирования входа без телефона (docs/tz/13-testing.md).

    python tools/qa/totp.py                    # демо demo@rt.ru, секрет JBSWY3DPEHPK3PXP
    python tools/qa/totp.py --admin            # admin@rt.ru: секрет берётся из БД (после привязки QR)
    python tools/qa/totp.py --secret BASE32    # любой секрет

Код живёт 30 секунд; если до смены меньше 5 с — скрипт дожидается нового. Только стандартная библиотека.
"""
import base64
import hashlib
import hmac
import struct
import subprocess
import sys
import time

DEMO_SECRET = "JBSWY3DPEHPK3PXP"


def admin_secret():
    out = subprocess.run(
        ["docker", "exec", "radar-postgres", "psql", "-U", "postgres", "-d", "radar", "-At", "-c",
         "select totp_secret from auth.users where email = 'admin@rt.ru'"],
        capture_output=True, text=True, check=True).stdout.strip()
    if not out:
        sys.exit("У admin@rt.ru ещё нет секрета: сначала войдите паролем — появится QR, секрет сохранится")
    return out


def totp(secret, at):
    key = base64.b32decode(secret.upper() + "=" * (-len(secret) % 8))
    digest = hmac.new(key, struct.pack(">Q", int(at) // 30), hashlib.sha1).digest()
    offset = digest[-1] & 15
    return "%06d" % ((struct.unpack(">I", digest[offset:offset + 4])[0] & 0x7FFFFFFF) % 1_000_000)


def main(args):
    secret = DEMO_SECRET
    if "--admin" in args:
        secret = admin_secret()
    elif "--secret" in args:
        secret = args[args.index("--secret") + 1]
    now = time.time()
    if 30 - now % 30 < 5:                      # не отдавать код, который вот-вот сменится
        time.sleep(30 - now % 30 + 0.5)
        now = time.time()
    print(totp(secret, now))


if __name__ == "__main__":
    main(sys.argv[1:])
