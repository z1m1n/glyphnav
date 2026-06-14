/** A bordered content panel, matching the other demos' `.view` block. */
export function View({ title, body }: { title: string; body: string }) {
  return (
    <div className="view">
      <h2>{title}</h2>
      <p>{body}</p>
    </div>
  );
}
