import { ImageResponse } from "next/og";

// Home-screen icon (iOS renders its own corner radius over a square PNG)
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          background: "#171717",
          display: "flex",
          alignItems: "flex-end",
          justifyContent: "center",
          gap: 10,
          padding: 32,
          position: "relative",
        }}
      >
        <div style={{ width: 24, height: 40, background: "#22c55e", opacity: 0.55, borderRadius: 6 }} />
        <div style={{ width: 24, height: 64, background: "#22c55e", opacity: 0.75, borderRadius: 6 }} />
        <div style={{ width: 24, height: 92, background: "#22c55e", borderRadius: 6 }} />
        <div
          style={{
            position: "absolute",
            top: 24,
            right: 24,
            width: 56,
            height: 56,
            borderRadius: 28,
            background: "#fbbf24",
            border: "5px solid #d97706",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 32,
            fontWeight: 700,
            color: "#92400e",
          }}
        >
          $
        </div>
      </div>
    ),
    size
  );
}
