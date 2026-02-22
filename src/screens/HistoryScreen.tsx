import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, SectionList,
  TouchableOpacity, Alert,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { format, parseISO, subDays } from 'date-fns';
import { theme } from '../theme';
import { getAllTrackers, Tracker } from '../db/trackers';
import { deleteEntry } from '../db/entries';
import db from '../db/database';

type EntryRow = {
  id: number;
  tracker_id: number;
  value: number;
  date: string;
  note?: string;
  tracker_name: string;
  unit: string;
  color: string;
  icon: string;
};

type Section = {
  title: string;
  data: EntryRow[];
};

const loadGroupedEntries = (): Section[] => {
  const rows = db.getAllSync<EntryRow>(
    `SELECT e.id, e.tracker_id, e.value, e.date, e.note,
            t.name as tracker_name, t.unit, t.color, t.icon
     FROM entries e
     JOIN tracker_types t ON e.tracker_id = t.id
     WHERE e.date >= date('now', '-30 days')
     ORDER BY e.date DESC, e.created_at DESC`
  );

  const grouped: Record<string, EntryRow[]> = {};
  rows.forEach(r => {
    if (!grouped[r.date]) grouped[r.date] = [];
    grouped[r.date].push(r);
  });

  return Object.entries(grouped).map(([date, data]) => ({
    title: date,
    data,
  }));
};

export default function HistoryScreen() {
  const [sections, setSections] = useState<Section[]>([]);

  const load = useCallback(() => {
    setSections(loadGroupedEntries());
  }, []);

  useFocusEffect(load);

  const confirmDelete = (entry: EntryRow) => {
    Alert.alert(
      'Delete entry',
      `Remove this ${entry.tracker_name} entry?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => { deleteEntry(entry.id); load(); } },
      ]
    );
  };

  const formatDate = (dateStr: string) => {
    const d = parseISO(dateStr);
    const today = format(new Date(), 'yyyy-MM-dd');
    const yesterday = format(subDays(new Date(), 1), 'yyyy-MM-dd');
    if (dateStr === today) return 'Today';
    if (dateStr === yesterday) return 'Yesterday';
    return format(d, 'EEEE, MMM d');
  };

  const renderSectionHeader = ({ section }: { section: Section }) => (
    <View style={styles.dateHeader}>
      <Text style={styles.dateHeaderText}>{formatDate(section.title)}</Text>
      <Text style={styles.dateHeaderCount}>{section.data.length} entries</Text>
    </View>
  );

  const renderItem = ({ item }: { item: EntryRow }) => (
    <View style={styles.entryRow}>
      <View style={[styles.iconCircle, { backgroundColor: item.color + '22' }]}>
        <MaterialCommunityIcons name={item.icon as any} size={18} color={item.color} />
      </View>
      <View style={styles.entryInfo}>
        <Text style={styles.entryName}>{item.tracker_name}</Text>
        {item.note ? <Text style={styles.entryNote}>{item.note}</Text> : null}
      </View>
      <Text style={[styles.entryValue, { color: item.color }]}>
        {item.value} {item.unit}
      </Text>
      <TouchableOpacity onPress={() => confirmDelete(item)} style={styles.deleteBtn}>
        <MaterialCommunityIcons name="trash-can-outline" size={18} color={theme.colors.textMuted} />
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>History</Text>
        <Text style={styles.subtitle}>Last 30 days</Text>
      </View>

      <SectionList
        sections={sections}
        keyExtractor={item => String(item.id)}
        renderSectionHeader={renderSectionHeader}
        renderItem={renderItem}
        contentContainerStyle={styles.list}
        stickySectionHeadersEnabled
        ListEmptyComponent={
          <Text style={styles.empty}>No entries yet. Start logging on the Today tab!</Text>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  header: { paddingTop: 60, paddingHorizontal: theme.spacing.lg, paddingBottom: theme.spacing.md },
  title: { color: theme.colors.text, fontSize: theme.font.xxl, fontWeight: '700' },
  subtitle: { color: theme.colors.textMuted, fontSize: theme.font.sm, marginTop: 2 },
  list: { paddingBottom: 40 },
  dateHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: theme.colors.background,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  dateHeaderText: { color: theme.colors.text, fontWeight: '700', fontSize: theme.font.md },
  dateHeaderCount: { color: theme.colors.textMuted, fontSize: theme.font.sm },
  entryRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: theme.colors.surface,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  iconCircle: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', marginRight: theme.spacing.md },
  entryInfo: { flex: 1 },
  entryName: { color: theme.colors.text, fontSize: theme.font.md, fontWeight: '600' },
  entryNote: { color: theme.colors.textMuted, fontSize: theme.font.sm, marginTop: 2 },
  entryValue: { fontSize: theme.font.md, fontWeight: '700', marginRight: theme.spacing.sm },
  deleteBtn: { padding: 4 },
  empty: { color: theme.colors.textMuted, textAlign: 'center', marginTop: 60, paddingHorizontal: theme.spacing.xl },
});
