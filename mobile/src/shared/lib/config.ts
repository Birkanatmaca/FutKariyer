import { Platform } from 'react-native';

// Physical devices: replace with your computer's LAN address, e.g. http://192.168.1.20:8080.
const developmentOverride = 'http://153.56.210.50';
// The pilot server has no domain or TLS yet, so release builds talk to it over
// plain HTTP. Switch to the HTTPS URL and set allowInsecureApi to false as soon
// as a domain is configured (see deploy/README.md); App Store builds must use HTTPS.
const productionApiUrl = 'http://153.56.210.50';
export const config = {
  allowInsecureApi: true,
  apiBaseUrl: __DEV__
    ? developmentOverride ||
      (Platform.OS === 'android'
        ? 'http://10.0.2.2:8080'
        : 'http://localhost:8080')
    : productionApiUrl,
  requestTimeout: 12000,
};
