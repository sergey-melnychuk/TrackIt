import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  Modal, TextInput, KeyboardAvoidingView, Platform, Alert,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { format } from 'date-fns';
import { theme } from '../theme';
import { getAllTrackers, Tracker } from '../db/trackers';
import { addEntry, getDailyTotals, DailyTotal, getStreak } from '../db/entries';

const TODAY = format(new Date(), 'yyyy-MM-dd');

export default function TodayScreen() {
  const insets = useSafeAreaInsets();
  const [trackers, setTrackers] = useState<Tracker[]>([]);
  const [totals, setTotals] = useState<Record<number, DailyTotal>>({});
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedTracker, setSelectedTracker] = useState<Tracker | null>(null);
  const [inputValue, setInputValue] = useState('');
  const [noteValue, setNoteValue] = useState('');
  const [streaks, setStreaks] = useState<Record<number, number>>({});

  const load = useCallback(() => {
    const t = getAllTrackers();
    const raw = getDailyTotals(TODAY);
    const totalsMap: Record<number, DailyTotal> = {};
    raw.forEach(r => { totalsMap[r.tracker_id] = r; });
    const streakMap: Record<number, number> = {};
    t.forEach(tr => { streakMap[tr.id] = getStreak(tr.id); });
    setTrackers(t);
    setTotals(totalsMap);
  }, []);

  useFocusEffect(load);

  const openLog = (tracker: Tracker) => {
    setSelectedTracker(tracker);
    setInputValue(tracker.is_boolean ? '1' : '');
    setNoteValue('');
    setModalVisible(true);
  };

  const submitLog = () => {
    if (!selectedTracker) return;
    const val = parseFloat(inputValue);
    if (isNaN(val) || val <= 0) {
      Alert.alert('Invalid value', 'Please enter a number greater than 0');
      return;
    }
    addEntry({ tracker_id: selectedTracker.id, value: val, date: TODAY, note: noteValue.trim() || undefined });
    setModalVisible(false);
    load();
  };

  const getProgress = (tracker: Tracker): number => {
    const total = totals[tracker.id]?.total ?? 0;
    if (!tracker.daily_goal) return 0;
    return Math.min(total / tracker.daily_goal, 1);
  };

  const renderCard = ({ item }: { item: Tracker }) => {
    const total = totals[item.id]?.total ?? 0;
    const progress = getProgress(item);
    const done = item.is_boolean && total >= 1;

    return (
      <TouchableOpacity style={styles.card} onPress={() => openLog(item)} activeOpacity={0.7}>
        <View style={styles.cardLeft}>
          <View style={[styles.iconCircle, { backgroundColor: item.color + '22' }]}>
            <MaterialCommunityIcons name={item.icon as any} size={24} color={item.color} />
          </View>
          <View style={styles.cardText}>
            <Text style={styles.trackerName}>{item.name}</Text>
            <Text style={styles.trackerValue}>
              {item.is_boolean
                ? (done ? '✓ Done' : 'Not logged')
                : `${total} / ${item.daily_goal ?? '—'} ${item.unit}`}
            </Text>
          </View>
        </View>
        <View style={styles.cardRight}>
          {item.is_boolean ? (
            <View style={[styles.boolDot, { backgroundColor: done ? theme.colors.success : theme.colors.border }]} />
          ) : (
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: `${progress * 100}%` as any, backgroundColor: item.color }]} />
            </View>
          )}
          <MaterialCommunityIcons name="plus-circle-outline" size={28} color={item.color} style={{ marginLeft: 12 }} />
        </View>
        {streaks[item.id] > 1 && (
          <View style={styles.streakBadge} testID={`streak-${item.id}`}>
            <Text style={styles.streakText}>🔥{streaks[item.id]}</Text>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.dateLabel}>{format(new Date(), 'EEEE, MMM d')}</Text>
        <Text style={styles.title}>Today</Text>
      </View>

      <FlatList
        data={trackers}
        keyExtractor={t => String(t.id)}
        renderItem={renderCard}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <Text style={styles.empty}>No trackers yet. Add some in Settings!</Text>
        }
      />

      <Modal visible={modalVisible} transparent animationType="slide">
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalOverlay}>
          <View style={[styles.modalSheet, { paddingBottom: Math.max(40, insets.bottom + theme.spacing.lg) }]}>
            {selectedTracker && (
              <>
                <View style={styles.modalHeader}>
                  <MaterialCommunityIcons name={selectedTracker.icon as any} size={28} color={selectedTracker.color} />
                  <Text style={styles.modalTitle}>Log {selectedTracker.name}</Text>
                </View>

                {selectedTracker.is_boolean ? (
                  <Text style={styles.boolHint}>Tap "Save" to mark as done for today.</Text>
                ) : (
                  <TextInput
                    style={styles.input}
                    placeholder={`Amount in ${selectedTracker.unit}`}
                    placeholderTextColor={theme.colors.textMuted}
                    keyboardType="numeric"
                    value={inputValue}
                    onChangeText={setInputValue}
                    autoFocus
                  />
                )}

                <TextInput
                  style={[styles.input, { marginTop: theme.spacing.sm }]}
                  placeholder="Add a note (optional)"
                  placeholderTextColor={theme.colors.textMuted}
                  value={noteValue}
                  onChangeText={setNoteValue}
                  maxLength={120}
                />

                <View style={styles.modalButtons}>
                  <TouchableOpacity style={styles.cancelBtn} onPress={() => setModalVisible(false)}>
                    <Text style={styles.cancelText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.saveBtn, { backgroundColor: selectedTracker.color }]} onPress={submitLog}>
                    <Text style={styles.saveText}>Save</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  header: { paddingTop: 60, paddingHorizontal: theme.spacing.lg, paddingBottom: theme.spacing.md },
  dateLabel: { color: theme.colors.textMuted, fontSize: theme.font.md },
  title: { color: theme.colors.text, fontSize: theme.font.xxl, fontWeight: '700', marginTop: 2 },
  list: { padding: theme.spacing.md, gap: theme.spacing.sm },
  empty: { color: theme.colors.textMuted, textAlign: 'center', marginTop: 60, fontSize: theme.font.md },
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cardLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  iconCircle: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', marginRight: theme.spacing.md },
  cardText: { flex: 1 },
  trackerName: { color: theme.colors.text, fontSize: theme.font.lg, fontWeight: '600' },
  trackerValue: { color: theme.colors.textMuted, fontSize: theme.font.sm, marginTop: 2 },
  cardRight: { flexDirection: 'row', alignItems: 'center' },
  progressTrack: { width: 60, height: 6, backgroundColor: theme.colors.border, borderRadius: 3, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 3 },
  boolDot: { width: 14, height: 14, borderRadius: 7 },
  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: '#00000088' },
  modalSheet: {
    backgroundColor: theme.colors.surface,
    borderTopLeftRadius: theme.radius.xl,
    borderTopRightRadius: theme.radius.xl,
    padding: theme.spacing.xl,
  },
  modalHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: theme.spacing.lg },
  modalTitle: { color: theme.colors.text, fontSize: theme.font.xl, fontWeight: '700' },
  boolHint: { color: theme.colors.textMuted, fontSize: theme.font.md, marginBottom: theme.spacing.lg },
  input: {
    backgroundColor: theme.colors.surfaceHighlight,
    color: theme.colors.text,
    borderRadius: theme.radius.md,
    padding: theme.spacing.md,
    fontSize: theme.font.lg,
    marginBottom: theme.spacing.lg,
  },
  modalButtons: { flexDirection: 'row', gap: theme.spacing.md },
  cancelBtn: { flex: 1, padding: theme.spacing.md, borderRadius: theme.radius.md, backgroundColor: theme.colors.surfaceHighlight, alignItems: 'center' },
  cancelText: { color: theme.colors.textMuted, fontSize: theme.font.md, fontWeight: '600' },
  saveBtn: { flex: 1, padding: theme.spacing.md, borderRadius: theme.radius.md, alignItems: 'center' },
  saveText: { color: '#fff', fontSize: theme.font.md, fontWeight: '700' },
    streakBadge: {
    backgroundColor: theme.colors.surfaceHighlight,
    borderRadius: 12,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginRight: 6,
  },
  streakText: { fontSize: theme.font.sm, fontWeight: '700', color: theme.colors.text },
});
