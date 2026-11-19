"""Run once, or keep running every minute without any web requests."""
import argparse
import logging
import time
from station_proxies import cleanup_expired


def main():
    parser = argparse.ArgumentParser(description="清理已到期的工站代理，不修改负责人权限")
    parser.add_argument("--loop", action="store_true", help="每分钟执行，供服务管理器托管")
    args = parser.parse_args()
    while True:
        connection = None
        try:
            from app import db
            connection = db()
            removed = cleanup_expired(connection)
            if removed:
                logging.warning("Removed %d expired station proxies", removed)
        except Exception:
            if not args.loop:
                raise
            # Do not echo connection details or credentials.
            logging.error("Station proxy cleanup failed; retry in one minute")
        finally:
            if connection:
                connection.close()
        if not args.loop:
            return
        time.sleep(60)


if __name__ == "__main__":
    main()
