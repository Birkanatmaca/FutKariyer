import { Alert } from 'react-native';
import { copy } from '../../../shared/lib/copy';

export function confirmSignOut(): Promise<boolean> {
  return new Promise(resolve =>
    Alert.alert(
      copy.profile.logoutTitle,
      copy.profile.logoutBody,
      [
        {
          text: copy.profile.cancel,
          style: 'cancel',
          onPress: () => resolve(false),
        },
        {
          text: copy.profile.logout,
          style: 'destructive',
          onPress: () => resolve(true),
        },
      ],
      { cancelable: true, onDismiss: () => resolve(false) },
    ),
  );
}
