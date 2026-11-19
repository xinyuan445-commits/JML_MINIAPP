import { request } from '@umijs/max';
import { App, Button, Image, Upload } from 'antd';
import React, { useState } from 'react';

const imageApi = '/api/admin/material-coding/product-image';

export function productImageUrl(collection: string, filename: string, version?: number) {
  const query = new URLSearchParams({ collection, file: filename });
  if (version !== undefined) query.set('v', String(version));
  return `${imageApi}?${query}`;
}

export function CodingProductImages({ collection, files, label, versions }: {
  collection: string;
  files: string[];
  label: string;
  versions?: Record<string, number>;
}) {
  const originals = files.map((filename) => productImageUrl(collection, filename, versions?.[filename]));
  return <>
    <Image.PreviewGroup items={originals}>
      <Image src={`${originals[0]}&size=thumbnail`} width={62} height={44} loading="lazy"
        style={{ objectFit: 'contain' }} alt={label} preview={{ src: originals[0], cover: '查看' }} />
    </Image.PreviewGroup>
    {files.length > 1 && <div>{files.length} 张</div>}
  </>;
}

export function ImageUploadButton<Data>({ endpoint, fields, children, label, onUploaded, onBusy, disabled, link }: {
  endpoint: 'product-image' | 'veneer-image' | 'accessory-drawing';
  fields: Record<string, string>;
  children: React.ReactNode;
  label?: string;
  onUploaded: (data: Data) => void;
  onBusy?: (busy: boolean) => void;
  disabled?: boolean;
  link?: boolean;
}) {
  const { message } = App.useApp();
  const [busy, setBusy] = useState(false);
  const upload = async (file: File) => {
    if (file.size > 32 * 1024 * 1024) {
      message.error('单张图片不能超过 32 MB');
      return;
    }
    const form = new FormData();
    form.append('image', file);
    Object.entries(fields).forEach(([key, value]) => { form.append(key, value); });
    setBusy(true);
    onBusy?.(true);
    try {
      const { data } = await request<{ data: Data }>(`/api/admin/material-coding/${endpoint}/upload`, {
        method: 'POST', data: form, skipErrorHandler: true,
      });
      onUploaded(data);
      message.success('图片已保存');
    } catch (failure) {
      const response = (failure as { response?: { data?: { message?: string } } }).response;
      message.error(response?.data?.message || '图片上传失败，请重试');
    } finally {
      setBusy(false);
      onBusy?.(false);
    }
  };

  return <Upload accept=".jpg,.jpeg,.png,.webp" showUploadList={false} disabled={disabled || busy}
    beforeUpload={(file) => { void upload(file); return Upload.LIST_IGNORE; }}>
    <Button aria-label={label} size="small" type={link ? 'link' : 'default'} loading={busy}
      disabled={disabled}>{children}</Button>
  </Upload>;
}
