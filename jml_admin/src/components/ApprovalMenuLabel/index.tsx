import { request } from '@umijs/max';
import { Badge } from 'antd';
import type { ReactNode } from 'react';
import { useCallback, useEffect, useState } from 'react';
import { APPROVAL_NOTIFICATION_EVENT } from '@/utils/approvalNotifications';

type NotificationCounts = { todo: number; result: number; total: number };

export default function ApprovalMenuLabel({ children }: { children: ReactNode }) {
  const [counts, setCounts] = useState<NotificationCounts>({ todo: 0, result: 0, total: 0 });
  const load = useCallback(async () => {
    try {
      const response = await request<{ code: number; data: NotificationCounts }>(
        '/api/admin/config-approvals/notifications',
        { skipErrorHandler: true },
      );
      if (response.code === 0) setCounts(response.data);
    } catch {
      // 菜单角标加载失败不影响页面使用。
    }
  }, []);

  useEffect(() => {
    load();
    const timer = window.setInterval(load, 30000);
    window.addEventListener(APPROVAL_NOTIFICATION_EVENT, load);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener(APPROVAL_NOTIFICATION_EVENT, load);
    };
  }, [load]);

  const title = `待审批 ${counts.todo} 条，审批结果 ${counts.result} 条`;
  return (
    <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, width: '100%' }}>
      <span>{children}</span>
      <Badge count={counts.total} overflowCount={99} size="small" title={title} />
    </span>
  );
}
