import { ImageResponse } from "next/og";

// Home-screen icon (iOS renders its own corner radius over a square PNG).
// Same artwork as components/Logo.tsx: ascending bars, gold cap on the tallest.
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          background: "#101b14",
          display: "flex",
          alignItems: "flex-end",
          justifyContent: "center",
          gap: 14,
          paddingBottom: 34,
        }}
      >
        <div style={{ width: 28, height: 37, background: "#2f9e63", borderRadius: 7 }} />
        <div style={{ width: 28, height: 65, background: "#3cc878", borderRadius: 7 }} />
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <div style={{ width: 28, height: 28, background: "#f2b52a", borderRadius: 8 }} />
          <div style={{ width: 28, height: 70, background: "#52e695", borderRadius: 7 }} />
        </div>
      </div>
    ),
    size
  );
}
