/** A bordered content panel, matching the other demos' `.view` block. */
export function View({ title, body }: { title: string; body: string }) {
  return (
    <div className="view">
      <article>
        <header className="lead">
          <h2>{title}</h2>
          {body}
        </header>
      </article>
    </div>
  );
}
