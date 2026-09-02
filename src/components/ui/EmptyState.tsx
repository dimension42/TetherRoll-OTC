import { type ReactNode } from 'react';

export function EmptyState({ icon, title, description, action }: {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="text-center py-20">
      {icon && <div className="text-5xl mb-4">{icon}</div>}
      <h3 className="text-xl font-semibold text-white mb-2">{title}</h3>
      {description && <p className="mb-6" style={{ color: '#666' }}>{description}</p>}
      {action && <div>{action}</div>}
    </div>
  );
}
