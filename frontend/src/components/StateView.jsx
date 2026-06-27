// Tiny presentation helpers: error banner, loading row, empty state.

// FastAPI / Pydantic returns validation errors as a list of objects:
//   { detail: [{ loc: ['body','email'], msg: 'value is not a valid email', ... }, ...] }
// Older endpoints return a plain string: { detail: "Email already registered" }.
// Render either shape into a readable single line so the UI never shows
// `[object Object]`.
function formatErrorMessage(err) {
  if (!err) return 'Something went wrong';
  if (typeof err === 'string') return err;

  // ApiError instance or any object with .message
  if (typeof err.message === 'string' && err.message) {
    // err.message itself can be a Pydantic array (when ApiError wraps the raw body)
    if (Array.isArray(err.message)) return formatDetailArray(err.message);
    return err.message;
  }

  // ApiError may have already extracted .body / .detail
  if (Array.isArray(err.detail)) return formatDetailArray(err.detail);
  if (typeof err.detail === 'string' && err.detail) return err.detail;

  return 'Something went wrong';
}

function formatDetailArray(arr) {
  return arr
    .map((e) => {
      if (typeof e === 'string') return e;
      if (e && typeof e === 'object') {
        const where = Array.isArray(e.loc) ? e.loc.filter((p) => p !== 'body').join('.') : '';
        const msg = e.msg || 'invalid value';
        return where ? `${where}: ${msg}` : msg;
      }
      return String(e);
    })
    .join('; ');
}

export function ErrorBanner({ error, onClose }) {
  if (!error) return null;
  const message = formatErrorMessage(error);
  return (
    <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-md flex justify-between items-start">
      <div className="text-sm">
        <strong className="font-semibold">Error:</strong> {message}
      </div>
      {onClose && (
        <button
          onClick={onClose}
          className="ml-3 text-red-700 hover:text-red-900 text-sm font-medium"
          aria-label="Dismiss error"
        >
          ×
        </button>
      )}
    </div>
  );
}

export function LoadingRow({ label = 'Loading…' }) {
  return (
    <div className="text-center py-12 text-gray-500" role="status">
      <div className="inline-block w-5 h-5 border-2 border-gray-300 border-t-brand-600 rounded-full animate-spin mr-2" />
      {label}
    </div>
  );
}

export function EmptyState({ title, description, action }) {
  return (
    <div className="text-center py-12">
      <h3 className="text-lg font-medium text-gray-900">{title}</h3>
      {description && <p className="mt-1 text-sm text-gray-500">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}