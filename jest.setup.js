// AsyncStorage is a native module, so anything that imports it — the query
// persister, the analytics consent flag — can't be required under Jest without
// a stand-in. The package ships one.
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
