import { useCallback, useState } from "react";
import { Modal } from "./ui";
import { isBot, playerLabel } from "@/lib/bots";

/**
 * Hold a finished game for one tap before it is saved, so a mis-entered
 * winning dart can still be undone. The play screen calls `finish(match)`
 * where it used to call onFinish, renders `confirmBar`, and passes `onUndo`,
 * which takes back the last dart (the screen's own undo). A bot's win is
 * saved straight away: nobody types a bot's darts.
 */
export function useFinishConfirm({ onFinish, onUndo }) {
  const [pending, setPending] = useState(null);
  const finish = useCallback(
    (match) => {
      if (match.winner && isBot(match.winner)) return onFinish(match);
      setPending(match);
    },
    [onFinish]
  );
  const confirmBar = pending ? (
    <Modal labelledBy="finish-confirm-title" onClose={() => { setPending(null); onUndo(); }}>
      <h3 id="finish-confirm-title" className="section-title" style={{ fontSize: "calc(18px * var(--fs))" }}>
        {pending.winner ? (pending.players?.length > 1 ? `Game shot: ${playerLabel(pending.winner)} wins` : "Game complete") : "Game complete"}
      </h3>
      <p className="subtle" style={{ marginTop: 0 }}>
        Save the result, or undo the last dart if it was entered by mistake.
      </p>
      <div className="row" style={{ marginTop: 16 }}>
        <button
          className="btn"
          style={{ flex: 1 }}
          onClick={() => {
            setPending(null);
            onUndo();
          }}
        >
          Undo Last Dart
        </button>
        <button
          className="btn btn-primary"
          style={{ flex: 1 }}
          autoFocus
          onClick={() => {
            const m = pending;
            setPending(null);
            onFinish(m);
          }}
        >
          Save Result
        </button>
      </div>
    </Modal>
  ) : null;
  return { finish, confirmBar, confirming: !!pending };
}
