/* Share-card layouts rendered by Satori (next/og). Follows the TrackShare design spec:
 * 1080 × 1080, padding 72 / 72 / 40, footer rule with wordmark and domain.
 * Satori rules: every element with more than one child needs display:flex; sizes are border-box. */
import type { CSSProperties, ReactNode } from "react";
import type { Dictionary } from "@/i18n";
import type { Palette } from "@/lib/palette";
import type { MediaInfo } from "@/lib/types";

export const CARD_SIZE = 1080;

export interface CardProps {
  info: MediaInfo;
  cover: string;
  palette: Palette;
  domain: string;
  labels: Dictionary["card"];
  /** The title and names are exactly what the service returned. Playlists never show it. */
  verified: boolean;
}

const SANS = "Bricolage Grotesque, Inter Tight";
const MONO = "JetBrains Mono";

const trackCountLabel = (info: MediaInfo) =>
  `${info.trackCount}${info.trackCountIsMinimum ? "+" : ""}`;

/* ---------- Icons (Lucide paths, stroke 2) ---------- */

function Icon({ size, color, children }: { size: number; color: string; children: ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {children}
    </svg>
  );
}

const AudioWaveform = ({ size, color }: { size: number; color: string }) => (
  <Icon size={size} color={color}>
    <path d="M2 13a2 2 0 0 0 2-2V7a2 2 0 0 1 4 0v13a2 2 0 0 0 4 0V4a2 2 0 0 1 4 0v13a2 2 0 0 0 4 0v-4a2 2 0 0 1 2-2" />
  </Icon>
);

const Disc3 = ({ size, color }: { size: number; color: string }) => (
  <Icon size={size} color={color}>
    <circle cx="12" cy="12" r="10" />
    <path d="M6 12c0-1.7.7-3.2 1.8-4.2" />
    <circle cx="12" cy="12" r="2" />
    <path d="M18 12c0 1.7-.7 3.2-1.8 4.2" />
  </Icon>
);

/** Shown when the title and names are exactly what the service returned. */
const BadgeCheck = ({ size, color }: { size: number; color: string }) => (
  <Icon size={size} color={color}>
    <path d="M3.85 8.62a4 4 0 0 1 4.78-4.77 4 4 0 0 1 6.74 0 4 4 0 0 1 4.78 4.78 4 4 0 0 1 0 6.74 4 4 0 0 1-4.77 4.78 4 4 0 0 1-6.75 0 4 4 0 0 1-4.78-4.77 4 4 0 0 1 0-6.76Z" />
    <path d="m9 12 2 2 4-4" />
  </Icon>
);

/** TrackShare mark: disc with a share arrow. */
const Mark = ({ color }: { color: string }) => (
  <svg width={28} height={28} viewBox="0 0 28 28" fill="none" stroke={color} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="16" r="10" />
    <circle cx="12" cy="16" r="2.6" fill={color} stroke="none" />
    <path d="M8.8 21.54 A6.4 6.4 0 0 1 6.76 12.33" />
    <path d="M18 4h7v7" />
    <path d="M25 4l-8 8" />
  </svg>
);

/* ---------- Shared parts ---------- */

function Footer({ domain, palette }: { domain: string; palette: Palette }) {
  return (
    <div
      style={{
        display: "flex",
        flexShrink: 0,
        width: "100%",
        height: 54,
        paddingTop: 20,
        borderTop: `2px solid ${palette.rule}`,
        alignItems: "center",
        justifyContent: "space-between",
        color: palette.foreground,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <Mark color={palette.foreground} />
        <div style={{ fontFamily: SANS, fontSize: 24, fontWeight: 700, letterSpacing: -0.24 }}>TrackShare</div>
      </div>
      <div style={{ fontFamily: MONO, fontSize: 18, letterSpacing: 1.44, textTransform: "uppercase", color: palette.muted }}>
        {domain}
      </div>
    </div>
  );
}

const titleStyle: CSSProperties = {
  display: "block",
  marginTop: 44,
  maxWidth: 936,
  fontFamily: SANS,
  fontSize: 60,
  lineHeight: 1.05,
  fontWeight: 700,
  letterSpacing: -1.2,
  textAlign: "center",
  overflow: "hidden",
  lineClamp: 2,
};

const artistStyle: CSSProperties = {
  display: "block",
  marginTop: 14,
  maxWidth: 936,
  fontFamily: SANS,
  fontSize: 32,
  lineHeight: 1.2,
  fontWeight: 500,
  textAlign: "center",
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
};

function SpotlightFrame({ palette, domain, header, art, info, verified }: {
  palette: Palette;
  domain: string;
  header: ReactNode;
  art: ReactNode;
  info: MediaInfo;
  verified: boolean;
}) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        width: CARD_SIZE,
        height: CARD_SIZE,
        padding: "72px 72px 40px",
        background: palette.background,
        color: palette.foreground,
        fontFamily: SANS,
      }}
    >
      <div
        style={{
          display: "flex",
          width: "100%",
          height: 32,
          alignItems: "center",
          gap: 12,
          fontFamily: MONO,
          fontSize: 24,
          color: palette.muted,
        }}
      >
        {header}
        {verified ? <BadgeCheck size={30} color={palette.muted} /> : null}
      </div>
      <div style={{ display: "flex", marginTop: 40, flexShrink: 0 }}>{art}</div>
      <div style={titleStyle}>{info.title}</div>
      {info.artists.length > 0 && (
        <div style={{ ...artistStyle, color: palette.muted }}>{info.artists.join(", ")}</div>
      )}
      <div style={{ display: "flex", flexGrow: 1 }} />
      <Footer domain={domain} palette={palette} />
    </div>
  );
}

