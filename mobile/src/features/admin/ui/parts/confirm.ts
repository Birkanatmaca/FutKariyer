import { Alert } from 'react-native';
import { copy } from '../../../../shared/lib/copy';

// Native confirmation before destructive or irreversible admin actions.
export function confirm(
  title: string,
  body: string,
  confirmLabel: string,
  destructive = true,
): Promise<boolean> {
  return new Promise(resolve =>
    Alert.alert(
      title,
      body,
      [
        {
          text: copy.admin.common.cancel,
          style: 'cancel',
          onPress: () => resolve(false),
        },
        {
          text: confirmLabel,
          style: destructive ? 'destructive' : 'default',
          onPress: () => resolve(true),
        },
      ],
      { cancelable: true, onDismiss: () => resolve(false) },
    ),
  );
}
