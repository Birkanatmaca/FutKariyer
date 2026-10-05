import { Platform } from 'react-native';

// Physical devices: replace with your computer's LAN address, e.g. http://192.168.1.20:8080.
const developmentOverride = '';
// Set the deployed HTTPS API before creating a release build.
const productionApiUrl = '';
export const config = {
  apiBaseUrl: __DEV__
    ? developmentOverride ||
      (Platform.OS === 'android'
        ? 'http://10.0.2.2:8080'
        : 'http://localhost:8080')
    : productionApiUrl,
  requestTimeout: 12000,
};
