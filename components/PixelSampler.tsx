import { useEffect, useRef } from 'react';
import { StyleSheet } from 'react-native';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';

import type { RGB } from '../lib/color';

type PixelSamplerProps = {
  // A data URI like "data:image/jpeg;base64,...". Pass null when there's
  // nothing to sample yet.
  imageUri: string | null;
  onSample: (tileColors: RGB[]) => void;
  onError: (message: string) => void;
};

// The whole image is divided into a GRID_SIZE x GRID_SIZE grid of tiles.
// Each tile's average color becomes one candidate patch that
// lib/bestPatch.ts ranks against the target color. We scan the full
// image (not just the center) because the target-colored object could
// be anywhere in frame.
const GRID_SIZE = 32;

// This HTML runs inside the hidden WebView, not in React Native. It draws
// the photo onto a <canvas> and reads back per-tile average colors using
// getImageData — a real browser engine can do this; React Native can't,
// which is the whole reason this component exists. The Lab/deltaE math
// that ranks these tiles lives in lib/color.ts and lib/bestPatch.ts, not
// here, so it isn't duplicated in two languages.
function buildSamplerHtml(imageUri: string): string {
  return `
    <!DOCTYPE html>
    <html>
      <body style="margin:0">
        <canvas id="canvas"></canvas>
        <script>
          const gridSize = ${GRID_SIZE};
          const image = new Image();

          image.onload = function () {
            const canvas = document.getElementById('canvas');
            canvas.width = image.width;
            canvas.height = image.height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(image, 0, 0);

            const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
            const tileWidth = canvas.width / gridSize;
            const tileHeight = canvas.height / gridSize;

            const sums = [];
            for (let i = 0; i < gridSize * gridSize; i++) {
              sums.push({ r: 0, g: 0, b: 0, count: 0 });
            }

            // One pass over every pixel, adding it into whichever tile
            // bucket it falls in — much faster than calling
            // getImageData separately for each of the 1024 tiles.
            for (let y = 0; y < canvas.height; y++) {
              const tileRow = Math.min(gridSize - 1, Math.floor(y / tileHeight));
              for (let x = 0; x < canvas.width; x++) {
                const tileCol = Math.min(gridSize - 1, Math.floor(x / tileWidth));
                const pixelIndex = (y * canvas.width + x) * 4;
                const tile = sums[tileRow * gridSize + tileCol];
                tile.r += pixels[pixelIndex];
                tile.g += pixels[pixelIndex + 1];
                tile.b += pixels[pixelIndex + 2];
                tile.count += 1;
              }
            }

            const tiles = sums
              .filter(function (tile) { return tile.count > 0; })
              .map(function (tile) {
                return {
                  r: Math.round(tile.r / tile.count),
                  g: Math.round(tile.g / tile.count),
                  b: Math.round(tile.b / tile.count),
                };
              });

            window.ReactNativeWebView.postMessage(JSON.stringify({ tiles: tiles }));
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

// Renders an invisible WebView that scans a photo and returns one
// average color per grid tile, covering the whole image. Give it an
// imageUri and it calls onSample (or onError) once that image has been
// processed.
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
      onSample(data.tiles);
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
