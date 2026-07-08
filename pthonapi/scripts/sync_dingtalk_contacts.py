import os
import sys


PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

from services.dingtalk_sync import sync_contacts  # noqa: E402


if __name__ == "__main__":
    try:
        result = sync_contacts("cron")
        print(
            "钉钉通讯录同步成功："
            f"部门 {result['department_count']}，用户 {result['user_count']}，"
            f"停用部门 {result['disabled_depts']}，停用用户 {result['disabled_users']}"
        )
    except Exception as exc:
        print(f"钉钉通讯录同步失败：{exc}", file=sys.stderr)
        raise SystemExit(1)

