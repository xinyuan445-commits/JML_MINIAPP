export const APPROVAL_NOTIFICATION_EVENT = 'jml-approval-notification-change';

export function announceApprovalChange() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(APPROVAL_NOTIFICATION_EVENT));
  }
}
