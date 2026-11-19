import { Input, Modal, Select } from 'antd';
import { useEffect, useState } from 'react';
import type { NonorderEdit } from './nonorderDraft';
import { getSheetWorkPeople, type NonorderStaff } from './nonorderService';

export default function NonorderWorkEditor({
  row,
  onSave,
  onClose,
}: {
  row: NonorderEdit;
  onSave: (edit: NonorderEdit) => void;
  onClose: () => void;
}) {
  const { division, assignment } = row.person;
  const initial = row.work_edit;
  const [content, setContent] = useState(initial?.content ?? division.content);
  const [staff, setStaff] = useState(initial?.staff_id ?? assignment.staff_id);
  const [responsibility, setResponsibility] = useState(initial?.responsibility ?? assignment.responsibility);
  const [people, setPeople] = useState<NonorderStaff[]>();
  const [error, setError] = useState('');

  useEffect(() => {
    let current = true;
    getSheetWorkPeople(assignment.id).then(
      (options) => { if (current) setPeople(options); },
      () => { if (current) setError('执行人员读取失败，请关闭后重试'); },
    );
    return () => { current = false; };
  }, [assignment.id]);

  const options = new Map([[assignment.staff_id, assignment.staff_name]]);
  for (const person of people || []) options.set(person.id, person.name);
  if (initial && !options.has(initial.staff_id)) options.set(initial.staff_id, initial.staff_name);
  const change = content.trim() !== division.content || staff !== assignment.staff_id ||
    responsibility.trim() !== assignment.responsibility;

  return (
    <Modal
      open
      title="修改无工单安排"
      okText="暂存修改"
      cancelText="取消"
      onCancel={onClose}
      okButtonProps={{
        disabled: !people || !content.trim() || !responsibility.trim() || (!change && !initial),
      }}
      onOk={() => onSave({
        ...row,
        work_edit: change ? {
          request_id: `work-${Date.now()}-${Math.random().toString(36).slice(2)}`,
          content: content.trim() === division.content ? undefined : content.trim(),
          staff_id: staff,
          staff_name: options.get(staff) || staff,
          responsibility: responsibility.trim(),
        } : undefined,
      })}
    >
      <div style={{ display: 'grid', gap: 8 }}>
        <label htmlFor="nonorder-work-content">工作项</label>
        <Input.TextArea id="nonorder-work-content" value={content} rows={3} maxLength={5000}
          onChange={(event) => setContent(event.target.value)} />
        <label htmlFor="nonorder-work-staff">执行人员</label>
        <Select id="nonorder-work-staff" value={staff} loading={!people && !error} disabled={!people}
          options={[...options].map(([value, label]) => ({ value, label }))}
          showSearch={{ optionFilterProp: 'label' }} onChange={setStaff} />
        <label htmlFor="nonorder-work-responsibility">个人职责</label>
        <Input.TextArea id="nonorder-work-responsibility" value={responsibility} rows={3} maxLength={5000}
          onChange={(event) => setResponsibility(event.target.value)} />
        {error && <div role="alert">{error}</div>}
      </div>
    </Modal>
  );
}
