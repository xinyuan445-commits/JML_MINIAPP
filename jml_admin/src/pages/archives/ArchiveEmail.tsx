import { useAccess } from '@umijs/max';
import { App, Button, Input, Modal } from 'antd';
import React, { useState } from 'react';

const fields = [
  ['to_recipients', '收件人'],
  ['cc_recipients', '抄送人'],
  ['bcc_recipients', '密送人'],
] as const;
type Recipients = Record<(typeof fields)[number][0], string>;
type EmailConfig = Recipients & { revision: number; subject: string; body: string };
type Archive = 'archive-process' | 'archive-material-coding';
const api = '/api/admin/archive-email';

async function emailRequest<T>(url: string, body?: object) {
  const response = await fetch(url, body ? {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  } : undefined);
  const result = await response.json() as { code: number; msg?: string; data: T };
  if (!response.ok || result.code !== 0) throw new Error(result.msg || '操作失败，请重试');
  return result.data;
}

export default function ArchiveEmail({ archive, title }: { archive: Archive; title: string }) {
  const access = useAccess();
  const { message } = App.useApp();
  const [open, setOpen] = useState(false);
  const [config, setConfig] = useState<EmailConfig>();
  const [recipients, setRecipients] = useState<Recipients>();
  const [busy, setBusy] = useState<'load' | 'save' | 'send'>();
  const [error, setError] = useState('');
  if (!access.canReportEmailSettings || !access.can('report-email-settings.manage')) return null;

  const update = (data: EmailConfig) => {
    setConfig(data);
    setRecipients({ to_recipients: data.to_recipients, cc_recipients: data.cc_recipients, bcc_recipients: data.bcc_recipients });
  };

  const begin = async () => {
    setOpen(true);
    setConfig(undefined);
    setRecipients(undefined);
    setError('');
    setBusy('load');
    try {
      update(await emailRequest<EmailConfig>(`${api}?archive=${archive}`));
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : '邮件配置读取失败');
    } finally {
      setBusy(undefined);
    }
  };

  const dirty = config && recipients && fields.some(([field]) => config[field] !== recipients[field]);
  const apply = async (send: boolean) => {
    if (!config || !recipients || busy || (send && !recipients.to_recipients.trim())) return;
    setError('');
    setBusy(send ? 'send' : 'save');
    try {
      let saved = config;
      if (dirty) {
        saved = await emailRequest<EmailConfig>(`${api}/save`, { archive, revision: config.revision, ...recipients });
        update(saved);
      }
      if (send) {
        await emailRequest(`${api}/send`, { archive, revision: saved.revision });
        message.success('档案邮件已发送');
        setOpen(false);
      } else {
        message.success('收件人已保存');
      }
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : '操作失败，请重试');
    } finally {
      setBusy(undefined);
    }
  };

  return <>
    <Button onClick={() => void begin()}>邮件发送</Button>
    <Modal open={open} title={`${title} · 邮件发送`} width={640} loading={busy === 'load'}
      onCancel={() => { if (!busy) setOpen(false); }} footer={[
        <Button key="save" disabled={!dirty || Boolean(busy)} loading={busy === 'save'}
          onClick={() => void apply(false)}>保存收件人</Button>,
        <Button key="send" type="primary" disabled={!recipients?.to_recipients.trim() || Boolean(busy)}
          loading={busy === 'send'} onClick={() => void apply(true)}>发送邮件</Button>,
      ]}>
      {config && recipients && <>
        {fields.map(([field, label]) => <label key={field} style={{ display: 'grid', gap: 4, marginBottom: 10 }}>
          {label}
          <Input.TextArea rows={2} maxLength={4000} value={recipients[field]} disabled={Boolean(busy)}
            placeholder="多个邮箱用分号或换行分隔"
            onChange={(event) => setRecipients({ ...recipients, [field]: event.target.value })} />
        </label>)}
        <div style={{ display: 'grid', gap: 6, marginTop: 16 }}>
          <strong>{config.subject}</strong>
          <div style={{ whiteSpace: 'pre-wrap' }}>{config.body}</div>
          <div>附件 · {title}（Excel）</div>
        </div>
      </>}
      {error && <p role="alert">{error}</p>}
    </Modal>
  </>;
}
