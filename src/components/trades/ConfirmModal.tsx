import { Modal } from '@/components/ui/Modal';

export function ConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
}: {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
}) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title}>
      <div className="space-y-6">
        <p className="text-sm" style={{ color: '#f0f0f0' }}>
          {message}
        </p>

        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-3 px-4 rounded-xl font-semibold transition-all"
            style={{ background: 'rgba(255,255,255,0.05)', color: '#888', border: '1px solid #1f1f1f' }}
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 py-3 px-4 rounded-xl font-semibold transition-all"
            style={{ background: '#00c9a7', color: '#000' }}
          >
            Confirm
          </button>
        </div>
      </div>
    </Modal>
  );
}
