import { Link, useLocation } from '@umijs/max';
import { Button, Space } from 'antd';
import { createStyles } from 'antd-style';
import React, { useState } from 'react';
import { MATERIAL_CODING_PATH } from '@/utils/adminPermissions';
import ArchiveEmail from '../ArchiveEmail';
import AccessoryProducts from './accessory-products';
import MaterialCodingCategory from './category';
import MaterialCodingCover from './cover';
import ProductModels from './product-models';
import SupplierAbbreviations from './supplier-abbreviations';

const sections = [
  { key: 'cover', title: 'Cover Page' },
  { key: 'samples', title: '打样成品及半成品' },
  { key: 'finished-accessories', title: '成品（配套辅料）' },
  { key: 'finished', title: '成品' },
  { key: 'veneer-finished', title: '木皮成品' },
  { key: 'grooved-finished', title: '开槽成品' },
  { key: 'semi-finished', title: '半成品' },
  { key: 'semi-finished-accessories', title: '半成品（配套辅料）' },
  { key: 'veneer-semi-finished', title: '木皮半成品' },
  { key: 'balancing-veneer', title: '平衡皮' },
  { key: 'primary-materials', title: '一阶原材料' },
  { key: 'secondary-materials', title: '二阶原材料' },
  { key: 'fixed-assets', title: '固定资产' },
  { key: 'product-models', title: '产品型号明细' },
  { key: 'supplier-abbreviations', title: '供应商简称明细' },
  { key: 'veneer-design', title: '木皮饰板设计部编码规则' },
  { key: 'accessory-products', title: '辅料产品明细' },
] as const;

const detailPages: Partial<Record<(typeof sections)[number]['key'], React.ComponentType>> = {
  cover: MaterialCodingCover,
  'product-models': ProductModels,
  'supplier-abbreviations': SupplierAbbreviations,
  'accessory-products': AccessoryProducts,
};

const rulePages = new Set([
  'samples', 'finished-accessories', 'finished', 'veneer-finished', 'grooved-finished',
  'semi-finished', 'semi-finished-accessories', 'veneer-semi-finished', 'balancing-veneer',
  'primary-materials', 'secondary-materials', 'fixed-assets',
  'veneer-design',
]);

const useStyles = createStyles(({ token, css }) => ({
  header: css`
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    margin-bottom: 16px;
  `,
  title: css`
    margin: 0;
    font-size: ${token.fontSizeHeading4}px;
    font-weight: 600;
  `,
  layout: css`
    display: grid;
    grid-template-columns: 224px minmax(0, 1fr);
    align-items: start;
    gap: 16px;
    @media (max-width: 700px) { grid-template-columns: minmax(0, 1fr); }
  `,
  directory: css`
    display: grid;
    gap: 2px;
    padding: 8px;
    border: 1px solid ${token.colorBorderSecondary};
    border-radius: ${token.borderRadiusLG}px;
    background: ${token.colorBgContainer};
    a {
      padding: 7px 12px;
      border-radius: ${token.borderRadius}px;
      color: ${token.colorText};
    }
    a:hover { background: ${token.colorFillQuaternary}; }
    a[aria-current='page'] {
      background: ${token.colorPrimaryBg};
      color: ${token.colorPrimaryText};
      font-weight: 600;
    }
    @media (max-width: 700px) {
      display: flex;
      overflow-x: auto;
      a { flex: none; }
    }
  `,
  document: css`
    min-height: 320px;
    padding: clamp(16px, 2.5vw, 32px);
    border: 1px solid ${token.colorBorderSecondary};
    border-radius: ${token.borderRadiusLG}px;
    background: ${token.colorBgContainer};
    h2 {
      margin: 0 0 16px;
      color: ${token.colorTextHeading};
      font-size: ${token.fontSizeHeading3}px;
    }
    p { margin: 0; color: ${token.colorTextSecondary}; }
  `,
}));

export default function MaterialCodingArchive() {
  const { search } = useLocation();
  const { styles } = useStyles();
  const page = new URLSearchParams(search).get('page');
  const current = sections.find(({ key }) => key === page) ?? sections[0];
  const DetailPage = detailPages[current.key];
  const [exporting, setExporting] = useState(false);
  const [exportFailed, setExportFailed] = useState(false);

  const download = async () => {
    setExporting(true);
    setExportFailed(false);
    try {
      const response = await fetch('/api/admin/material-coding/export');
      if (!response.ok) throw new Error('Export failed');
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement('a');
      link.href = url;
      link.download = '物料编码规则.xlsx';
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 10000);
    } catch {
      setExportFailed(true);
    } finally {
      setExporting(false);
    }
  };

  return (
    <section aria-labelledby="material-coding-title">
      <header className={styles.header}>
        <h1 className={styles.title} id="material-coding-title">物料编码规则</h1>
        <Space>
          <Button loading={exporting} onClick={download}>导出 Excel</Button>
          <ArchiveEmail archive="archive-material-coding" title="物料编码规则" />
        </Space>
      </header>
      {exportFailed && <p role="alert">导出失败，请重试</p>}
      <div className={styles.layout}>
        <nav aria-label="物料编码规则目录" className={styles.directory}>
          {sections.map(({ key, title }) => (
            <Link
              key={key}
              to={key === 'cover' ? MATERIAL_CODING_PATH : `${MATERIAL_CODING_PATH}?page=${key}`}
              aria-current={key === current.key ? 'page' : undefined}
            >
              {title}
            </Link>
          ))}
        </nav>
        <section aria-labelledby="material-coding-section" className={styles.document}>
          {DetailPage ? <DetailPage /> : rulePages.has(current.key) ? (
            <MaterialCodingCategory key={current.key} pageKey={current.key} title={current.title} />
          ) : (
            <>
              <h2 id="material-coding-section">{current.title}</h2>
              <p>暂无内容</p>
            </>
          )}
        </section>
      </div>
    </section>
  );
}
