import { Alert } from 'react-native';
import { copy } from '../../../shared/lib/copy';

export function confirmAction(
  title: string,
  body: string,
  confirmLabel: string,
): Promise<boolean> {
  return new Promise(resolve =>
    Alert.alert(
      title,
      body,
      [
        {
          text: copy.connections.keep,
          style: 'cancel',
          onPress: () => resolve(false),
        },
        {
          text: confirmLabel,
          style: 'destructive',
          onPress: () => resolve(true),
        },
      ],
      { cancelable: true, onDismiss: () => resolve(false) },
    ),
  );
}
