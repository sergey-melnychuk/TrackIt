import { Alert } from 'react-native';
import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { NavigationContainer } from '@react-navigation/native';
import { makeTracker, resetIdCounter } from '../../test/factories';

jest.mock('../../db/trackers');
jest.mock('../../db/entries');

import * as trackersDb from '../../db/trackers';
import * as entriesDb from '../../db/entries';
import SettingsScreen from '../SettingsScreen';

const renderScreen = () =>
  render(
    <NavigationContainer>
      <SettingsScreen />
    </NavigationContainer>
  );

beforeEach(() => {
  jest.clearAllMocks();
  resetIdCounter();
  (trackersDb.getAllTrackers as jest.Mock).mockReturnValue([]);
});

describe('SettingsScreen', () => {
  it('renders tracker list', () => {
    const trackers = [makeTracker({ name: 'Protein' }), makeTracker({ name: 'Water' })];
    (trackersDb.getAllTrackers as jest.Mock).mockReturnValue(trackers);

    const { getByText } = renderScreen();
    expect(getByText('Protein')).toBeTruthy();
    expect(getByText('Water')).toBeTruthy();
  });

  it('opens create modal when Add tracker is tapped', async () => {
    const { getByText } = renderScreen();
    fireEvent.press(getByText('Add tracker'));

    await waitFor(() => {
      expect(getByText('New tracker')).toBeTruthy();
    });
  });

  it('creates a tracker with valid input', async () => {
    (trackersDb.createTracker as jest.Mock).mockReturnValue(1);
    const { getByText, getByPlaceholderText } = renderScreen();

    fireEvent.press(getByText('Add tracker'));
    await waitFor(() => getByText('New tracker'));

    fireEvent.changeText(getByPlaceholderText('e.g. Protein'), 'Sleep');
    fireEvent.changeText(getByPlaceholderText('e.g. g, ml, steps, min'), 'hours');
    fireEvent.press(getByText('Save'));

    await waitFor(() => {
      expect(trackersDb.createTracker).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'Sleep', unit: 'hours' })
      );
    });
  });

  it('shows error when saving without a name', async () => {
    const { getByText } = renderScreen();
    fireEvent.press(getByText('Add tracker'));
    await waitFor(() => getByText('New tracker'));
    fireEvent.press(getByText('Save'));

    await waitFor(() => {
      expect(Alert.alert).toHaveBeenCalledWith('Name required', expect.any(String));
    });
  });

  it('exports CSV when export button tapped', async () => {
    const FileSystem = require('expo-file-system');
    const Sharing = require('expo-sharing');
    (entriesDb.exportAllData as jest.Mock).mockReturnValue([
      { date: '2026-02-22', tracker_name: 'Protein', value: 100, unit: 'g', note: '' },
    ]);

    const { getByText } = renderScreen();
    fireEvent.press(getByText('Export as CSV'));

    await waitFor(() => {
      expect(FileSystem.writeAsStringAsync).toHaveBeenCalled();
      expect(Sharing.shareAsync).toHaveBeenCalled();
    });
  });

  it('opens edit modal with prefilled data', async () => {
    const tracker = makeTracker({ id: 1, name: 'Protein', unit: 'g' });
    (trackersDb.getAllTrackers as jest.Mock).mockReturnValue([tracker]);

    const { getByText, getByTestId } = renderScreen();
    fireEvent.press(getByTestId('edit-tracker-1'));

    await waitFor(() => {
      expect(getByText('Edit tracker')).toBeTruthy();
    });
  });
});

