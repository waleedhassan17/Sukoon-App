const { withAndroidManifest } = require('expo/config-plugins');

module.exports = function withAndroidManifestFix(config) {
  return withAndroidManifest(config, async (config) => {
    const manifest = config.modResults.manifest;
    
    // Add tools namespace if not present
    if (!manifest.$['xmlns:tools']) {
      manifest.$['xmlns:tools'] = 'http://schemas.android.com/tools';
    }
    
    // Find and update firebase notification color meta-data
    const application = manifest.application?.[0];
    if (application && application['meta-data']) {
      for (const metaData of application['meta-data']) {
        if (metaData.$['android:name'] === 'com.google.firebase.messaging.default_notification_color') {
          metaData.$['tools:replace'] = 'android:resource';
        }
      }
    }
    
    return config;
  });
};
