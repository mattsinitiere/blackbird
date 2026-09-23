import Link from "next/link";

export default function FAQ() {
  return (
    <section className="mk-section mk-faq" id="questions">
      <div className="mk-section-mark">
        <span>[ 05 / 05 ]</span>
      </div>
      <div className="mk-faq-layout">
        <div>
          <h2>Good to Know.</h2>
        </div>
        <div className="mk-faq-items">
          <details open>
            <summary>Do I need special hardware?</summary>
            <p>No special scoring hardware is needed for the current app. Use your dartboard and enter your darts on a phone, tablet, or computer.</p>
          </details>
          <details>
            <summary>Do I need an account?</summary>
            <p>Yes. Play opens the Blackbird scoring app. If you’re already signed in, you go straight to your game hub. Otherwise you’ll see the sign-in page.</p>
          </details>
          <details>
            <summary>Can I practice on my own?</summary>
            <p>Yes. Play solo, take on the bot ladder, or use Bob’s 27, checkout drills, and scoring drills. Practice is recorded separately and doesn’t affect competitive Elo or standings.</p>
          </details>
          <details>
            <summary>How does the TV scoreboard work?</summary>
            <p>Choose Cast to TV during a game. Open Blackbird’s TV page in a TV browser or a browser you can cast, then enter the four-character code from your phone. Your phone becomes the scoring control.</p>
            <Link href="/tv">Open TV scoreboard</Link>
          </details>
          <details>
            <summary>Does Blackbird automatically detect my darts?</summary>
            <p>The current app uses manual score entry. Optical scoring hardware is a future direction, not a feature being offered on this site.</p>
          </details>
        </div>
      </div>
    </section>
  );
}
