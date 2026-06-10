import { Directive, HostListener, Input, inject } from '@angular/core';
import { GLYPHNAV } from 'glyphnav/angular-router';

/**
 * A drop-in, animated alternative to `routerLink`.
 *
 *   <a href="/about" glyphnavLink="/about">About</a>
 *
 * Copy this into your own app — because glyphnav's package is built by Vite (not
 * Angular's ngtsc), the directive must be compiled by *your* Angular build.
 */
@Directive({ selector: '[glyphnavLink]' })
export class GlyphnavLinkDirective {
  @Input('glyphnavLink') link = '';

  private readonly navigator = inject(GLYPHNAV);

  @HostListener('click', ['$event'])
  onClick(event: MouseEvent): void {
    // Let the browser handle modified clicks (new tab, etc.).
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
      return;
    }
    event.preventDefault();
    void this.navigator.navigateByUrl(this.link);
  }
}
