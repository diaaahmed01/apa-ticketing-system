/** Small inline spinner for buttons that are working. Pair it with `disabled` and the "is-busy" class. */
export function Spinner({ className }: { className?: string }) {
  return <span className={"spinner" + (className ? " " + className : "")} role="presentation" aria-hidden="true" />;
}