/* ---------- Track ---------- */

export function TrackCard({ info, cover, palette, domain, verified }: CardProps) {
  return (
    <SpotlightFrame
      info={info}
      palette={palette}
      domain={domain}
      verified={verified}
      header={<AudioWaveform size={30} color={palette.muted} />}
      art={
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={cover}
          width={600}
          height={600}
          style={{ borderRadius: 12, objectFit: "cover" }}
        />
      }
    />
  );
}

/* ---------- Album ---------- */

function Disc({ accent }: { accent: string }) {
  const ring = (size: number, child: ReactNode) => (
    <div
      style={{
        display: "flex",
        width: size,
        height: size,
        borderRadius: size / 2,
        border: "2px solid rgba(255,255,255,0.08)",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {child}
    </div>
  );
  return (
    <div
      style={{
        display: "flex",
        position: "absolute",
        left: 230,
        top: 20,
        width: 560,
        height: 560,
        borderRadius: 280,
        background: "#111013",
        boxShadow: "0 30px 80px rgba(0,0,0,0.45)",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {ring(
        480,
        ring(
          380,
          <div
            style={{
              display: "flex",
              width: 190,
              height: 190,
              borderRadius: 95,
              background: accent,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <div style={{ display: "flex", width: 22, height: 22, borderRadius: 11, background: "#111013" }} />
          </div>,
        ),
      )}
    </div>
  );
}

export function AlbumCard({ info, cover, palette, domain, verified }: CardProps) {
  return (
    <SpotlightFrame
      info={info}
      palette={palette}
      domain={domain}
      verified={verified}
      // Satori ignores `gap` across fragments, so pass a flat array.
      header={[
        <Disc3 key="disc" size={30} color={palette.muted} />,
        ...(info.trackCount !== undefined
          ? [
              <AudioWaveform key="wave" size={26} color={palette.muted} />,
              <div key="n">{trackCountLabel(info)}</div>,
            ]
          : []),
      ]}
      art={
        <div style={{ display: "flex", position: "relative", width: 800, height: 600 }}>
          <Disc accent={palette.accent} />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={cover}
            width={600}
            height={600}
            style={{
              position: "absolute",
              left: 0,
              top: 0,
              borderRadius: 12,
              objectFit: "cover",
            }}
          />
        </div>
      }
    />
  );
}

/* ---------- Playlist ---------- */

function MetaPair({ label, value, ink }: { label: string; value: string; ink: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <div>{label}</div>
      <div style={{ display: "block", color: ink, maxWidth: 256, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
        {value}
      </div>
    </div>
  );
}

export function PlaylistCard({ info, cover, palette, domain, labels }: CardProps) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        width: CARD_SIZE,
        height: CARD_SIZE,
        padding: "72px 72px 40px",
        background: palette.background,
        color: palette.foreground,
        fontFamily: SANS,
      }}
    >
      <div style={{ display: "flex", gap: 40, flexShrink: 0 }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={cover} width={640} height={640} style={{ borderRadius: 8, objectFit: "cover" }} />
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            width: 256,
            height: 640,
            fontFamily: MONO,
            fontSize: 20,
            lineHeight: 1.4,
            letterSpacing: 1.6,
            textTransform: "uppercase",
            color: palette.muted,
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ display: "flex", width: "100%", height: 6, background: palette.accent }} />
            {info.trackCount !== undefined && (
              <div style={{ display: "flex", alignItems: "center", gap: 14, color: palette.foreground }}>
                <AudioWaveform size={44} color={palette.foreground} />
                <div style={{ fontFamily: SANS, fontSize: 48, lineHeight: 1, fontWeight: 500, letterSpacing: -0.48 }}>
                  {trackCountLabel(info)}
                </div>
              </div>
            )}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
            <MetaPair label={labels.type} value={labels.playlist} ink={palette.foreground} />
            {info.curator && <MetaPair label={labels.curatedBy} value={info.curator} ink={palette.foreground} />}
            <MetaPair label={labels.source} value={info.sourceName} ink={palette.foreground} />
          </div>
        </div>
      </div>
      <div
        style={{
          display: "block",
          margin: "auto 0",
          fontSize: 96,
          lineHeight: 1,
          fontWeight: 700,
          letterSpacing: -3.36,
          overflow: "hidden",
          lineClamp: 2,
        }}
      >
        {info.title}
      </div>
      <Footer domain={domain} palette={palette} />
    </div>
  );
}

export function Card(props: CardProps) {
  if (props.info.kind === "album") return <AlbumCard {...props} />;
  if (props.info.kind === "playlist") return <PlaylistCard {...props} />;
  return <TrackCard {...props} />;
}
