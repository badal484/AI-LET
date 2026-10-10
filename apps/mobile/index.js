import { AppRegistry } from 'react-native';
import App from './src/app/App';
import { name as appName } from './app.json';
import { PushService } from './src/services/push/PushService';

// Must run before the app renders: pushes and notification taps can arrive while it is closed.
PushService.installBackgroundHandlers();

AppRegistry.registerComponent(appName, () => App);
