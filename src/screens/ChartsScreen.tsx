import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, Dimensions,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LineChart, BarChart } from 'react-native-chart-kit';
import { format, subDays, parseISO } from 'date-fns';
import { theme } from '../theme';
import { getAllTrackers, Tracker } from '../db/trackers';
import { getAggregatedByDay } from '../db/entries';

const SCREEN_WIDTH = Dimensions.get('window').width;
const PERIODS = [
  { label: '7D', days: 7 },
  { label: '30D', days: 30 },
  { label: '90D', days: 90 },
];

export default function ChartsScreen() {
  const [trackers, setTrackers] = useState<Tracker[]>([]);
  const [selected, setSelected] = useState<Tracker | null>(null);
  const [period, setPeriod] = useState(7);
  const [data, setData] = useState<{ labels: string[]; values: number[] }>({ labels: [], values: [] });

  const load = useCallback(() => {
    const t = getAllTrackers();
    setTrackers(t);
    if (!selected && t.length > 0) setSelected(t[0]);
  }, [selected]);

  useFocusEffect(load);

  useFocusEffect(
    useCallback(() => {
      if (!selected) return;
      const raw = getAggregatedByDay(selected.id, period);
      const labels: string[] = [];
      const values: number[] = [];

      for (let i = period - 1; i >= 0; i--) {
        const d = format(subDays(new Date(), i), 'yyyy-MM-dd');
        const found = raw.find(r => r.date === d);
        values.push(found?.total ?? 0);
        const date = parseISO(d);
        labels.push(period === 7 ? format(date, 'EEE') : format(date, 'M/d'));
      }

      // For 30/90 days, only show a subset of labels to avoid crowding
      const step = period === 7 ? 1 : period === 30 ? 5 : 15;
      const sparseLabels = labels.map((l, i) => (i % step === 0 ? l : ''));

      setData({ labels: sparseLabels, values });
    }, [selected, period])
  );

  const chartConfig = {
    backgroundGradientFrom: theme.colors.surface,
    backgroundGradientTo: theme.colors.surface,
    color: (opacity = 1) => selected ? `${selected.color}${Math.round(opacity * 255).toString(16).padStart(2, '0')}` : `rgba(108,99,255,${opacity})`,
    labelColor: () => theme.colors.textMuted,
    strokeWidth: 2,
    propsForDots: { r: '3', strokeWidth: '1', stroke: selected?.color ?? theme.colors.primary },
    propsForBackgroundLines: { stroke: theme.colors.border, strokeDasharray: '4' },
    decimalPlaces: selected?.is_boolean ? 0 : 1,
  };

  const hasData = data.values.some(v => v > 0);
  const avg = data.values.length ? (data.values.reduce((s, v) => s + v, 0) / data.values.length).toFixed(1) : '0';
  const peak = Math.max(...data.values, 0);
  const doneCount = data.values.filter(v => v >= 1).length;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Charts</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        {/* Tracker selector */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.trackerScroll}>
          {trackers.map(t => (
            <TouchableOpacity
              key={t.id}
              style={[styles.trackerChip, selected?.id === t.id && { backgroundColor: t.color }]}
              onPress={() => setSelected(t)}
            >
              <MaterialCommunityIcons name={t.icon as any} size={16} color={selected?.id === t.id ? '#fff' : t.color} />
              <Text style={[styles.chipText, selected?.id === t.id && { color: '#fff' }]}>{t.name}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Period selector */}
        <View style={styles.periodRow}>
          {PERIODS.map(p => (
            <TouchableOpacity
              key={p.days}
              style={[styles.periodBtn, period === p.days && styles.periodBtnActive]}
              onPress={() => setPeriod(p.days)}
            >
              <Text style={[styles.periodText, period === p.days && styles.periodTextActive]}>{p.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Chart */}
        {selected && (
          <View style={styles.chartCard}>
            <Text style={styles.chartTitle}>{selected.name}</Text>
            <Text style={styles.chartSubtitle}>{selected.unit} · last {period} days</Text>

            {hasData ? (
              selected.is_boolean ? (
                <BarChart
                  data={{ labels: data.labels, datasets: [{ data: data.values }] }}
                  width={SCREEN_WIDTH - 64}
                  height={200}
                  chartConfig={chartConfig}
                  style={styles.chart}
                  showValuesOnTopOfBars
                  yAxisLabel=""
                  yAxisSuffix=""
                  fromZero
                />
              ) : (
                <LineChart
                  data={{ labels: data.labels, datasets: [{ data: data.values }] }}
                  width={SCREEN_WIDTH - 64}
                  height={200}
                  chartConfig={chartConfig}
                  style={styles.chart}
                  bezier
                  fromZero
                  withInnerLines
                />
              )
            ) : (
              <View style={styles.noData}>
                <Text style={styles.noDataText}>No data yet for this period.</Text>
                <Text style={styles.noDataSub}>Log some entries on the Today tab!</Text>
              </View>
            )}
          </View>
        )}

        {/* Stats */}
        {selected && (
          <View style={styles.statsRow}>
            <View style={styles.statCard}>
              <Text style={[styles.statValue, { color: selected.color }]}>
                {selected.is_boolean ? doneCount : avg}
              </Text>
              <Text style={styles.statLabel}>{selected.is_boolean ? 'Days done' : 'Daily avg'}</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={[styles.statValue, { color: selected.color }]}>
                {selected.is_boolean ? `${Math.round((doneCount / period) * 100)}%` : peak}
              </Text>
              <Text style={styles.statLabel}>{selected.is_boolean ? 'Success rate' : 'Peak'}</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={[styles.statValue, { color: selected.color }]}>{period}</Text>
              <Text style={styles.statLabel}>Days</Text>
            </View>
          </View>
        )}

        {trackers.length === 0 && (
          <Text style={styles.empty}>No trackers yet. Add some in Settings!</Text>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  header: { paddingTop: 60, paddingHorizontal: theme.spacing.lg, paddingBottom: theme.spacing.md },
  title: { color: theme.colors.text, fontSize: theme.font.xxl, fontWeight: '700' },
  scroll: { padding: theme.spacing.md, paddingBottom: 40 },
  trackerScroll: { flexGrow: 0, marginBottom: theme.spacing.md },
  trackerChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: theme.colors.surface,
    borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8, marginRight: 8,
  },
  chipText: { color: theme.colors.textMuted, fontSize: theme.font.sm, fontWeight: '600' },
  periodRow: { flexDirection: 'row', gap: 8, marginBottom: theme.spacing.md },
  periodBtn: {
    flex: 1, alignItems: 'center', paddingVertical: 8,
    backgroundColor: theme.colors.surface, borderRadius: theme.radius.sm,
  },
  periodBtnActive: { backgroundColor: theme.colors.primary },
  periodText: { color: theme.colors.textMuted, fontWeight: '600', fontSize: theme.font.sm },
  periodTextActive: { color: '#fff' },
  chartCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.md,
    overflow: 'hidden',
  },
  chartTitle: { color: theme.colors.text, fontSize: theme.font.lg, fontWeight: '700' },
  chartSubtitle: { color: theme.colors.textMuted, fontSize: theme.font.sm, marginBottom: theme.spacing.md },
  chart: { borderRadius: theme.radius.md, marginLeft: -16 },
  noData: { height: 200, alignItems: 'center', justifyContent: 'center' },
  noDataText: { color: theme.colors.textMuted, fontSize: theme.font.md, fontWeight: '600' },
  noDataSub: { color: theme.colors.textMuted, fontSize: theme.font.sm, marginTop: 4 },
  statsRow: { flexDirection: 'row', gap: theme.spacing.sm },
  statCard: {
    flex: 1, backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg, padding: theme.spacing.md, alignItems: 'center',
  },
  statValue: { fontSize: theme.font.xl, fontWeight: '700' },
  statLabel: { color: theme.colors.textMuted, fontSize: theme.font.sm, marginTop: 2 },
  empty: { color: theme.colors.textMuted, textAlign: 'center', marginTop: 60 },
});
