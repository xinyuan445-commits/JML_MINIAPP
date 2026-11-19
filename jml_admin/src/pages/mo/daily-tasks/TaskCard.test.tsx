import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from '@testing-library/react';
import React from 'react';
import TaskCard from './TaskCard';

beforeAll(() => Object.assign(globalThis, { React }));
beforeEach(() => jest.useFakeTimers());
afterEach(() => {
  cleanup();
  jest.useRealTimers();
});
const content = (value = '产品明细') => [
  React.createElement('h4', { key: 'title' }, '工单第1行'),
  React.createElement(
    'section',
    { key: 'summary', 'data-task-summary': true },
    '安排30 能做20 等待10',
  ),
  React.createElement('p', { key: 'detail', 'data-task-detail': true }, value),
];

test('hover opens details outside the compact card without changing its content', () => {
  const heading = {
    detailTitle: 'SCDD26103125 · 第2行',
    detailSubtitle: '4. 防火板脱胶',
  };
  const view = render(React.createElement(TaskCard, heading, content()));
  const card = screen.getByRole('article');
  const before = card.innerHTML;
  fireEvent.mouseEnter(card);
  act(() => {
    jest.advanceTimersByTime(200);
  });
  const popup = screen.getByRole('region', { name: '任务详情浮窗' });
  expect(card.contains(popup)).toBe(false);
  expect(within(card).queryByText('产品明细')).toBeNull();
  expect(within(popup).getByText('产品明细')).toBeTruthy();
  expect(popup.firstElementChild?.tagName).toBe('HEADER');
  expect(within(popup).getByText(heading.detailTitle)).toBeTruthy();
  expect(within(popup).getByText(heading.detailSubtitle)).toBeTruthy();
  expect(card.getAttribute('data-expanded')).toBe('false');
  expect(card.textContent).toContain('安排30');
  expect(
    card.innerHTML.replace('aria-expanded="true"', 'aria-expanded="false"'),
  ).toBe(before);
  view.rerender(
    React.createElement(TaskCard, heading, content('更新后的明细')),
  );
  expect(within(popup).getByText('更新后的明细')).toBeTruthy();
});

test('details button and actions work; drag closes popup while double-click remains available', () => {
  const edit = jest.fn();
  const drag = jest.fn();
  const action = jest.fn();
  render(
    React.createElement(
      TaskCard,
      { onDoubleClick: edit, onDragStart: drag, draggable: true },
      ...content(),
      React.createElement(
        'div',
        { 'data-task-detail': true },
        React.createElement(
          'button',
          { type: 'button', onClick: action },
          '执行操作',
        ),
      ),
    ),
  );
  const card = screen.getByRole('article');
  fireEvent.click(screen.getByRole('button', { name: '查看任务详情' }));
  act(() => {
    jest.advanceTimersByTime(200);
  });
  fireEvent.click(screen.getByRole('button', { name: '执行操作' }));
  expect(action).toHaveBeenCalledTimes(1);
  fireEvent.doubleClick(card);
  expect(edit).toHaveBeenCalledTimes(1);
  fireEvent.dragStart(card);
  act(() => {
    jest.advanceTimersByTime(1000);
  });
  expect(drag).toHaveBeenCalledTimes(1);
  expect(screen.queryByRole('region', { name: '任务详情浮窗' })).toBeNull();
});
