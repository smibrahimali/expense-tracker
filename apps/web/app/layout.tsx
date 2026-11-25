import './globals.css';
import type { Metadata } from 'next';
import { Geist } from 'next/font/google';
import { Toaster } from 'sonner';

const geist = Geist({
  subsets: ['latin'],
  variable: '--font-geist',
  weight: ['400', '500', '600'],
});

export const metadata: Metadata = {
  title: 'ExpenseFlow',
  description: 'Personal finance and expense tracking',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={geist.variable}>
      <body className={`${geist.className} text-[var(--ef-ink)] antialiased min-h-screen`}>
        {children}
        <Toaster
          theme="dark"
          position="bottom-center"
          toastOptions={{
            className:
              '!rounded-[var(--ef-radius-sm)] !border-[var(--ef-border)] !shadow-[var(--ef-shadow-md)] !bg-[var(--ef-surface-elevated)] !text-[var(--ef-ink)]',
          }}
        />
      </body>
    </html>
  );
}
