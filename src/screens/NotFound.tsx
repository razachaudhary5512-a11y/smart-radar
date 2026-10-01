import { Link } from 'react-router-dom';
import { Compass } from 'lucide-react';
import { EmptyState } from '@/components/ui';
import { PageHeader } from '@/components/layout/Page';

export function NotFound() {
  return (
    <>
      <PageHeader title="Page not found" back="/" />
      <EmptyState
        icon={Compass}
        title="This page is off the radar"
        body="The link may be broken, or the post may have expired or been removed."
        action={
          <Link to="/" className="btn-primary">
            Back to your feed
          </Link>
        }
      />
    </>
  );
}
