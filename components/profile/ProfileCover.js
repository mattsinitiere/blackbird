/**
 * The profile banner: a styled cover (no upload), with the Blackbird mark.
 * Purely decorative, so it is hidden from assistive technology.
 */
export default function ProfileCover() {
  return (
    <div className="pf-cover" aria-hidden="true">
      <span className="pf-cover-kicker">EVERY DART COUNTS.</span>
      <img className="pf-cover-mark" src="/brand/icon-white.svg" alt="" width="30" height="30" />
      <span className="pf-cover-big">PLAY ON.</span>
    </div>
  );
}
