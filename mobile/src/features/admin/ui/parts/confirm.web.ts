// Browser preview: react-native-web has no Alert buttons.
export async function confirm(
  title: string,
  body: string,
  _confirmLabel: string,
  _destructive = true,
): Promise<boolean> {
  return globalThis.confirm(title + '\n\n' + body);
}
