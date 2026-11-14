import heroImage from "../assets/davv/hero-takshashila.jpg";
import nalandaGate from "../assets/davv/nalanda-gate.jpg";
import iipsImage from "../assets/davv/iips.jpg";
import scsitImage from "../assets/davv/scsit.jpg";
import soiImage from "../assets/davv/soi.jpg";
import sdsfImage from "../assets/davv/sdsf.jpg";
import soexImage from "../assets/davv/soex.jpg";
import auditoriumImage from "../assets/davv/auditorium.jpg";
import techSymposiumImg from "../assets/images/poster_tech_symposium_1794562917520.jpg";
import culturalNightImg from "../assets/images/poster_cultural_night_1794562918072.jpg";
import cseBootcampImg from "../assets/images/poster_cse_bootcamp_1794562919295.jpg";
import eceSeminarImg from "../assets/images/poster_ece_seminar_1794562919419.jpg";

export const DAVV_HERO_IMAGE = heroImage;
export const DAVV_AUDITORIUM_IMAGE = auditoriumImage;
export const DAVV_NALANDA_GATE = nalandaGate;

export const DAVV_SCHOOL_IMAGES: Record<string, string> = {
  IIPS: iipsImage,
  SCSIT: scsitImage,
  SoI: soiImage,
  SDSF: sdsfImage,
  SOEX: soexImage,
};

const LOCAL_POSTER_MAP: Record<string, string> = {
  "/src/assets/images/poster_tech_symposium_1794562917520.jpg": techSymposiumImg,
  "/src/assets/images/poster_cultural_night_1794562918072.jpg": culturalNightImg,
  "/src/assets/images/poster_cse_bootcamp_1794562919295.jpg": cseBootcampImg,
  "/src/assets/images/poster_ece_seminar_1794562919419.jpg": eceSeminarImg,
};

function isIbbViewerUrl(rawUrl: string): boolean {
  try {
    const host = new URL(rawUrl).hostname.toLowerCase();
    return host === "ibb.co" || host === "www.ibb.co" || host === "imgbb.com" || host === "www.imgbb.com";
  } catch {
    return false;
  }
}

export function resolvePosterUrl(posterUrl: string | null | undefined): string | null {
  if (!posterUrl) return null;
  if (LOCAL_POSTER_MAP[posterUrl]) return LOCAL_POSTER_MAP[posterUrl];
  // ibb.co links open a gallery page. The image file lives on i.ibb.co.
  if (isIbbViewerUrl(posterUrl)) {
    return `/api/posters/resolve?url=${encodeURIComponent(posterUrl)}`;
  }
  return posterUrl;
}
