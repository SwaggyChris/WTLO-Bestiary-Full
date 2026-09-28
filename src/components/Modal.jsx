export default function Modal({ open, children, onBackdrop }) {
  if (!open) return null;

  return (
    <div
      className="modal-overlay open"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onBackdrop?.();
      }}
    >
      {children}
    </div>
  );
}
