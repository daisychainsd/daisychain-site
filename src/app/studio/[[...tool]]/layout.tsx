export const metadata = {
  title: "Daisy Chain Records — Studio",
};

// The studio is wrapped by the root layout's Header/Footer/main padding, which
// shrinks the available height and causes Studio's lists/panels to clip at the
// bottom. Overlay the studio with position:fixed so it always fills the actual
// viewport regardless of parent layout chrome.
export default function StudioLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        background: "var(--color-bg-deep, #0a0e14)",
        overflow: "hidden",
      }}
    >
      {children}
    </div>
  );
}
