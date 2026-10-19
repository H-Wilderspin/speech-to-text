import { useRef } from 'react';

export function DisconnectGitHub({ onDisconnect }: { onDisconnect: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  return <>
    <button ref={trigger} onClick={() => dialog.current?.showModal()}>Disconnect GitHub</button>
    <dialog ref={dialog} className="disconnect-confirmation" role="alertdialog"
      aria-labelledby="disconnect-title" aria-describedby="disconnect-description"
      onCancel={event => event.stopPropagation()}
      onClose={event => { event.stopPropagation(); trigger.current?.focus(); }}>
      <h3 id="disconnect-title">Disconnect GitHub?</h3>
      <p id="disconnect-description">This removes editing access and any saved connection from this browser.
        You’ll need to enter the GitHub token again to edit meals, tasks or shopping. Your saved lists will stay.</p>
      <form method="dialog" className="meal-actions">
        <button autoFocus>Keep connected</button>
        <button type="button" className="disconnect-confirm" onClick={onDisconnect}>Disconnect</button>
      </form>
    </dialog>
  </>;
}
