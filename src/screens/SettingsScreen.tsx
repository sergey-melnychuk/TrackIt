import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Modal, TextInput, Switch, Alert, Share,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { format } from 'date-fns';
import { theme } from '../theme';
import { getAllTrackers, createTracker, updateTracker, deleteTracker, Tracker } from '../db/trackers';
import { exportAllData } from '../db/entries';
import RemindersModal from '../components/RemindersModal';

const COLORS = [
  '#6C63FF', '#FF6584', '#F06292', '#4CAF50',
  '#FF9800', '#E91E63', '#9C27B0', '#00BCD4',
  '#F44336', '#3F51B5', '#009688', '#CDDC39',
];

const ICONS = [
  'food-steak', 'bread-slice', 'cup-water', 'dumbbell',
  'walk', 'run', 'bike', 'sleep',
  'heart-pulse', 'pill', 'smoking-off', 'meditation',
  'book-open-variant', 'pencil', 'guitar-acoustic', 'laptop',
  'moon-waning-crescent', 'coffee',
];

type FormState = {
  name: string;
  unit: string;
  color: string;
  icon: string;
  daily_goal: string;
  is_boolean: boolean;
};

const defaultForm = (): FormState => ({
  name: '',
  unit: '',
  color: COLORS[0],
  icon: ICONS[0],
  daily_goal: '',
  is_boolean: false,
});

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const [trackers, setTrackers] = useState<Tracker[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [editing, setEditing] = useState<Tracker | null>(null);
  const [form, setForm] = useState<FormState>(defaultForm());
  const [remindersVisible, setRemindersVisible] = useState(false);

  const load = useCallback(() => {
    setTrackers(getAllTrackers());
  }, []);

  useFocusEffect(load);

  const openCreate = () => {
    setEditing(null);
    setForm(defaultForm());
    setModalVisible(true);
  };

  const openEdit = (t: Tracker) => {
    setEditing(t);
    setForm({
      name: t.name,
      unit: t.unit,
      color: t.color,
      icon: t.icon,
      daily_goal: t.daily_goal != null ? String(t.daily_goal) : '',
      is_boolean: t.is_boolean,
    });
    setModalVisible(true);
  };

  const save = () => {
    if (!form.name.trim()) {
      Alert.alert('Name required', 'Please enter a tracker name.');
      return;
    }
    if (!form.is_boolean && !form.unit.trim()) {
      Alert.alert('Unit required', 'Please enter a unit (e.g. g, ml, steps).');
      return;
    }

    const payload = {
      name: form.name.trim(),
      unit: form.is_boolean ? 'session' : form.unit.trim(),
      color: form.color,
      icon: form.icon,
      daily_goal: form.daily_goal ? parseFloat(form.daily_goal) : null,
      is_boolean: form.is_boolean,
    };

    if (editing) {
      updateTracker(editing.id, payload);
    } else {
      createTracker(payload);
    }

    setModalVisible(false);
    load();
  };

  const confirmDelete = (t: Tracker) => {
    Alert.alert(
      'Delete tracker',
      `Delete "${t.name}" and all its entries? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => { deleteTracker(t.id); load(); } },
      ]
    );
  };

  const exportCSV = async () => {
    try {
      const rows = exportAllData();
      if (rows.length === 0) {
        Alert.alert('No data', 'Log some entries first!');
        return;
      }

      const header = 'date,tracker,value,unit,note\n';
      const body = rows.map(r =>
        `${r.date},"${r.tracker_name}",${r.value},"${r.unit}","${r.note ?? ''}"`
      ).join('\n');

      const filename = `trackit_export_${format(new Date(), 'yyyy-MM-dd')}.csv`;
      const path = FileSystem.documentDirectory + filename;
      await FileSystem.writeAsStringAsync(path, header + body, {
        encoding: FileSystem.EncodingType.UTF8,
      });

      await Sharing.shareAsync(path, {
        mimeType: 'text/csv',
        dialogTitle: 'Export TrackIt data',
      });
    } catch (e) {
      Alert.alert('Export failed', String(e));
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Settings</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>

        {/* Trackers section */}
        <Text style={styles.sectionLabel}>MY TRACKERS</Text>
        {trackers.map(t => (
          <View key={t.id} style={styles.trackerRow}>
            <View style={[styles.iconCircle, { backgroundColor: t.color + '22' }]}>
              <MaterialCommunityIcons name={t.icon as any} size={20} color={t.color} />
            </View>
            <View style={styles.trackerInfo}>
              <Text style={styles.trackerName}>{t.name}</Text>
              <Text style={styles.trackerMeta}>
                {t.is_boolean ? 'Boolean' : t.unit}
                {t.daily_goal ? ` · goal: ${t.daily_goal}` : ''}
              </Text>
            </View>
            <TouchableOpacity onPress={() => openEdit(t)} style={styles.iconBtn} testID={`edit-tracker-${t.id}`}>
              <MaterialCommunityIcons name="pencil-outline" size={20} color={theme.colors.textMuted} />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => confirmDelete(t)} style={styles.iconBtn}>
              <MaterialCommunityIcons name="trash-can-outline" size={20} color={theme.colors.error} />
            </TouchableOpacity>
          </View>
        ))}

        <TouchableOpacity style={styles.addBtn} onPress={openCreate}>
          <MaterialCommunityIcons name="plus" size={20} color={theme.colors.primary} />
          <Text style={styles.addText}>Add tracker</Text>
        </TouchableOpacity>

        {/* Export section */}
        <Text style={[styles.sectionLabel, { marginTop: theme.spacing.xl }]}>EXPORT</Text>
        <TouchableOpacity style={styles.exportBtn} onPress={exportCSV}>
          <MaterialCommunityIcons name="file-delimited-outline" size={24} color="#fff" />
          <Text style={styles.exportText}>Export as CSV</Text>
        </TouchableOpacity>

        <Text style={[styles.sectionLabel, { marginTop: theme.spacing.xl }]}>NOTIFICATIONS</Text>
        <TouchableOpacity style={styles.remindersBtn} onPress={() => setRemindersVisible(true)}>
          <MaterialCommunityIcons name="bell-outline" size={24} color={theme.colors.primary} />
          <Text style={styles.remindersText}>Manage reminders</Text>
        </TouchableOpacity>

      </ScrollView>

      {/* Create / Edit Modal */}
      <Modal visible={modalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <ScrollView style={styles.modalScroll} contentContainerStyle={styles.modalContent}>
              <Text style={styles.modalTitle}>{editing ? 'Edit tracker' : 'New tracker'}</Text>

            {/* Name */}
            <Text style={styles.label}>Name</Text>
            <TextInput
              style={styles.input}
              value={form.name}
              onChangeText={v => setForm(f => ({ ...f, name: v }))}
              placeholder="e.g. Protein"
              placeholderTextColor={theme.colors.textMuted}
            />

            {/* Boolean toggle */}
            <View style={styles.row}>
              <Text style={styles.label}>Boolean (done / not done)</Text>
              <Switch
                value={form.is_boolean}
                onValueChange={v => setForm(f => ({ ...f, is_boolean: v }))}
                trackColor={{ true: theme.colors.primary }}
              />
            </View>

            {/* Unit (only for non-boolean) */}
            {!form.is_boolean && (
              <>
                <Text style={styles.label}>Unit</Text>
                <TextInput
                  style={styles.input}
                  value={form.unit}
                  onChangeText={v => setForm(f => ({ ...f, unit: v }))}
                  placeholder="e.g. g, ml, steps, min"
                  placeholderTextColor={theme.colors.textMuted}
                />
              </>
            )}

            {/* Daily goal */}
            <Text style={styles.label}>Daily goal (optional)</Text>
            <TextInput
              style={styles.input}
              value={form.daily_goal}
              onChangeText={v => setForm(f => ({ ...f, daily_goal: v }))}
              placeholder="e.g. 150"
              placeholderTextColor={theme.colors.textMuted}
              keyboardType="numeric"
            />

            {/* Color picker */}
            <Text style={styles.label}>Color</Text>
            <View style={styles.colorGrid}>
              {COLORS.map(c => (
                <TouchableOpacity
                  key={c}
                  style={[styles.colorDot, { backgroundColor: c }, form.color === c && styles.colorDotSelected]}
                  onPress={() => setForm(f => ({ ...f, color: c }))}
                />
              ))}
            </View>

            {/* Icon picker */}
            <Text style={styles.label}>Icon</Text>
            <View style={styles.iconGrid}>
              {ICONS.map(ic => (
                <TouchableOpacity
                  key={ic}
                  style={[styles.iconOption, form.icon === ic && { backgroundColor: form.color + '33', borderColor: form.color }]}
                  onPress={() => setForm(f => ({ ...f, icon: ic }))}
                >
                  <MaterialCommunityIcons name={ic as any} size={24} color={form.icon === ic ? form.color : theme.colors.textMuted} />
                </TouchableOpacity>
              ))}
            </View>

            </ScrollView>
            <View style={[styles.modalButtons, { paddingBottom: Math.max(theme.spacing.lg, insets.bottom + theme.spacing.sm) }]}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setModalVisible(false)}>
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.saveBtn, { backgroundColor: form.color }]} onPress={save}>
                <Text style={styles.saveText}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
      <RemindersModal
        visible={remindersVisible}
        trackers={trackers}
        onClose={() => setRemindersVisible(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  header: { paddingTop: 60, paddingHorizontal: theme.spacing.lg, paddingBottom: theme.spacing.md },
  title: { color: theme.colors.text, fontSize: theme.font.xxl, fontWeight: '700' },
  scroll: { padding: theme.spacing.md, paddingBottom: 60 },
  sectionLabel: { color: theme.colors.textMuted, fontSize: theme.font.sm, fontWeight: '700', letterSpacing: 1, marginBottom: theme.spacing.sm },
  trackerRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.sm,
  },
  iconCircle: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginRight: theme.spacing.md },
  trackerInfo: { flex: 1 },
  trackerName: { color: theme.colors.text, fontSize: theme.font.md, fontWeight: '600' },
  trackerMeta: { color: theme.colors.textMuted, fontSize: theme.font.sm, marginTop: 2 },
  iconBtn: { padding: 6, marginLeft: 4 },
  addBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    borderWidth: 1.5, borderColor: theme.colors.primary, borderStyle: 'dashed',
    borderRadius: theme.radius.lg, padding: theme.spacing.md,
    marginBottom: theme.spacing.sm,
  },
  addText: { color: theme.colors.primary, fontWeight: '600', fontSize: theme.font.md },
  exportBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    backgroundColor: theme.colors.primary,
    borderRadius: theme.radius.lg, padding: theme.spacing.md,
  },
  exportText: { color: '#fff', fontWeight: '700', fontSize: theme.font.md },
  // Modal
  modalOverlay: { flex: 1, backgroundColor: '#00000088', justifyContent: 'flex-end' },
  modalSheet: { backgroundColor: theme.colors.surface, borderTopLeftRadius: theme.radius.xl, borderTopRightRadius: theme.radius.xl, maxHeight: '92%' },
  modalScroll: { flexGrow: 0 },
  modalContent: { padding: theme.spacing.xl, paddingBottom: theme.spacing.md },
  modalTitle: { color: theme.colors.text, fontSize: theme.font.xl, fontWeight: '700', marginBottom: theme.spacing.lg },
  label: { color: theme.colors.textMuted, fontSize: theme.font.sm, fontWeight: '600', marginBottom: theme.spacing.xs, marginTop: theme.spacing.md },
  input: {
    backgroundColor: theme.colors.surfaceHighlight,
    color: theme.colors.text,
    borderRadius: theme.radius.md,
    padding: theme.spacing.md,
    fontSize: theme.font.md,
  },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: theme.spacing.md },
  colorGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  colorDot: { width: 32, height: 32, borderRadius: 16 },
  colorDotSelected: { borderWidth: 3, borderColor: '#fff' },
  iconGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  iconOption: {
    width: 48, height: 48, borderRadius: theme.radius.sm,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: theme.colors.surfaceHighlight,
    borderWidth: 1.5, borderColor: 'transparent',
  },
  modalButtons: {
    flexDirection: 'row',
    gap: theme.spacing.md,
    paddingHorizontal: theme.spacing.xl,
    paddingTop: theme.spacing.md,
    borderTopWidth: 1,
    borderTopColor: theme.colors.surfaceHighlight,
    backgroundColor: theme.colors.surface,
  },
  cancelBtn: { flex: 1, padding: theme.spacing.md, borderRadius: theme.radius.md, backgroundColor: theme.colors.surfaceHighlight, alignItems: 'center' },
  cancelText: { color: theme.colors.textMuted, fontWeight: '600' },
  saveBtn: { flex: 1, padding: theme.spacing.md, borderRadius: theme.radius.md, alignItems: 'center' },
  saveText: { color: '#fff', fontWeight: '700' },
    remindersBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg, padding: theme.spacing.md,
    marginBottom: theme.spacing.sm,
  },
  remindersText: { color: theme.colors.primary, fontWeight: '600', fontSize: theme.font.md },
});
