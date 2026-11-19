import { request, useAccess } from '@umijs/max';
import { Button, Image } from 'antd';
import { createStyles } from 'antd-style';
import React, { useEffect, useState } from 'react';
import { ImageUploadButton, productImageUrl } from './product-images';

type ProductModel = { code: string; name: string; filename: string };
type ProductCollection = { key: string; title: string; models: ProductModel[]; available: boolean };

const useStyles = createStyles(({ token, css }) => ({
  switches: css`
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-bottom: 16px;
    align-items: center;
  `,
  gallery: css`
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(min(100%, 184px), 1fr));
    gap: 14px;
  `,
  card: css`
    margin: 0;
    border: 1px solid ${token.colorBorderSecondary};
    border-radius: ${token.borderRadiusLG}px;
    overflow: hidden;
    background: ${token.colorBgContainer};
  `,
  preview: css`
    width: 100%;
    aspect-ratio: 4 / 3;
    background: ${token.colorFillQuaternary};
  `,
  caption: css`
    display: grid;
    gap: 4px;
    padding: 10px 12px;
    overflow-wrap: anywhere;
    color: ${token.colorText};
    strong { font-family: ${token.fontFamilyCode}; }
  `,
}));

export default function ProductModels() {
  const { styles } = useStyles();
  const canEdit = useAccess().can('material-coding.edit');
  const [collections, setCollections] = useState<ProductCollection[]>();
  const [selected, setSelected] = useState('');
  const [loadFailed, setLoadFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [versions, setVersions] = useState<Record<string, number>>({});

  useEffect(() => {
    let current = true;
    request<{ data: ProductCollection[] }>('/api/admin/material-coding/product-models', { skipErrorHandler: true })
      .then(({ data }) => { if (current) setCollections(data); })
      .catch(() => { if (current) setLoadFailed(true); });
    return () => { current = false; };
  }, [attempt]);

  const collection = collections?.find(({ key }) => key === selected) ?? collections?.[0];
  return <>
    <h2 id="material-coding-section">产品型号明细</h2>
    {loadFailed && <div role="alert">产品型号读取失败 <Button onClick={() => {
      setLoadFailed(false);
      setAttempt((value) => value + 1);
    }}>重试</Button></div>}
    {!collections && !loadFailed && <p role="status">正在读取产品图片…</p>}
    {collections && collection && <>
      <div className={styles.switches} role="group" aria-label="产品图片分类">
        {collections.map(({ key, title }) => <Button key={key}
          type={collection.key === key ? 'primary' : 'default'}
          aria-pressed={collection.key === key} onClick={() => setSelected(key)}>{title}</Button>)}
        {canEdit && <ImageUploadButton endpoint="product-image" fields={{ collection: collection.key }}
          onUploaded={() => {
            setLoadFailed(false);
            setAttempt((value) => value + 1);
          }}>上传图片</ImageUploadButton>}
      </div>
      {collection.models.length > 0 ? (
        <section className={styles.gallery} aria-label={collection.title}>
          {collection.models.map((model) => {
            const imageKey = `${collection.key}:${model.filename}`;
            const original = productImageUrl(collection.key, model.filename, versions[imageKey]);
            return <figure key={model.filename} className={styles.card}>
              <div className={styles.preview}>
                <Image src={`${original}&size=thumbnail`} width="100%" height="100%" loading="lazy"
                  style={{ objectFit: 'contain' }} alt={[model.code, model.name].filter(Boolean).join(' ')}
                  preview={{ src: original, cover: '查看原图' }} />
              </div>
              <figcaption className={styles.caption} title={model.filename}>
                {model.code && <strong>{model.code}</strong>}
                {model.name && <span>{model.name}</span>}
                {canEdit && <div><ImageUploadButton endpoint="product-image" link
                  label={`更换 ${model.code || model.name} 图片`}
                  fields={{ collection: collection.key, replace: model.filename }}
                  onUploaded={() => setVersions((current) => ({ ...current, [imageKey]: Date.now() }))}>
                  更换图片
                </ImageUploadButton></div>}
              </figcaption>
            </figure>;
          })}
        </section>
      ) : <p role="status">{collection.available ? '暂无产品图片' : '图片目录暂不可用'}</p>}
    </>}
  </>;
}
