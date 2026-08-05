import { ScrollViewStyleReset } from 'expo-router/html';
import type { PropsWithChildren } from 'react';

export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="bn">
      <head>
        <meta charSet="utf-8" />
        <meta
          content="width=device-width, initial-scale=1, maximum-scale=1, viewport-fit=cover"
          name="viewport"
        />
        <meta content="#F7FAF7" name="theme-color" />
        <meta
          content="ব্যক্তিগত daily plan, integrated Quran, offline audio এবং guided recitation সহ mobile-first Hifz app."
          name="description"
        />
        <meta content="হিফজ · আজ কী পড়বেন, app ঠিক করবে" property="og:title" />
        <meta
          content="ব্যক্তিগত daily plan, integrated Quran এবং distraction-free guided session."
          property="og:description"
        />
        <meta content="/social-card.jpg" property="og:image" />
        <link href="/manifest.json" rel="manifest" />
        <link href="/favicon.png" rel="icon" />
        <ScrollViewStyleReset />
        <style dangerouslySetInnerHTML={{ __html: responsiveBackground }} />
        <script dangerouslySetInnerHTML={{ __html: serviceWorkerScript }} />
      </head>
      <body>{children}</body>
    </html>
  );
}

const responsiveBackground = `
  html, body, #root { min-height: 100%; background: #F7FAF7; }
  body { margin: 0; overflow: hidden; }
  * { box-sizing: border-box; }
`;

const serviceWorkerScript = `
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js'));
  }
`;
