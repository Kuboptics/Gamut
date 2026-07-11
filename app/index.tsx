import { useState } from 'react';
import { Button, StyleSheet, Text, View } from 'react-native';
import * as ImageManipulator from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';

import { PixelSampler } from '../components/PixelSampler';
import { rgbToHex, type RGB } from '../lib/color';

// TEMPORARY test screen for the PixelSampler component (step 4 of the
// build plan). This gets replaced by the real "Today" screen in step 6.
// Pick a photo and this shows the average color PixelSampler read from
// its center — a way to confirm the WebView pixel-sampling trick works
// on a real phone before building the rest of the app on top of it.
export default function HomeScreen() {
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [result, setResult] = useState<RGB | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function pickAndSample() {
    setResult(null);
    setError(null);

    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setError('No permission to access photos');
      return;
    }

    const picked = await ImagePicker.launchImageLibraryAsync({ quality: 1 });
    if (picked.canceled) return;

    // Shrink the photo before sampling — the WebView doesn't need to load
    // a full multi-megapixel photo just to average its pixels.
    const manipulated = await ImageManipulator.manipulateAsync(
      picked.assets[0].uri,
      [{ resize: { width: 200 } }],
      { base64: true, format: ImageManipulator.SaveFormat.JPEG }
    );

    setImageUri(`data:image/jpeg;base64,${manipulated.base64}`);
  }

  return (
    <View style={styles.container}>
      <Text style={styles.text}>Color Hunt — sampler test</Text>
      <Button title="Pick a photo to test the sampler" onPress={pickAndSample} />
      {result && (
        <>
          <View style={[styles.swatch, { backgroundColor: rgbToHex(result) }]} />
          <Text style={styles.text}>{rgbToHex(result)}</Text>
        </>
      )}
      {error && <Text style={styles.text}>{error}</Text>}
      <PixelSampler
        imageUri={imageUri}
        onSample={(color) => setResult(color)}
        onError={(message) => setError(message)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  text: {
    color: '#FFFFFF',
    fontSize: 16,
  },
  swatch: {
    width: 100,
    height: 100,
  },
});
