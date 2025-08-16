export const metadata = {
  title: 'Pharmacy Queue (Thai TTS)',
  description: 'Pharmacy queue caller with Thai TTS',
};
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="th">
      <body style={{ fontFamily: 'system-ui, sans-serif', background: '#0b1020', color: '#e6ecff' }}>
        {children}
      </body>
    </html>
  );
}
