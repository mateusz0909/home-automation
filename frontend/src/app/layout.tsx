import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Curtain Control · Smart Architecture',
  description: 'Architectural smart curtain motor controller and sunrise wake-up manager',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="bg-background text-foreground min-h-screen">
        <div
          dangerouslySetInnerHTML={{
            __html: `<!--
THESIS: An architectural, tactile smart home cockpit for physical motorized curtains that replaces generic cards and emoji-cluttered buttons with an interactive drapery stage, circadian dawn illumination, and zero backend leakage.
OWN-WORLD: Deep graphite and slate chassis (#080A0F, #11141E, #1C2234) with precision micro-chamfers, warm dawn-amber solar illumination (#F59E0B / #FDE68A), tabular monospace telemetry, and crisp Lucide micro-icons.
STORY: The user sees physical window state and daylight level at a glance, commands instant position via direct drag or tactile stops, and manages gentle sunrise wake-up choreography without friction.
FIRST VIEWPORT: Telemetry header with Tuya sync status; center stage featuring dual-parted interactive curtain elevation with daylight glow; percentage display with direct scrub rail and tactile preset stops (0, 25, 50, 75, 100); secondary row with Sunrise Routine card and Schedule status.
FORM: The Architectural Cockpit; seed key b2da85ee.
FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance.
-->`,
          }}
          style={{ display: 'contents' }}
        />
        {children}
      </body>
    </html>
  );
}
