// JIT mode: the compiler must be loaded before the first component compiles.
// That is the price of running Angular inside the shared Vite playground —
// no ngtsc build step, templates compile in the browser instead.
import '@angular/compiler';
import { provideZonelessChangeDetection } from '@angular/core';
import { APP_BASE_HREF } from '@angular/common';
import { bootstrapApplication } from '@angular/platform-browser';
import { provideRouter } from '@angular/router';
import { provideGlyphnav } from 'glyphnav/angular-router';
import { AppComponent } from './app.component';
import { routes } from './routes';

bootstrapApplication(AppComponent, {
  providers: [
    // Zoneless: the demo drives the UI with signals, so no zone.js is needed.
    provideZonelessChangeDetection(),
    // The app lives under /angular-router/ in the playground; the glyphnav
    // navigator animates base-aware URLs via Location.prepareExternalUrl.
    { provide: APP_BASE_HREF, useValue: import.meta.env.BASE_URL + 'angular-router/' },
    provideRouter(routes),
    provideGlyphnav({ duration: 250, commit: 'before' }),
  ],
}).catch((err) => console.error(err));
