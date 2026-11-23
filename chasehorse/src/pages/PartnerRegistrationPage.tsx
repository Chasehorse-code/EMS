import { useParams } from 'react-router-dom';
import type { PartnerType } from '@chasehorse/domain';
import { LandingHeader } from '@/components/landing/LandingHeader';
import { PartnerRegistrationForm } from '@/components/partners/PartnerRegistrationForm';

export function PartnerRegistrationPage() {
  const { partnerType } = useParams<{ partnerType: string }>();

  // Normalize partner type key
  const normalizedType = (partnerType || 'onfield_professional').replace('-', '_') as PartnerType;

  return (
    <div>
      <LandingHeader />
      <PartnerRegistrationForm partnerType={normalizedType} />
    </div>
  );
}

