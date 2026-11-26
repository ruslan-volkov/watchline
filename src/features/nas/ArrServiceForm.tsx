import { useEffect, useState } from 'react';
import { Alert, Keyboard, Pressable, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/Button';
import { TextField } from '@/components/TextField';
import { useTheme } from '@/contexts/ThemeContext';
import {
  describeArrError,
  fetchQualityProfiles,
  fetchRootFolders,
  testConnection,
  type QualityProfile,
  type RootFolder,
} from './api';
import { normalizeUrl, serviceLabels, type ArrConfig, type ArrService } from './config';
import { useNasConfig } from './NasConfigContext';

const defaultPorts: Record<ArrService, number> = { radarr: 7878, sonarr: 8989 };

type Status =
  | { kind: 'idle' }
  | { kind: 'testing' }
  | { kind: 'ok'; version: string }
  | { kind: 'error'; message: string };

function Chips<T>({
  items,
  isActive,
  label,
  onPick,
}: {
  items: T[];
  isActive: (item: T) => boolean;
  label: (item: T) => string;
  onPick: (item: T) => void;
}) {
  const { colors } = useTheme();
  return (
    <View style={styles.chips}>
      {items.map((item) => {
        const active = isActive(item);
        return (
          <Pressable
            key={label(item)}
            onPress={() => onPick(item)}
            style={[styles.chip, { backgroundColor: active ? colors.accent : colors.surfaceAlt }]}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
          >
            <Text
              style={[
                styles.chipText,
                { color: active ? colors.accentText : colors.textSecondary },
              ]}
            >
              {label(item)}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/**
 * Address, key and defaults for one NAS service. Saving tests the connection
 * first, so what is stored has been seen to work; the profile and root-folder
 * choices come from what the NAS itself reports.
 */
export function ArrServiceForm({ service }: { service: ArrService }) {
  const { colors } = useTheme();
  const { config, loaded, save, clear } = useNasConfig();
  const saved = config[service];
  const label = serviceLabels[service];

  const [url, setUrl] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [status, setStatus] = useState<Status>({ kind: 'idle' });
  const [profiles, setProfiles] = useState<QualityProfile[]>([]);
  const [folders, setFolders] = useState<RootFolder[]>([]);

  const connect = async (target: { url: string; apiKey: string }) => {
    const version = await testConnection(service, target);
    const [profileList, folderList] = await Promise.all([
      fetchQualityProfiles(target),
      fetchRootFolders(target),
    ]);
    return { version, profileList, folderList };
  };

  // Reopening the screen with a saved config: show it and re-read the NAS's
  // lists, so the pickers are there and a NAS that went away is noticed.
  useEffect(() => {
    if (!loaded || !saved) return;
    setUrl(saved.url);
    setApiKey(saved.apiKey);
    setStatus({ kind: 'testing' });
    connect(saved)
      .then(({ version, profileList, folderList }) => {
        setProfiles(profileList);
        setFolders(folderList);
        setStatus({ kind: 'ok', version });
      })
      .catch((e) => setStatus({ kind: 'error', message: describeArrError(e, service) }));
    // Once, when the stored config arrives; later edits go through onSave.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded]);

  const onSave = async () => {
    // The status and pickers appear below the fields, behind the keyboard.
    Keyboard.dismiss();
    const normalized = normalizeUrl(url);
    if (!normalized) {
      setStatus({
        kind: 'error',
        message: `Adresse invalide. Exemple : 192.168.1.20:${defaultPorts[service]}`,
      });
      return;
    }
    const key = apiKey.trim();
    setStatus({ kind: 'testing' });
    try {
      const { version, profileList, folderList } = await connect({ url: normalized, apiKey: key });
      // Keep earlier choices while the NAS still has them; otherwise start from
      // the first it lists, visibly selected, so a download always has a target.
      const profileId = profileList.some((p) => p.id === saved?.qualityProfileId)
        ? (saved?.qualityProfileId ?? null)
        : (profileList[0]?.id ?? null);
      const rootPath = folderList.some((f) => f.path === saved?.rootFolderPath)
        ? (saved?.rootFolderPath ?? null)
        : (folderList[0]?.path ?? null);
      await save(service, {
        url: normalized,
        apiKey: key,
        qualityProfileId: profileId,
        rootFolderPath: rootPath,
      });
      setUrl(normalized);
      setProfiles(profileList);
      setFolders(folderList);
      setStatus({ kind: 'ok', version });
    } catch (e) {
      setStatus({ kind: 'error', message: describeArrError(e, service) });
    }
  };

  const pick = (patch: Partial<ArrConfig>) => {
    if (saved) void save(service, { ...saved, ...patch });
  };

  const confirmClear = () => {
    Alert.alert(
      `Supprimer ${label} ?`,
      'L’adresse et la clé API seront effacées de cet appareil.',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: async () => {
            await clear(service);
            setUrl('');
            setApiKey('');
            setProfiles([]);
            setFolders([]);
            setStatus({ kind: 'idle' });
          },
        },
      ],
    );
  };

  const testing = status.kind === 'testing';

  return (
    <View>
      <TextField
        label="Adresse"
        testID={`nas-${service}-url`}
        value={url}
        onChangeText={setUrl}
        placeholder={`192.168.1.20:${defaultPorts[service]}`}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="url"
      />
      <TextField
        label="Clé API"
        testID={`nas-${service}-key`}
        value={apiKey}
        onChangeText={setApiKey}
        placeholder="Réglages → Général → Clé API"
        autoCapitalize="none"
        autoCorrect={false}
        secureTextEntry
      />

      {status.kind === 'ok' ? (
        <Text style={[styles.status, { color: colors.success }]}>
          Connecté · {label} {status.version}
        </Text>
      ) : status.kind === 'error' ? (
        <Text style={[styles.status, { color: colors.danger }]}>{status.message}</Text>
      ) : null}

      {profiles.length > 0 ? (
        <>
          <Text style={[styles.pickerLabel, { color: colors.textSecondary }]}>
            Profil de qualité
          </Text>
          <Chips
            items={profiles}
            isActive={(p) => p.id === saved?.qualityProfileId}
            label={(p) => p.name}
            onPick={(p) => pick({ qualityProfileId: p.id })}
          />
        </>
      ) : null}
      {folders.length > 0 ? (
        <>
          <Text style={[styles.pickerLabel, { color: colors.textSecondary }]}>Dossier</Text>
          <Chips
            items={folders}
            isActive={(f) => f.path === saved?.rootFolderPath}
            label={(f) => f.path}
            onPick={(f) => pick({ rootFolderPath: f.path })}
          />
        </>
      ) : null}

      <Button
        label="Tester et enregistrer"
        testID={`nas-${service}-save`}
        onPress={onSave}
        loading={testing}
        disabled={!url.trim() || !apiKey.trim()}
        style={{ marginTop: 8 }}
      />
      {saved ? (
        <Button
          label={`Supprimer ${label}`}
          variant="secondary"
          onPress={confirmClear}
          style={{ marginTop: 10 }}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  status: { fontSize: 13, fontWeight: '600', marginBottom: 14, marginLeft: 4, lineHeight: 18 },
  pickerLabel: { fontSize: 13, fontWeight: '600', marginBottom: 8, marginLeft: 4 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 },
  chip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999 },
  chipText: { fontSize: 13, fontWeight: '600' },
});
