export const AuthorizationStatus = { AUTHORIZED: 1, PROVISIONAL: 2 };
export const getMessaging = jest.fn();
export const getToken = jest.fn();
export const requestPermission = jest.fn();
export const onTokenRefresh = jest.fn(() => () => {});
export const onNotificationOpenedApp = jest.fn(() => () => {});
export const getInitialNotification = jest.fn(async () => null);
