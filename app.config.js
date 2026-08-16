// Dynamic config layered on top of app.json. When APP_VARIANT=development, the app
// gets a distinct identity ("Watchline Dev" + a `.dev` bundle id / package) so the
// dev build can live on-device alongside the TestFlight/production "Watchline".
const IS_DEV = process.env.APP_VARIANT === 'development';

module.exports = ({ config }) => ({
  ...config,
  name: IS_DEV ? 'Watchline Dev' : config.name,
  ios: {
    ...config.ios,
    bundleIdentifier: IS_DEV ? 'com.rvolkov.watchline.dev' : config.ios.bundleIdentifier,
  },
  android: {
    ...config.android,
    package: IS_DEV ? 'com.rvolkov.watchline.dev' : config.android.package,
  },
});
