import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-icon', standalone: true,
  styles: [':host{display:inline-flex;align-items:center;justify-content:center;flex-shrink:0;line-height:0}svg{display:block}'],
  template: `<svg [attr.width]="size" [attr.height]="size" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">
    @switch (name) {
      @case ('search') { <circle cx="10.8" cy="10.8" r="6.8"/><path d="m16 16 4.5 4.5"/> }
      @case ('person') { <circle cx="12" cy="8" r="3.5"/><path d="M4 21v-2a8 8 0 0 1 16 0v2"/> }
      @case ('id') { <rect x="3" y="5" width="18" height="14" rx="3"/><circle cx="8" cy="11" r="2"/><path d="M5 16c0-3 6-3 6 0m3-6h4m-4 4h4"/> }
      @case ('building') { <rect x="5" y="3" width="14" height="18" rx="2"/><path d="M9 7h1m4 0h1m-6 4h1m4 0h1m-6 4h1m4 0h1m-5 6v-3h2v3"/> }
      @case ('phone') { <path d="M7 3H4a1 1 0 0 0-1 1c0 9.4 7.6 17 17 17a1 1 0 0 0 1-1v-3l-5-2-2 2a14 14 0 0 1-7-7l2-2-2-5Z"/> }
      @case ('map') { <path d="M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 0 1 14 0Z"/><circle cx="12" cy="10" r="2.5"/> }
      @case ('car') { <path d="m5 7 2-4h10l2 4m-16 4 2-4h14l2 4v7H3v-7Zm2 7v3m14-3v3M3 12h18m-15 3h1m10 0h1"/> }
      @case ('shield') { <path d="m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6l8-3Z"/><path d="m8.5 11.5 2.5 2.5 4.5-5"/> }
      @case ('history') { <path d="M3 11a9 9 0 1 1 2.8 7M3 5v6h6m3-4v5l3 2"/> }
      @case ('logout') { <path d="M9 4H5v16h4m5-13 5 5-5 5m-6-5h11"/> }
      @case ('arrow') { <path d="M4 12h16m-6-6 6 6-6 6"/> }
      @case ('print') { <path d="M7 8V3h10v5M7 17H3V9h18v8h-4M7 14h10v7H7v-7Zm10-3h1"/> }
      @case ('copy') { <rect x="8" y="8" width="13" height="13" rx="2"/><path d="M16 8V3H3v13h5"/> }
      @case ('check') { <path d="m5 12 4 4L19 6"/> }
      @case ('close') { <path d="m6 6 12 12M6 18 18 6"/> }
      @case ('note') { <path d="m15 4 5 5M4 20l5-1L21 7l-5-5L4 14v6Z"/> }
      @case ('alert') { <path d="m12 3 10 18H2L12 3Zm0 6v5m0 3v1"/> }
      @case ('grid') { <rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/> }
      @case ('database') { <ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v14c0 4 16 4 16 0V5M4 12c0 4 16 4 16 0"/> }
      @case ('lock') { <rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V6a4 4 0 0 1 8 0v4m-4 4v3"/> }
      @case ('mail') { <rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 6 9 7 9-7"/> }
      @case ('calendar') { <rect x="4" y="5" width="16" height="16" rx="2"/><path d="M8 3v4m8-4v4M4 11h16m-11 4h1m4 0h1"/> }
      @default { <path d="M4 6h16M4 12h16M4 18h10"/> }
    }
  </svg>`,
})
export class IconComponent {
  @Input() name = 'search';
  @Input() size = 20;
}
