/**
 * Mobile landing — Phase 0 placeholder.
 *
 * In later phases this splits into three role-aware shells:
 *   - Staff: register, behaviour entry, shop, clubs, messages
 *   - Parent: child overview, tithe, notices, messages, club signup
 *   - Student: results + merits view only
 */
import { Text, View } from 'react-native';

export default function Index() {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <Text style={{ fontSize: 20, fontWeight: '600' }}>Oasis Learning Centre</Text>
      <Text style={{ marginTop: 8, opacity: 0.7 }}>Phase 0 scaffold</Text>
    </View>
  );
}
