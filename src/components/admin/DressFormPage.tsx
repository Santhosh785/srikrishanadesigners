import AdminShell from './AdminShell';
import DressForm from './DressForm';

export default function DressFormPage({ mode }: { mode: 'create' | 'edit' }) {
  return (
    <AdminShell>
      <DressForm mode={mode} />
    </AdminShell>
  );
}
