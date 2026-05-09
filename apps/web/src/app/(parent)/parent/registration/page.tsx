import '../../../registration/registration.css';
import { RegistrationForm } from '../../../registration/registration-form';
import { SiblingAddModalButton } from './sibling-add-modal';

export const dynamic = 'force-dynamic';

export default function ParentRegistrationPage() {
  return (
    <div className="registration-page">
      <div className="page-header">
        <div>
          <p>Parent registration</p>
          <h1>Registration details</h1>
          <p>Review and keep the household, contact, consent, and child records current.</p>
        </div>
        <SiblingAddModalButton />
      </div>
      <RegistrationForm mode="edit" />
    </div>
  );
}
