import { Popover } from 'antd';
import {
  Children,
  type ComponentPropsWithoutRef,
  isValidElement,
  useRef,
  useState,
} from 'react';

export default function TaskCard({
  children,
  detailTitle,
  detailSubtitle,
  ...props
}: ComponentPropsWithoutRef<'article'> & {
  detailTitle?: string;
  detailSubtitle?: string;
}) {
  const [open, setOpen] = useState(false);
  const dragging = useRef(false);
  const parts = Children.toArray(children);
  const isDetail = (child: (typeof parts)[number]) =>
    isValidElement<Record<string, unknown>>(child) &&
    child.props['data-task-detail'] !== undefined;
  return (
    <Popover
      trigger={['hover', 'click', 'focus']}
      placement="rightTop"
      autoAdjustOverflow
      mouseEnterDelay={0.15}
      mouseLeaveDelay={0.2}
      getPopupContainer={() => document.body}
      destroyOnHidden
      open={open}
      onOpenChange={(next) => {
        if (!dragging.current) setOpen(next);
      }}
      content={
        <section
          aria-label="任务详情浮窗"
          className={props.className}
          data-expanded="true"
          onClick={(event) => {
            if (
              (event.target as HTMLElement).closest('[data-close-task-popup]')
            )
              setOpen(false);
          }}
          style={{
            width: 'min(360px, calc(100vw - 48px))',
            maxHeight: '70vh',
            overflowY: 'auto',
            margin: 0,
          }}
          onKeyDown={(event) => {
            if (event.key === 'Escape') setOpen(false);
          }}
        >
          {detailTitle && (
            <header
              style={{
                position: 'sticky',
                top: 0,
                zIndex: 1,
                background: 'var(--ant-color-bg-container, #fff)',
                paddingBottom: 10,
                marginBottom: 10,
                borderBottom:
                  '1px solid var(--ant-color-border-secondary, #e5e7eb)',
              }}
            >
              <strong style={{ display: 'block', fontSize: 14 }}>
                {detailTitle}
              </strong>
              <div
                style={{
                  marginTop: 4,
                  fontSize: 12,
                  color: 'var(--ant-color-primary, #1d4ed8)',
                }}
              >
                {detailSubtitle}
              </div>
            </header>
          )}
          {parts.filter(isDetail)}
        </section>
      }
    >
      <article
        {...props}
        data-expanded="false"
        onDoubleClick={(event) => {
          setOpen(false);
          props.onDoubleClick?.(event);
        }}
        onKeyDown={(event) => {
          if (event.key === 'Escape') setOpen(false);
          props.onKeyDown?.(event);
        }}
        onDragStart={(event) => {
          dragging.current = true;
          setOpen(false);
          props.onDragStart?.(event);
        }}
        onDragEnd={(event) => {
          dragging.current = false;
          props.onDragEnd?.(event);
        }}
      >
        <button
          type="button"
          data-task-toggle
          aria-label="查看任务详情"
          aria-expanded={open}
        >
          详情
        </button>
        {parts.filter((child) => !isDetail(child))}
      </article>
    </Popover>
  );
}
