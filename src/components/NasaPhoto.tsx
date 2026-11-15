import { nasaPhotoUrl, type NasaPhoto as Photo } from "../data/nasa-media";
import { ExternalIcon } from "./icons";

/** One NASA Image Library photo with EMBER's caption, NASA's credit and a link to the record. */
export function NasaPhoto({ photo, shared = false, compact = false }: { photo: Photo; shared?: boolean; compact?: boolean }) {
  return (
    <figure className={`nasa-photo ${compact ? "compact" : ""}`}>
      <a href={nasaPhotoUrl(photo.nasaId)} target="_blank" rel="noreferrer" title={`NASA: “${photo.nasaSays}”`}>
        <img src={photo.src} alt={photo.nasaSays} loading="lazy" decoding="async" />
      </a>
      <figcaption>
        {shared && <span className="badge">Shared hardware</span>} {photo.caption}
        {photo.note && <span className="nasa-photo-note"> {photo.note}</span>}
        <span className="nasa-credit">
          Credit: NASA{photo.photographer && !photo.photographer.startsWith("NASA") ? ` / ${photo.photographer}` : photo.photographer ? ` (${photo.photographer.replace(/^NASA\/\w+\//, "")})` : ""} · {photo.center} · {photo.date} ·{" "}
          <a href={nasaPhotoUrl(photo.nasaId)} target="_blank" rel="noreferrer">{photo.nasaId} <ExternalIcon /></a>
        </span>
      </figcaption>
    </figure>
  );
}
