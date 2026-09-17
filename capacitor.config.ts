// Capacitor configuration for Mobile Android/iOS packaging
// @ts-ignore - types can be installed via @capacitor/cli
const config = {
  appId: 'id.kasirio.pos',
  appName: 'Kasirio POS',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
    cleartext: true,
  },
};

export default config;
