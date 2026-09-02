import { ImageResponse } from "next/og";

export const runtime = "nodejs";
export const alt = "VeloBot — AI chatbots trained on your content, with human escalation built in.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const INDIGO = "#4F46E5";
const INDIGO_LIGHT = "#818CF8";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          position: "relative",
          background: "linear-gradient(135deg, #0A0D1C 0%, #12112E 45%, #1B1749 100%)",
          overflow: "hidden",
        }}
      >
        {/* soft glow behind the mark */}
        <div
          style={{
            position: "absolute",
            top: -180,
            left: -140,
            width: 700,
            height: 700,
            borderRadius: "50%",
            background: `radial-gradient(circle, ${INDIGO} 0%, rgba(79,70,229,0) 70%)`,
            opacity: 0.55,
            display: "flex",
          }}
        />
        <div
          style={{
            position: "absolute",
            bottom: -220,
            right: -160,
            width: 640,
            height: 640,
            borderRadius: "50%",
            background: `radial-gradient(circle, ${INDIGO_LIGHT} 0%, rgba(129,140,248,0) 70%)`,
            opacity: 0.35,
            display: "flex",
          }}
        />

        {/* faint dot grid texture */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            backgroundImage:
              "radial-gradient(rgba(255,255,255,0.09) 1.6px, transparent 1.6px)",
            backgroundSize: "34px 34px",
            opacity: 0.5,
          }}
        />

        {/* content */}
        <div
          style={{
            position: "relative",
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            padding: "0 96px",
            width: "100%",
            height: "100%",
          }}
        >
          {/* logo lockup */}
          <div style={{ display: "flex", alignItems: "center", gap: 22, marginBottom: 44 }}>
            <div
              style={{
                width: 92,
                height: 92,
                borderRadius: 24,
                background: `linear-gradient(160deg, ${INDIGO_LIGHT} 0%, ${INDIGO} 100%)`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                position: "relative",
                boxShadow: "0 18px 40px rgba(79,70,229,0.45)",
              }}
            >
              {/* antenna */}
              <div
                style={{
                  position: "absolute",
                  top: 10,
                  width: 4,
                  height: 14,
                  borderRadius: 2,
                  background: "white",
                  display: "flex",
                }}
              />
              <div
                style={{
                  position: "absolute",
                  top: 4,
                  width: 9,
                  height: 9,
                  borderRadius: "50%",
                  background: "white",
                  display: "flex",
                }}
              />
              {/* ears */}
              <div
                style={{
                  position: "absolute",
                  left: 6,
                  top: 40,
                  width: 8,
                  height: 16,
                  borderRadius: 4,
                  background: "white",
                  display: "flex",
                }}
              />
              <div
                style={{
                  position: "absolute",
                  right: 6,
                  top: 40,
                  width: 8,
                  height: 16,
                  borderRadius: 4,
                  background: "white",
                  display: "flex",
                }}
              />
              {/* head */}
              <div
                style={{
                  width: 58,
                  height: 46,
                  borderRadius: 14,
                  background: "white",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 12,
                }}
              >
                <div style={{ width: 11, height: 11, borderRadius: "50%", background: INDIGO, display: "flex" }} />
                <div style={{ width: 11, height: 11, borderRadius: "50%", background: INDIGO, display: "flex" }} />
              </div>
            </div>
            <span
              style={{
                fontSize: 58,
                fontWeight: 700,
                color: "white",
                letterSpacing: "-0.02em",
              }}
            >
              VeloBot
            </span>
          </div>

          {/* eyebrow pill */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "9px 20px",
              borderRadius: 999,
              border: "1px solid rgba(129,140,248,0.45)",
              background: "rgba(129,140,248,0.12)",
              alignSelf: "flex-start",
              marginBottom: 28,
            }}
          >
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#A5B4FC", display: "flex" }} />
            <span style={{ fontSize: 22, color: "#C7D2FE", fontWeight: 600, letterSpacing: "0.02em" }}>
              AI support, trained on your content
            </span>
          </div>

          {/* headline */}
          <div
            style={{
              display: "flex",
              fontSize: 54,
              fontWeight: 700,
              color: "white",
              lineHeight: 1.15,
              letterSpacing: "-0.02em",
              maxWidth: 980,
              marginBottom: 20,
            }}
          >
            Answer customers instantly. Escalate to your team when it matters.
          </div>

          {/* subhead */}
          <div
            style={{
              display: "flex",
              fontSize: 27,
              color: "#A5ADCB",
              lineHeight: 1.5,
              maxWidth: 860,
            }}
          >
            AI chatbots trained on your content, with human escalation built in.
          </div>
        </div>
      </div>
    ),
    { ...size }
  );
}
