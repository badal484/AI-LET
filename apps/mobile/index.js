import { AppRegistry, LogBox } from 'react-native';
import App from './src/app/App';
import { name as appName } from './app.json';
import { PushService } from './src/services/push/PushService';

// Dev only: the Google Play billing library logs an error whenever Play can't be reached (emulators, phones
// without a Play account). The app already handles it ("not available" in the paywall and coin store).
LogBox.ignoreLogs(['[RN-IAP]']);

// Must run before the app renders: pushes and notification taps can arrive while it is closed.
PushService.installBackgroundHandlers();

AppRegistry.registerComponent(appName, () => App);
