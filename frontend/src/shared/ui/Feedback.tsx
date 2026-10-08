export function Feedback({
  message,
  success = false,
}: {
  message: string | null;
  success?: boolean;
}) {
  if (!message) {
    return null;
  }
  return (
    <div
      className={success ? 'feedback success' : 'feedback error'}
      role={success ? 'status' : 'alert'}
    >
      {message}
    </div>
  );
}
