import { View } from 'react-native';

/**
 * Root splash. The session guard in _layout redirects to (auth) or (tabs) once
 * the session + profile settle, so this only shows for a beat on cold start.
 */
export default function Index() {
  return <View style={{ flex: 1 }} />;
}
