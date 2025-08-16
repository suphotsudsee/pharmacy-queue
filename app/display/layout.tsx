
export const metadata = { title: 'TV Display - Pharmacy Queue' };
export default function DisplayLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="th">
      <body style={{ margin: 0 }}>{children}</body>
    </html>
  );
}
