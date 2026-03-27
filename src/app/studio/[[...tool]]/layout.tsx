export const metadata = {
  title: "Daisy Chain Records — Studio",
};

export default function StudioLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <div style={{ height: "100vh" }}>{children}</div>;
}
