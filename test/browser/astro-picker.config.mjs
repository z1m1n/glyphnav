import { mergeConfig } from 'vite';
import pickerConfig from '../../demo/vite.config';

// Exercise the real picker without sharing optimized modules with the user's server.
export default mergeConfig(pickerConfig, {
  cacheDir: '../node_modules/.vite-browser-picker',
});
