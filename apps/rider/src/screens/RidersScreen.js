import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useTheme } from '../context/ThemeContext';

export default function RidersScreen() {
  const { colors } = useTheme();
  const styles = createStyles(colors);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.card}>
        <Text style={styles.title}>Riders</Text>
        <Text style={styles.sub}>This screen is a placeholder for the Riders page.</Text>
      </View>
    </ScrollView>
  );
}

const createStyles = (colors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { padding: 20, paddingTop: 56 },
  card: { backgroundColor: colors.card, borderRadius: 12, padding: 20, borderWidth: 1, borderColor: colors.border },
  title: { color: colors.text, fontSize: 20, fontWeight: '800', marginBottom: 6 },
  sub: { color: colors.muted, fontSize: 13 },
});
