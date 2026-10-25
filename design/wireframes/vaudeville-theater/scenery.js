/** Original dark paper scenery: cutout planes, puppet strings and folded mascot, using Vaudeville tokens. */
let sceneryNumber = 0;
window.TheaterArt = {
  mark() { return `<svg viewBox="0 0 80 80" aria-hidden="true"><path d="M9 26 22 8l17 27L55 8l17 18-6 36-27 12L13 60Z" fill="var(--bg-panel)" stroke="currentColor" stroke-width="2"/><path d="m22 8 5 32-18-14m46-18-6 32 23-14M13 60l26-16 27 18M39 44v30" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M25 49h4m20 0h4m-18 10h8" stroke="currentColor" stroke-width="3"/></svg>`; },
  icon(kind) {
    const p={home:'M4 14 16 4l12 10v14H4Z M12 28V17h8v11',library:'M4 5h6v24H4Z M13 5h6v24h-6Z M22 6l6-1 4 23-6 1Z',scene:'M3 9h26v20H3Z M3 9l3-6h26l-3 6 M13 15l8 5-8 5Z',editor:'M3 10h26v9H3Z M6 19v10m20-10v10 M7 6h8m-4-3v7 M22 3v7',press:'M7 11V3h18v8 M7 24H3V11h26v13h-4 M7 18h18v11H7Z'};
    return `<svg viewBox="0 0 34 34" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><path d="${p[kind]||p.home}"/></svg>`;
  },
  landscape(kind='wide') {
    const n = ++sceneryNumber;
    const box = kind==='portrait' ? '250 0 500 700' : '0 0 1000 700';
    return `<svg class="scene-art" viewBox="${box}" preserveAspectRatio="${kind==='portrait'?'xMidYMid meet':'xMidYMid slice'}" role="img" aria-label="Original atmospheric paper-cut night stage, with a folded rabbit puppet and moonlit scenery">
      <defs><radialGradient id="night-${n}"><stop offset="0" stop-color="var(--accent-deep)" stop-opacity=".35"/><stop offset="1" stop-color="var(--canvas)"/></radialGradient><radialGradient id="moon-${n}"><stop offset="0" stop-color="var(--gold)" stop-opacity=".14"/><stop offset="1" stop-color="var(--gold)" stop-opacity="0"/></radialGradient></defs>
      <path fill="var(--canvas)" d="M0 0h1000v700H0Z"/>
      <path fill="url(#night-${n})" d="M0 0h1000v700H0Z"/>
      <circle cx="650" cy="195" r="190" fill="url(#moon-${n})"/>
      <path d="M730 111a82 82 0 1 0 23 135 85 85 0 0 1-23-135Z" fill="var(--paper)" stroke="var(--hard)" stroke-width="5"/>
      <path d="M725 117a72 72 0 1 0 19 121" fill="none" stroke="var(--gold)" stroke-width="1"/>
      <g fill="var(--gold-soft)"><path d="m262 149 4-12 4 12 12 4-12 4-4 12-4-12-12-4Z"/><path d="m422 73 3-9 3 9 9 3-9 3-3 9-3-9-9-3Z"/><path d="m833 91 3-9 3 9 9 3-9 3-3 9-3-9-9-3Z"/><path d="m152 265 2-6 2 6 6 2-6 2-2 6-2-6-6-2Z"/><path d="m586 125 2-6 2 6 6 2-6 2-2 6-2-6-6-2Z"/></g>
      <path d="M426 76V0m410 94V0m-570 59V0" stroke="var(--line)" stroke-width="1"/>
      <path d="m0 437 122-139 95 56 165-121 136 114 149-75 111 100 115-66 107 74v320H0Z" fill="var(--bg-panel)" stroke="var(--hard)" stroke-width="5"/>
      <path d="m0 437 122-139 95 56 165-121 136 114 149-75 111 100 115-66 107 74" fill="none" stroke="var(--accent-deep)" stroke-width="1.5"/>
      <path d="m0 515 147-99 154 74 153-56 198 36 185-91 163 119v202H0Z" fill="var(--bg-elev)" stroke="var(--hard)" stroke-width="6"/>
      <path d="m0 515 147-99 154 74 153-56 198 36 185-91 163 119" fill="none" stroke="var(--accent)" stroke-width="1.5"/>
      <g fill="var(--bg-panel)" stroke="var(--hard)" stroke-width="5"><path d="m48 566 68-280 47 151-25-8 50 123-43-10 25 72H70Z"/><path d="m780 517 48-258 41 144-25-6 51 102-40-4 39 88H795Z"/></g>
      <path d="m116 286 12 279m700-306 17 306" stroke="var(--accent-deep)" stroke-width="1.5"/>
      <path d="m0 619 182-70 201 42 121-47 182 69 162-24 152 58v53H0Z" fill="var(--canvas)" stroke="var(--hard)" stroke-width="7"/>
      <path d="m0 619 182-70 201 42 121-47 182 69 162-24 152 58" fill="none" stroke="var(--brand-deep)" stroke-width="2"/>
      <g transform="translate(393 284)">
        <path d="m0 244 46-69-16-130 34-17 48 140 64-128 29 28-65 131 36 87-85 54-100-33Z" fill="var(--hard)" transform="translate(7 9)"/>
        <path d="m0 244 46-69-16-130 34-17 48 140 64-128 29 28-65 131 36 87-85 54-100-33Z" fill="var(--bg-panel)" stroke="var(--accent-soft)" stroke-width="2" stroke-linejoin="round"/>
        <path d="m46 175 18-147 48 140 64-128-36 159-49 53Z" fill="var(--accent-deep)" stroke="var(--hard)" stroke-width="2"/>
        <path d="m46 175 45 77 49-53 36 87-85 54-100-33Z" fill="var(--bg-higher)" stroke="var(--hard)" stroke-width="2"/>
        <path d="m46 175 45 77-100 55m100-55v88m0-88 85 34" fill="none" stroke="var(--accent-soft)" stroke-width="1.5"/>
        <circle cx="60" cy="229" r="4" fill="var(--ink)"/><circle cx="123" cy="230" r="4" fill="var(--ink)"/>
        <path d="m84 256 14-1-7 9Z" fill="var(--brand-soft)"/>
        <path d="M65 29V-170m114 41V-170" stroke="var(--line)" stroke-width="1"/>
      </g>
      <path d="M0 685h1000" stroke="var(--gold)" stroke-width="2"/>
      <path d="m340 665 157-33 153 41-132 22Z" fill="var(--bg-panel)" stroke="var(--hard)" stroke-width="2"/>
    </svg>`;
  },
};
