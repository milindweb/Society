/* Logo.tsx — the society crest, rendered as the app's brand mark.
 *
 * The crest ships as a static asset (`public/logo.png`), generated from the
 * source image at the repository root by `scripts/generate_icons.py`.
 *
 * It is also admin-configurable — SRS §15 lists the society logo alongside the
 * society name, and `SocietyConfig.logo` carries a Drive `FileRef` — so a
 * config-supplied `src` takes precedence when one exists, falling back to the
 * bundled crest if that URL fails to load. The backend does not populate
 * `logoFileRef` yet, so today the fallback is always what renders; wiring it up
 * later is a one-line change at the call sites.
 */

import { useState } from 'react';

/** Bundled fallback. Lives in `public/` because the favicon set needs
 *  root-absolute URLs from the same directory. */
const BUNDLED_LOGO = '/logo.png';

interface LogoProps {
  /** Config-supplied logo URL (`SocietyConfig.logo?.url`). */
  src?: string;
  /** Rendered size in px; the crest is square. */
  size?: number;
  /** Empty by default — the crest is decorative wherever the society name is
   *  already rendered as text beside it, so announcing it would duplicate. */
  alt?: string;
  className?: string;
}

export function Logo({ src, size = 32, alt = '', className = '' }: LogoProps) {
  /* Records *which* URL failed rather than a boolean, so a changed `src`
     retries automatically without an effect to reset the flag. */
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const resolved = src && src !== failedSrc ? src : BUNDLED_LOGO;

  return (
    <img
      src={resolved}
      alt={alt}
      width={size}
      height={size}
      className={`hs-logo ${className}`}
      style={{ width: size, height: size }}
      onError={src ? () => setFailedSrc(src) : undefined}
    />
  );
}
