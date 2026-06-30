<script lang="ts">
  export let title: string;
  export let body: string;
</script>

<div class="view">
  <article>
    <header class="lead">
      <h2>{title}</h2>
      {@html body}
    </header>
  </article>
</div>
