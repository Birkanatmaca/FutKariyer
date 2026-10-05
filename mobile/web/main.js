import { AppRegistry } from 'react-native';
import App from '../App';
import { colors } from '../src/styles/tokens';

document.documentElement.style.setProperty('--fut-bg', colors.bg);
document.documentElement.style.setProperty('--fut-border', colors.border);
document.querySelector('meta[name="theme-color"]').content = colors.bg;
AppRegistry.registerComponent('FutCareer', () => App);
AppRegistry.runApplication('FutCareer', {
  rootTag: document.getElementById('root'),
});
