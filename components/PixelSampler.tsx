import { useEffect, useRef } from 'react';
import { StyleSheet } from 'react-native';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';

import type { RGB } from '../lib/color';

type PixelSamplerProps = {
  // A data URI like "data:image/jpeg;base64,...". Pass null when there's
  // nothing to sample yet.
  imageUri: string | null;
  onSample: (color: RGB) => void;
  onError: (message: string) => void;
};

// How much of the image (by width/height) counts as the "center" region
// we average — 0.6 means the middle 60%, per CLAUDE.md's spec.
const CENTER_FRACTION = 0.6;

// This HTML runs inside the hidden WebView, not in React Native. It draws
// the photo onto a <canvas> and reads back the average color of the
// center rectangle — a real browser engine can do this; React Native
// can't, which is the whole reason this component exists.
function buildSamplerHtml(imageUri: string): string {
  return `
    <!DOCTYPE html>
    <html>
      <body style="margin:0">
        <canvas id="canvas"></canvas>
        <script>
          const centerFraction = ${CENTER_FRACTION};
          const image = new Image();

          image.onload = function () {
            const canvas = document.getElementById('canvas');
            canvas.width = image.width;
            canvas.height = image.height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(image, 0, 0);

            const cropWidth = Math.round(image.width * centerFraction);
            const cropHeight = Math.round(image.height * centerFraction);
            const cropX = Math.round((image.width - cropWidth) / 2);
            const cropY = Math.round((image.height - cropHeight) / 2);

            const pixels = ctx.getImageData(cropX, cropY, cropWidth, cropHeight).data;

            let rSum = 0, gSum = 0, bSum = 0;
            const pixelCount = pixels.length / 4;
            for (let i = 0; i < pixels.length; i += 4) {
              rSum += pixels[i];
              gSum += pixels[i + 1];
              bSum += pixels[i + 2];
            }

            const result = {
              r: Math.round(rSum / pixelCount),
              g: Math.round(gSum / pixelCount),
              b: Math.round(bSum / pixelCount),
            };
            window.ReactNativeWebView.postMessage(JSON.stringify(result));
          };

          image.onerror = function () {
            window.ReactNativeWebView.postMessage(JSON.stringify({ error: 'Could not load image' }));
          };

          image.src = "${imageUri}";
        </script>
      </body>
    </html>
  `;
}

// Renders an invisible WebView that samples the average color of the
// center of a photo. Give it an imageUri and it calls onSample (or
// onError) once that image has been processed.
export function PixelSampler({ imageUri, onSample, onError }: PixelSamplerProps) {
  const handledRef = useRef(false);

  // Every time we get a new photo to sample, allow one more result through.
  useEffect(() => {
    handledRef.current = false;
  }, [imageUri]);

  if (!imageUri) return null;

  function handleMessage(event: WebViewMessageEvent) {
    if (handledRef.current) return; // ignore duplicate messages for the same photo
    handledRef.current = true;

    const data = JSON.parse(event.nativeEvent.data);
    if ('error' in data) {
      onError(data.error);
    } else {
      onSample(data);
    }
  }

  return (
    <WebView
      originWhitelist={['*']}
      source={{ html: buildSamplerHtml(imageUri) }}
      onMessage={handleMessage}
      style={styles.hidden}
    />
  );
}

const styles = StyleSheet.create({
  hidden: {
    position: 'absolute',
    width: 1,
    height: 1,
    opacity: 0,
  },
});
