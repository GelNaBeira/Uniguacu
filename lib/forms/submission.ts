type SubmitEvent = { preventDefault: () => void };

// O cancelamento ocorre sincronamente, antes de validação/await/transição.
export function preventNativeSubmit(event: SubmitEvent, start: (action: () => Promise<void>) => void, submit: () => Promise<void>) {
  event.preventDefault();
  start(submit);
}