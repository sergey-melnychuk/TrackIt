import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, Modal, ScrollView,
  TouchableOpacity, Switch, Alert, Platform,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { theme } from '../theme';
import { Tracker } from '../db/trackers';
import {
  ReminderConfig, loadReminders, syncReminders, requestPermissions,
} from '../utils/notifications';

type Props = {
  visible: boolean;
  trackers: Tracker[];
  onClose: () => void;
};

export default function RemindersModal({ visible, trackers, onClose }: Props) {
  const [reminders, setReminders] = useState<ReminderConfig[]>([]);
  const [saving, setSaving] = useState(false);
  const [pickerVisible, setPickerVisible] = useState(false);
  const [pickerTarget, setPickerTarget] = useState<number | null>(null);
  const [pickerHour, setPickerHour] = useState(9);
  const [pickerMinute, setPickerMinute] = useState(0);

  useEffect(() => {
    if (!visible) return;
    loadReminders().then(saved => {
      // Merge saved reminders with current trackers
      const merged: ReminderConfig[] = trackers.map(t => {
        const existing = saved.find(r => r.trackerId === t.id);
        return existing ?? {
          trackerId: t.id,
          trackerName: t.name,
          hour: 9,
          minute: 0,
          enabled: false,
        };
      });
      setReminders(merged);
    });
  }, [visible, trackers]);

  const toggle = (trackerId: number, value: boolean) => {
    setReminders(prev =>
      prev.map(r => r.trackerId === trackerId ? { ...r, enabled: value } : r)
    );
  };

  const openPicker = (trackerId: number) => {
    const r = reminders.find(r => r.trackerId === trackerId);
    if (r) { setPickerHour(r.hour); setPickerMinute(r.minute); }
    setPickerTarget(trackerId);
    setPickerVisible(true);
  };

  const applyTime = () => {
    setReminders(prev =>
      prev.map(r => r.trackerId === pickerTarget ? { ...r, hour: pickerHour, minute: pickerMinute } : r)
    );
    setPickerVisible(false);
  };

  const saveAll = async () => {
    setSaving(true);
    const granted = await requestPermissions();
    if (!granted) {
      Alert.alert('Permission denied', 'Please enable notifications for TrackIt in your device settings.');
      setSaving(false);
      return;
    }
    await syncReminders(reminders);
    setSaving(false);
    Alert.alert('Saved!', 'Your reminders have been updated.', [{ text: 'OK', onPress: onClose }]);
  };

  const formatTime = (hour: number, minute: number) => {
    const h = hour % 12 || 12;
    const m = String(minute).padStart(2, '0');
    const ampm = hour < 12 ? 'AM' : 'PM';
    return `${h}:${m} ${ampm}`;
  };

  return (
    <>
      <Modal visible={visible} transparent animationType="slide">
        <View style={styles.overlay}>
          <View style={styles.sheet}>
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>Daily Reminders</Text>
              <TouchableOpacity onPress={onClose}>
                <MaterialCommunityIcons name="close" size={24} color={theme.colors.textMuted} />
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.list}>
              {reminders.map(r => {
                const tracker = trackers.find(t => t.id === r.trackerId);
                if (!tracker) return null;
                return (
                  <View key={r.trackerId} style={styles.reminderRow}>
                    <View style={[styles.iconCircle, { backgroundColor: tracker.color + '22' }]}>
                      <MaterialCommunityIcons name={tracker.icon as any} size={18} color={tracker.color} />
                    </View>
                    <View style={styles.reminderInfo}>
                      <Text style={styles.reminderName}>{tracker.name}</Text>
                      <TouchableOpacity onPress={() => openPicker(r.trackerId)} disabled={!r.enabled}>
                        <Text style={[styles.reminderTime, !r.enabled && { color: theme.colors.border }]}>
                          {formatTime(r.hour, r.minute)}
                        </Text>
                      </TouchableOpacity>
                    </View>
                    <Switch
                      value={r.enabled}
                      onValueChange={v => toggle(r.trackerId, v)}
                      trackColor={{ true: tracker.color }}
                    />
                  </View>
                );
              })}
            </ScrollView>

            <TouchableOpacity
              style={[styles.saveBtn, saving && { opacity: 0.6 }]}
              onPress={saveAll}
              disabled={saving}
            >
              <Text style={styles.saveBtnText}>{saving ? 'Saving…' : 'Save reminders'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Time picker modal */}
      <Modal visible={pickerVisible} transparent animationType="fade">
        <View style={styles.overlay}>
          <View style={styles.pickerSheet}>
            <Text style={styles.sheetTitle}>Set time</Text>

            <View style={styles.timeRow}>
              {/* Hour */}
              <View style={styles.spinnerCol}>
                <TouchableOpacity onPress={() => setPickerHour(h => (h + 1) % 24)}>
                  <MaterialCommunityIcons name="chevron-up" size={28} color={theme.colors.primary} />
                </TouchableOpacity>
                <Text style={styles.timeVal}>{String(pickerHour % 12 || 12).padStart(2, '0')}</Text>
                <TouchableOpacity onPress={() => setPickerHour(h => (h - 1 + 24) % 24)}>
                  <MaterialCommunityIcons name="chevron-down" size={28} color={theme.colors.primary} />
                </TouchableOpacity>
              </View>

              <Text style={styles.timeSep}>:</Text>

              {/* Minute */}
              <View style={styles.spinnerCol}>
                <TouchableOpacity onPress={() => setPickerMinute(m => (m + 5) % 60)}>
                  <MaterialCommunityIcons name="chevron-up" size={28} color={theme.colors.primary} />
                </TouchableOpacity>
                <Text style={styles.timeVal}>{String(pickerMinute).padStart(2, '0')}</Text>
                <TouchableOpacity onPress={() => setPickerMinute(m => (m - 5 + 60) % 60)}>
                  <MaterialCommunityIcons name="chevron-down" size={28} color={theme.colors.primary} />
                </TouchableOpacity>
              </View>

              {/* AM/PM */}
              <TouchableOpacity
                style={styles.ampmBtn}
                onPress={() => setPickerHour(h => (h + 12) % 24)}
              >
                <Text style={styles.ampmText}>{pickerHour < 12 ? 'AM' : 'PM'}</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.modalButtons}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setPickerVisible(false)}>
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.saveBtn} onPress={applyTime}>
                <Text style={styles.saveBtnText}>Set</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: '#00000088', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: theme.colors.surface,
    borderTopLeftRadius: theme.radius.xl,
    borderTopRightRadius: theme.radius.xl,
    padding: theme.spacing.xl,
    maxHeight: '80%',
  },
  sheetHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: theme.spacing.lg },
  sheetTitle: { color: theme.colors.text, fontSize: theme.font.xl, fontWeight: '700' },
  list: { paddingBottom: theme.spacing.lg },
  reminderRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: theme.spacing.md,
    borderBottomWidth: 1, borderBottomColor: theme.colors.border,
  },
  iconCircle: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', marginRight: theme.spacing.md },
  reminderInfo: { flex: 1 },
  reminderName: { color: theme.colors.text, fontSize: theme.font.md, fontWeight: '600' },
  reminderTime: { color: theme.colors.primary, fontSize: theme.font.sm, marginTop: 2 },
  saveBtn: { backgroundColor: theme.colors.primary, borderRadius: theme.radius.md, padding: theme.spacing.md, alignItems: 'center' },
  saveBtnText: { color: '#fff', fontWeight: '700', fontSize: theme.font.md },
  // Time picker
  pickerSheet: {
    backgroundColor: theme.colors.surface,
    borderTopLeftRadius: theme.radius.xl,
    borderTopRightRadius: theme.radius.xl,
    padding: theme.spacing.xl,
    paddingBottom: 48,
  },
  timeRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginVertical: theme.spacing.xl },
  spinnerCol: { alignItems: 'center', width: 70 },
  timeVal: { color: theme.colors.text, fontSize: 48, fontWeight: '700', marginVertical: theme.spacing.sm },
  timeSep: { color: theme.colors.text, fontSize: 48, fontWeight: '700', marginHorizontal: theme.spacing.sm, marginBottom: 8 },
  ampmBtn: { backgroundColor: theme.colors.surfaceHighlight, borderRadius: theme.radius.md, padding: theme.spacing.md, marginLeft: theme.spacing.md },
  ampmText: { color: theme.colors.primary, fontWeight: '700', fontSize: theme.font.lg },
  modalButtons: { flexDirection: 'row', gap: theme.spacing.md, marginTop: theme.spacing.md },
  cancelBtn: { flex: 1, padding: theme.spacing.md, borderRadius: theme.radius.md, backgroundColor: theme.colors.surfaceHighlight, alignItems: 'center' },
  cancelText: { color: theme.colors.textMuted, fontWeight: '600' },
});
