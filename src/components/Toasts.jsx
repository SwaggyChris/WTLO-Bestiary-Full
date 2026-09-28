export default function Toasts({ toasts, dismiss }) {
  return (
    <div className="toast-container">
      {toasts.map((toast) => {
        const icon = toast.type === 'success'
          ? 'fa-check-circle'
          : toast.type === 'error'
            ? 'fa-exclamation-circle'
            : 'fa-info-circle';

        return (
          <div className={`toast ${toast.type}`} key={toast.id}>
            <span className="toast-icon"><i className={`fas ${icon}`} /></span>
            <span className="toast-msg">{toast.message}</span>
            <button className="toast-close" onClick={() => dismiss(toast.id)} type="button">
              <i className="fas fa-times" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
