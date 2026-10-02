import { ImageResponse } from "next/og";

// Apple touch icons must be a raster format, so this renders the same mark to
// a PNG at build time rather than shipping a checked-in binary.
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#2f5d4a",
        }}
      >
        <svg width="140" height="140" viewBox="0 0 32 32">
          <path
            d="M16 5c6.2 3.6 8.6 10.4 4.8 16.3A8.4 8.4 0 0 1 16 25a8.4 8.4 0 0 1-4.8-3.7C7.4 15.4 9.8 8.6 16 5Z"
            fill="#ffffff"
          />
          <path
            d="M16 9.5v15"
            stroke="#2f5d4a"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
          <path
            d="M16 15.5 12.4 12M16 19.5l3.6-3.5"
            stroke="#2f5d4a"
            strokeWidth="1.6"
            strokeLinecap="round"
          />
        </svg>
      </div>
    ),
    size,
  );
}
