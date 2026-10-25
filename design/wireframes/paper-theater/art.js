/** Original vector paper props and cutout cast for the theater design study. */
window.PaperArt = {
  icon(name) {
    const shapes = {
      home: '<path d="M4 14 16 4l12 10v14H4Z"/><path d="M12 28V17h8v11"/>',
      scenes: '<path d="M3 9h26v20H3Z"/><path d="m3 9 3-6h26l-3 6M9 3l3 6m4-6 3 6m4-6 3 6"/><path d="m13 15 8 5-8 5Z"/>',
      library: '<path d="M4 5h6v24H4Zm9 0h6v24h-6Zm9 1 6-1 4 23-6 1Z"/><path d="M4 10h6m3 0h6m5 1 6-1"/>',
      workbench: '<path d="M3 10h26v9H3Zm3 9v10m20-10v10M7 6h8m-4-3v7M22 3v7"/>',
      press: '<path d="M7 11V3h18v8M7 24H3V11h26v13h-4M7 18h18v11H7Z"/><path d="M11 22h10m-10 3h7"/>',
      agent: '<path d="M4 5h24v18H14l-7 6v-6H4Z"/><path d="M10 11h12m-12 5h8"/>',
      settings: '<path d="M4 7h24M4 16h24M4 25h24"/><path d="M9 3v8m14 1v8M12 21v8"/>',
      themes: '<path d="m16 3 13 8-13 18L3 11Z"/><path d="m3 11 13 4 13-4m-13 4v14M16 3v12"/>',
      hare: '<path d="M9 17 7 4l5-1 4 13 4-13 5 2-4 13c8 3 7 12-5 12S1 20 9 17Z"/><path d="M12 22h1m6 0h1m-5 4h3"/>',
    };
    return `<svg viewBox="0 0 34 34" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round" aria-hidden="true">${shapes[name] || shapes.themes}</svg>`;
  },
  bunny() {
    return '<svg viewBox="0 0 100 100" aria-hidden="true"><path d="M12 36 23 10l18 34 19-34 17 27 9 35-35 20L14 72Z" fill="var(--rose)" stroke="var(--pt-ink)" stroke-width="3"/><path d="m23 10 8 42-19-16m48 8 17-7-17-27M14 72l36-16 36 16M50 56l1 36" fill="none" stroke="var(--pt-ink)" stroke-width="2"/><path d="M32 59h4m28 0h4m-21 12h9" stroke="var(--pt-ink)" stroke-width="4"/></svg>';
  },
  title() {
    return `<svg class="stage-art" viewBox="0 0 1000 570" preserveAspectRatio="xMidYMid slice" role="img" aria-label="A miniature folded-paper night forest with a lighthouse, little houses and hanging stars">
      <path fill="var(--stage-deck)" d="M0 0h1000v570H0Z"/>
      <path class="sky ink" d="m0 0 185 18 157-12 170 12 185-11 150 10 153-17v570H0Z"/>
      <path fill="var(--deck-preset-deep)" d="m0 150 1000-50v470H0Z"/>
      <path class="cream ink" d="m166 83 12-24 13 24 26 4-19 18 4 27-24-13-23 13 4-27-19-18Z"/>
      <path class="cream ink" d="m804 63 8-16 8 16 17 3-12 12 2 18-15-9-15 9 3-18-13-12Z"/>
      <path class="cream ink" d="m720 150 7-15 8 15 16 2-12 12 3 16-15-8-14 8 3-16-12-12Z"/>
      <path d="M179 61V0m633 47V0m-83 135V0" stroke="var(--deck-regex)" stroke-width="1" stroke-dasharray="4 4"/>
      <path fill="var(--deck-lorebook-deep)" class="ink" d="m0 355 152-144 133 113 154-102 129 115 153-131 155 134 124-97v327H0Z"/>
      <path class="green ink" d="m0 442 120-79 179 46 161-40 210 53 162-59 168 61v146H0Z"/>
      <path class="deep ink" d="m0 504 176-35 192 43 121-24 162 27 165-48 184 30v73H0Z"/>
      <path class="green ink" d="m128 415 48-124 55 124-36-12 30 46-41-10v51h-17v-51l-39 10 25-45Z"/>
      <path d="m176 291-1 158m-47-34 47-22 56 22" fill="none" stroke="var(--stage-ink)" stroke-width="1.5"/>
      <path class="deep ink" d="m90 467 31-97 39 97-27-6 18 34h-49l15-34Z"/>
      <path class="cream ink" d="m814 408 16-108 19 108-4 83h-28Z"/>
      <path class="pink ink" d="m807 401 24-16 25 16v13h-49Z"/>
      <path class="plum ink" d="m830 300-14 17h29Z"/>
      <path fill="var(--stage-ink)" d="M825 436h12v18h-12Z"/>
      <path class="plum ink" d="m218 470 46-30 49 30v42h-95Z"/>
      <path class="pink ink" d="m205 472 58-51 65 51-14 10-51-35-48 35Z"/>
      <path class="cream ink" d="M250 480h20v32h-20Zm36 3h13v14h-13Z"/>
      <path class="paper ink" d="m622 484 40-18 42 23-36 12Z"/>
      <path class="cream ink" d="m658 466 5-49 40 72Z"/>
      <path d="m663 417 5 84" stroke="var(--stage-ink)" stroke-width="1.5"/>
      <path class="cream ink" d="m420 553 66-37 97 40-33 14H414Z"/>
    </svg>`;
  },
  stage(person = 'Vera', portrait = false) {
    const violet = person !== 'Vera';
    return `<svg class="stage-art" viewBox="${portrait ? '190 0 250 400' : '0 0 640 400'}" preserveAspectRatio="xMidYMid slice" role="img" aria-label="Original paper-cut illustration of ${person} on a miniature harbor stage">
      <path class="sky" d="M0 0h640v400H0Z"/>
      <path class="cream ink" d="m85 80 28-14 22 14-8 30h-31Z"/>
      <path class="paper ink" d="m430 78 30-24 43 3 25 21-50 12Z"/>
      <path class="green ink" d="m0 240 105-110 75 70 85-78 105 127 74-64 80 70 116-73v218H0Z"/>
      <path class="deep ink" d="m0 325 118-41 116 30 125-34 109 35 172-39v124H0Z"/>
      <path class="paper ink" d="m492 130 22-37 22 37-4 162h-37Z"/>
      <path class="pink ink" d="M490 130h48v18h-48Zm12 41h25v20h-25Z"/>
      <path class="cream ink" d="m0 371 320-20 320 20v29H0Z"/>
      <path class="paper ink" d="m205 351 92-36 68 40-72 19Z"/>
      <path class="${violet ? 'plum' : 'deep'} ink" d="m258 209 65-13 45 143-71 20-69-22Z"/>
      <path class="skin ink" d="m260 132 54-20 43 37-13 54-38 20-42-27Z"/>
      <path class="${violet ? 'plum' : 'deep'} ink" d="m251 160 7-54 51-35 51 42 8 64-25-25-18-28-46 40Z"/>
      <path class="cream ink" d="m260 215 43 28 26-39-7 96-25 24Z"/>
      <path class="skin ink" d="m260 222-35 44 11 16 40-26m61-32 34 26-10 25-26-30"/>
      <path class="paper ink" d="m352 252 36-20 23 33-38 22Z"/>
      <path class="plum ink" d="m274 333-7 30 29 6 7-30m28-4 10 29 29-9-13-31"/>
      <path d="M282 168h6m34-2h6m-28 26h14" fill="none" stroke="var(--stage-ink)" stroke-width="3"/>
      <path d="m264 197 39 46 41-40M303 243l-6 81m-59-57 24-20" fill="none" stroke="var(--deck-character-deep)" stroke-width="1.5"/>
      <path d="M276 107V0m63 109V0" stroke="var(--deck-preset-deep)" stroke-width="1" stroke-dasharray="5 4"/>
    </svg>`;
  },
};
