import AdminShell from './AdminShell';
import QuoteInbox from './QuoteInbox';

export default function QuoteInboxPage() {
  return (
    <AdminShell title="Quote requests">
      <QuoteInbox />
    </AdminShell>
  );
}
