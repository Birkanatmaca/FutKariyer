export async function confirmAction(
  title: string,
  body: string,
  _confirmLabel: string,
): Promise<boolean> {
  return globalThis.confirm(title + '\n\n' + body);
}
