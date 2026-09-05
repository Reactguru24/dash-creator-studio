/** EuroVirtuals wordmark. Swaps artwork between light and dark palettes. */
export const LOGO_DARK_URL = "/eurovirtuals-logo.png";
export const LOGO_LIGHT_URL = "/eurovirtuals-logo-light.png";

export function BrandLogo({ className = "" }: { className?: string }) {
  return (
    <>
      <img
        src={LOGO_LIGHT_URL}
        alt="EuroVirtuals — built to perform"
        className={`${className} dark:hidden`}
      />
      <img
        src={LOGO_DARK_URL}
        alt="EuroVirtuals — built to perform"
        aria-hidden="true"
        className={`hidden ${className} dark:block`}
      />
    </>
  );
}
