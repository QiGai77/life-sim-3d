/**
 * Hand-drawn, picture-book style inline SVG icons (original artwork for this project).
 * Ink outlines are slightly wobbly on purpose; fills use the muted 绘本 palette.
 * The shared <filter id="ink"> (defined in index.html) roughens the strokes a touch.
 */
const INK = '#4b3a2f';
const S = `stroke="${INK}" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"`;
const s = (w: number) => `stroke="${INK}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"`;
const svg = (body: string, vb = '0 0 48 48') => `<svg viewBox="${vb}" aria-hidden="true"><g filter="url(#ink)">${body}</g></svg>`;

export const PAL = {
  cream: '#f7efdf',
  paper: '#fbf6ea',
  terracotta: '#c9765c',
  terraLight: '#e8a58c',
  sage: '#93a98a',
  sageLight: '#c3d1b5',
  blue: '#7f97b3',
  blueLight: '#bccbdb',
  mustard: '#dcae55',
  blush: '#eab3a6',
  ink: INK,
};

export const ICON = {
  bottle: svg(`
    <path d="M20.5 9.5 C20.6 6.4 22 4.6 24 4.5 C26.1 4.6 27.4 6.4 27.5 9.6" fill="#f1cfae" ${S}/>
    <path d="M16.8 10.6 L31.3 10.4 L31.6 15.2 L16.6 15.4 Z" fill="${PAL.sage}" ${S}/>
    <path d="M17.2 15.6 C14.6 18.4 14.3 21 14.5 25 L14.8 37.5 C14.9 41.2 17 43.4 20.6 43.5 L27.6 43.4 C31.2 43.3 33.3 41.1 33.4 37.6 L33.6 24.8 C33.6 20.8 33.2 18.3 30.8 15.5" fill="#fdf8ee" ${S}/>
    <path d="M15.2 28.2 C19 27.2 23 29.4 26.6 28.4 C29 27.8 31 27.6 33.3 28.4 L33.2 37.4 C33.1 40.6 31.4 42.2 27.6 42.2 L20.6 42.3 C17.4 42.2 15.9 40.6 15.8 37.4 Z" fill="#f6e3c3"/>
    <path d="M19.8 21 L23 21 M19.8 25.2 L22 25.2 M19.8 33 L23 33" ${s(1.8)}/>`),
  moon: svg(`
    <path d="M29.5 6.5 C20 7 12.6 14.8 12.8 24.6 C13 34.4 21.2 42 31 41.4 C35.4 41.1 38.8 39.4 41.2 36.8 C30.8 37.9 23.4 30.6 23.2 21.6 C23 15.2 25.6 9.6 29.5 6.5 Z" fill="#f3dca2" ${S}/>
    <path d="M36.2 9.6 L37.4 12.6 L40.4 13.4 L37.6 14.8 L36.8 17.8 L35.4 15 L32.4 14.2 L35.2 12.8 Z" fill="${PAL.mustard}" ${s(1.6)}/>
    <circle cx="40.6" cy="22.4" r="1.4" fill="${INK}"/>
    <path d="M20.8 26.2 C21.6 27.4 23 27.4 23.8 26.4" ${s(1.8)} fill="none"/>`),
  heart: svg(`
    <path d="M24.2 41.2 C14.6 34.8 7.4 28.6 7.6 19.6 C7.8 13.6 12 9.4 17 9.6 C20.4 9.8 22.8 11.8 24.2 14.6 C25.6 11.6 28.2 9.6 31.6 9.6 C36.8 9.6 40.6 13.8 40.4 19.8 C40.2 28.6 33.4 34.8 24.2 41.2 Z" fill="${PAL.terraLight}" ${S}/>
    <path d="M13.4 17.6 C13.8 15.6 15.2 14.4 17.2 14.2" ${s(2)} stroke="#fff6ea" fill="none"/>`),
  star: svg(`
    <path d="M24 5.8 L28.8 17 L40.8 18 L31.6 25.8 L34.6 37.8 L24.2 31.4 L13.6 37.8 L16.6 25.8 L7.2 18.2 L19.4 17 Z" fill="#f2d48a" ${S}/>
    <circle cx="20.8" cy="22.6" r="1.3" fill="${INK}"/><circle cx="27.4" cy="22.6" r="1.3" fill="${INK}"/>
    <path d="M21.6 26.4 C23 27.8 25.2 27.8 26.6 26.4" ${s(1.8)} fill="none"/>`),
  hand: svg(`
    <path d="M15.2 27.4 L15.2 15.4 C15.2 13.2 16.8 12 18.4 12 C20 12 21.4 13.2 21.4 15.4 L21.4 23 L21.6 10.4 C21.6 8.2 23.2 7 24.8 7 C26.4 7 28 8.2 28 10.4 L27.8 23 L28.2 12.6 C28.2 10.6 29.8 9.4 31.4 9.4 C33 9.4 34.4 10.6 34.4 12.8 L34.2 24.4 L34.8 18 C35 16.2 36.4 15.2 37.8 15.4 C39.4 15.6 40.4 16.8 40.2 18.8 L39.4 30.4 C38.8 38.4 33.6 42.6 26.6 42.6 C20.6 42.6 17.4 39.8 14.4 36 L9.2 29.4 C8 27.8 8.4 26 9.8 25.2 C11.2 24.4 12.8 24.8 13.8 26.2 Z" fill="#f6d2b8" ${S}/>
    <path d="M23.4 34.6 C25 35.8 27.6 35.8 29.2 34.6" ${s(1.8)} fill="none"/>`),
  drop: svg(`
    <path d="M14.6 13.8 L14.6 24.2 C14.6 26 16 27.2 17.6 27.2 C19.2 27.2 20.4 26 20.4 24.2 L20.6 18 L20.6 28.6 C20.6 30.6 22 31.8 23.8 31.8 C25.6 31.8 27 30.6 27 28.6 L27 18 L27.2 26.4 C27.2 28.2 28.6 29.4 30.2 29.4 C31.8 29.4 33.2 28.2 33.2 26.4 L33.4 16.4 C33.4 11.4 29.8 8 24 8 C18.4 8 14.6 10.6 14.6 13.8 Z" fill="#f6d2b8" ${S}/>
    <path d="M24 34.6 L24 43 M19.6 39 L24 43.4 L28.4 39" ${s(2.6)} fill="none"/>`),
  mouth: svg(`
    <path d="M8.6 22.4 C13 17.4 19 16.4 24 19 C29 16.4 35 17.4 39.4 22.4 C36.2 32 30.8 36 24 36 C17.2 36 11.8 32 8.6 22.4 Z" fill="${PAL.terraLight}" ${S}/>
    <path d="M12.4 23.6 C18 25.8 30 25.8 35.6 23.6 C32.6 30 28.6 32.6 24 32.6 C19.4 32.6 15.4 30 12.4 23.6 Z" fill="#9c4a45"/>
    <path d="M18.6 28.6 C21.6 27 26.4 27 29.4 28.6 C27.8 30.8 26 31.6 24 31.6 C22 31.6 20.2 30.8 18.6 28.6 Z" fill="#e47d78"/>`),
  cry: svg(`
    <path d="M24 6.4 C34 6.4 41.6 14 41.6 24 C41.6 34 34 41.6 24 41.6 C14 41.6 6.4 34 6.4 24 C6.4 14 14 6.4 24 6.4 Z" fill="#f6dcc0" ${S}/>
    <path d="M13.4 20.4 C15.4 18.6 18.2 18.6 20.2 20.6 M27.8 20.6 C29.8 18.6 32.6 18.6 34.6 20.4" ${s(2.2)} fill="none"/>
    <path d="M18.4 33.4 C19.6 29.6 22 28.4 24 28.4 C26 28.4 28.4 29.6 29.6 33.4 C26 32 22 32 18.4 33.4 Z" fill="#9c4a45" ${s(2)}/>
    <path d="M15.4 24.2 C13.6 27.6 13.8 30.4 15.6 31 C17.4 30.4 17.4 27.6 15.4 24.2 Z" fill="${PAL.blueLight}" ${s(1.6)}/>
    <path d="M32.8 24.2 C31 27.6 31.2 30.4 33 31 C34.8 30.4 34.8 27.6 32.8 24.2 Z" fill="${PAL.blueLight}" ${s(1.6)}/>`),
  laugh: svg(`
    <path d="M24 6.4 C34 6.4 41.6 14 41.6 24 C41.6 34 34 41.6 24 41.6 C14 41.6 6.4 34 6.4 24 C6.4 14 14 6.4 24 6.4 Z" fill="#f6dcc0" ${S}/>
    <path d="M13.6 21.4 C15.2 18.6 18.6 18.6 20.2 21.4 M27.8 21.4 C29.4 18.6 32.8 18.6 34.4 21.4" ${s(2.2)} fill="none"/>
    <path d="M14.4 26.4 C17.4 27.6 30.6 27.6 33.6 26.4 C32.4 33 28.6 36.4 24 36.4 C19.4 36.4 15.6 33 14.4 26.4 Z" fill="#9c4a45" ${s(2)}/>
    <path d="M19.4 32.6 C22 31 26 31 28.6 32.6 C27.2 34.6 25.6 35.2 24 35.2 C22.4 35.2 20.8 34.6 19.4 32.6 Z" fill="#e47d78"/>
    <ellipse cx="11.6" cy="27.6" rx="2.8" ry="1.8" fill="${PAL.blush}"/><ellipse cx="36.4" cy="27.6" rx="2.8" ry="1.8" fill="${PAL.blush}"/>`),
  board: svg(`
    <path d="M11.6 9.6 L36.6 9.2 C38.2 9.2 39.2 10.2 39.2 11.8 L39.6 40.4 C39.6 42 38.6 43 37 43 L12 43.2 C10.4 43.2 9.4 42.2 9.4 40.6 L9.2 12.2 C9.2 10.6 10.2 9.6 11.6 9.6 Z" fill="${PAL.paper}" ${S}/>
    <path d="M18.4 6.2 L29.8 6.2 C30.8 6.2 31.4 6.8 31.4 7.8 L31.4 12.2 L16.8 12.4 L16.8 7.8 C16.8 6.8 17.4 6.2 18.4 6.2 Z" fill="${PAL.terracotta}" ${S}/>
    <path d="M14.6 21.4 L17.4 24.2 L22.2 18.6 M14.6 32.4 L17.4 35.2 L22.2 29.6" ${s(2.4)} stroke="${PAL.sage}" fill="none"/>
    <path d="M26 22 L34.4 21.8 M26 33 L33 32.8" ${s(2.2)} fill="none"/>`),
  check: svg(`<path d="M8.4 25.6 C11.6 28 14.8 31.4 17.6 35.4 C22.6 25.6 29.6 17 39.6 10.6" ${s(4.2)} fill="none"/>`),
  lock: svg(`<path d="M13 21.6 L35 21.4 L35.4 40.4 L12.8 40.6 Z" fill="${PAL.mustard}" ${S}/><path d="M17 21.4 L17 15.6 C17 11.6 20 8.8 24 8.8 C28 8.8 31 11.6 31 15.6 L31 21.4" ${S} fill="none"/>`),
  rotate: svg(`
    <path d="M24.4 12.6 L37.8 12.4 C39.4 12.4 40.2 13.2 40.2 14.8 L40.4 34 C40.4 35.6 39.6 36.4 38 36.4 L24.6 36.6 C23 36.6 22.2 35.8 22.2 34.2 L22 15 C22 13.4 22.8 12.6 24.4 12.6 Z" fill="${PAL.paper}" ${S} transform="rotate(-90 31 24)"/>
    <path d="M9.4 31.4 C8.6 22.4 13.6 15 22.4 12.4" ${S} fill="none"/><path d="M18.6 9.6 L22.8 12.4 L19.6 16.4" ${S} fill="none"/>`),
  egg: svg(`
    <path d="M24 5.6 C31.6 5.6 37.6 17.6 37.6 27.4 C37.6 36.2 31.6 42.4 24 42.4 C16.4 42.4 10.4 36.2 10.4 27.4 C10.4 17.6 16.4 5.6 24 5.6 Z" fill="#f6e7c4" ${S}/>
    <path d="M11.4 25.6 C15 22 18 28.6 21.4 25 C24.8 21.4 27.6 28.4 31 24.8 C33.4 22.4 35.4 24 36.8 25.4" ${s(2.2)} fill="none" stroke="${PAL.terracotta}"/>
    <circle cx="18" cy="33" r="1.8" fill="${PAL.sage}"/><circle cx="26.6" cy="35.4" r="1.6" fill="${PAL.blue}"/><circle cx="30.4" cy="31" r="1.4" fill="${PAL.mustard}"/>`),
  question: svg(`<path d="M17.4 17.6 C17.6 12.6 20.8 9.6 24.6 9.6 C28.8 9.6 31.6 12.6 31.4 16.4 C31.2 20.8 25 22 24.6 28.2" ${s(3.6)} fill="none"/><circle cx="24.4" cy="36.6" r="2.4" fill="${INK}"/>`),
  tissue: svg(`
    <path d="M9.4 22.4 L38.6 22 L39.4 39.6 L8.8 40 Z" fill="${PAL.blueLight}" ${S}/>
    <path d="M17.6 22.4 C16.4 15.6 21 9.4 24.4 7.6 C24.8 12.4 30.2 14.8 30.6 22.2" fill="#ffffff" ${S}/>
    <path d="M14 30 L34 29.8" ${s(1.8)} fill="none"/>`),
  tv: svg(`
    <path d="M7.6 12.4 L40.6 12 C41.8 12 42.4 12.6 42.4 13.8 L42.6 35.2 C42.6 36.4 42 37 40.8 37 L7.8 37.4 C6.6 37.4 6 36.8 6 35.6 L5.8 14.2 C5.8 13 6.4 12.4 7.6 12.4 Z" fill="${PAL.sageLight}" ${S}/>
    <path d="M17.6 6 L24 12.2 L30.6 5.6 M16.6 41.8 L32 41.6" ${S} fill="none"/>
    <circle cx="18.4" cy="24.6" r="2" fill="${INK}"/><circle cx="29.6" cy="24.6" r="2" fill="${INK}"/>
    <path d="M20.4 29.6 C22.4 31.6 25.8 31.6 27.8 29.6" ${s(2)} fill="none"/>`),
  mirror: svg(`
    <path d="M24 5.6 C32 5.6 37.4 12.8 37.4 22.4 C37.4 32 32 38.6 24 38.6 C16 38.6 10.6 32 10.6 22.4 C10.6 12.8 16 5.6 24 5.6 Z" fill="${PAL.blueLight}" ${S}/>
    <path d="M18 14.4 C19.4 11.6 21.4 10.4 23.4 10" ${s(2.2)} stroke="#ffffff" fill="none"/>
    <path d="M19.4 38.4 L18.6 43 L29.4 43 L28.6 38.4" fill="${PAL.mustard}" ${S}/>`),
  dog: svg(`
    <path d="M13 17.4 C13.6 11.4 17.8 8.4 24 8.4 C30.2 8.4 34.4 11.4 35 17.4 L35.6 27.6 C35.6 35.4 30.4 40.4 24 40.4 C17.6 40.4 12.4 35.4 12.4 27.6 Z" fill="#e6b47a" ${S}/>
    <path d="M13 17.4 L9.6 7.6 L19 11.2 M35 17.4 L38.4 7.6 L29 11.2" fill="#e6b47a" ${S}/>
    <path d="M17.6 30.6 C17.6 26.4 20.4 24.6 24 24.6 C27.6 24.6 30.4 26.4 30.4 30.6 C30.4 35 27.6 37.4 24 37.4 C20.4 37.4 17.6 35 17.6 30.6 Z" fill="#fbf2e4"/>
    <circle cx="19.2" cy="21.4" r="1.7" fill="${INK}"/><circle cx="28.8" cy="21.4" r="1.7" fill="${INK}"/>
    <path d="M22 27.6 L26 27.6 L24 29.6 Z" fill="${INK}" ${s(1.4)}/>
    <path d="M24 29.6 L24 31.4 C23 33 21.4 33 20.6 32" ${s(1.6)} fill="none"/>`),
  lick: svg(`
    <path d="M14.4 14 C14.4 9 18.4 6.4 24 6.4 C29.6 6.4 33.6 9 33.6 14 L33.6 21 C33.6 26.6 29.6 30 24 30 C18.4 30 14.4 26.6 14.4 21 Z" fill="#e6b47a" ${S}/>
    <path d="M19.8 27 C19.8 33.8 21.4 40 24.2 40 C27 40 28.4 33.8 28.4 27" fill="${PAL.terraLight}" ${S}/>
    <circle cx="20" cy="16" r="1.6" fill="${INK}"/><circle cx="28" cy="16" r="1.6" fill="${INK}"/>
    <path d="M36.6 30.6 C35.4 33.4 35.6 35.4 37.2 35.8 C38.8 35.4 38.8 33.4 36.6 30.6 Z" fill="${PAL.blueLight}" ${s(1.6)}/>`),
  ball: svg(`
    <path d="M24 6.6 C33.6 6.6 41.4 14.4 41.4 24 C41.4 33.6 33.6 41.4 24 41.4 C14.4 41.4 6.6 33.6 6.6 24 C6.6 14.4 14.4 6.6 24 6.6 Z" fill="#f4ead8" ${S}/>
    <path d="M24 6.6 C17.6 13.4 17.6 34.6 24 41.4 C30.4 34.6 30.4 13.4 24 6.6 Z" fill="${PAL.terracotta}" ${s(2)}/>
    <path d="M7 21 C17 18 31 18 41 21" ${s(2)} fill="none" stroke="${PAL.blue}"/>`),
  duck: svg(`
    <path d="M10.6 28 C10.6 22.4 14.6 20.6 19.4 21.8 C17.6 15.4 21.4 9.6 27.4 9.6 C33 9.6 36.4 13.6 36 18.8 C40.6 19.4 41.6 24 39 28.6 C36 35.6 29.6 38.4 22.6 38.2 C15 38 10.6 34.4 10.6 28 Z" fill="#f3d27a" ${S}/>
    <path d="M35.6 16.8 C39.4 16.4 42.2 17.6 43 19.4 C41 20.8 38.2 21 35.4 20" fill="${PAL.terracotta}" ${s(2)}/>
    <circle cx="30.4" cy="15.6" r="1.7" fill="${INK}"/>
    <path d="M17 27.4 C20.6 30.4 25.8 30.2 29 27" ${s(2)} fill="none"/>`),
  rattle: svg(`
    <path d="M24.4 5.8 C30 5.8 34 9.8 34 15.4 C34 21 30 25 24.4 25 C18.8 25 14.8 21 14.8 15.4 C14.8 9.8 18.8 5.8 24.4 5.8 Z" fill="${PAL.blush}" ${S}/>
    <path d="M22.4 24.8 L22 39.6 C22 41.6 23 42.6 24.4 42.6 C25.8 42.6 26.8 41.6 26.8 39.6 L26.4 24.8" fill="${PAL.mustard}" ${S}/>
    <circle cx="20.4" cy="13.6" r="1.6" fill="#fff"/><circle cx="27.6" cy="17.6" r="1.6" fill="#fff"/><circle cx="25.4" cy="10.8" r="1.2" fill="#fff"/>
    <path d="M8.6 10.6 L5.6 9 M8.2 17 L4.8 17.6 M40.2 10.6 L43.2 9 M40.6 17 L44 17.6" ${s(2)} fill="none"/>`),
  musicbox: svg(`
    <path d="M8.6 22.6 L39.4 22.2 L40 40.4 L8.2 40.8 Z" fill="${PAL.terraLight}" ${S}/>
    <path d="M7.2 16.6 L40.8 16.2 L40.8 22.4 L7.2 22.8 Z" fill="${PAL.terracotta}" ${S}/>
    <path d="M40.8 30 L45 30 L45 26.4" ${S} fill="none"/>
    <path d="M18 12.4 L18 4.6 L25.6 3.6 L25.6 10.4" ${s(2)} fill="none"/><circle cx="16.2" cy="12.8" r="2.2" fill="${INK}"/><circle cx="23.8" cy="11" r="2.2" fill="${INK}"/>
    <path d="M14 31.4 L34 31" ${s(1.8)} fill="none"/>`),
  dance: svg(`
    <circle cx="24" cy="10.6" r="5" fill="#f1cfae" ${S}/>
    <path d="M24 15.8 L23.4 28.6 M23.6 19.6 L14 13 M23.6 19.6 L33.6 13.6 M23.4 28.6 L16.4 38.6 M23.4 28.6 L31.6 36.6 L35 35" ${s(2.8)} fill="none"/>
    <path d="M37.6 22 L40 19.8 M38.6 27.4 L42.2 27.4 M8.4 22.6 L6.4 20.2" ${s(2)} fill="none"/>`),
  peek: svg(`
    <path d="M24 7.4 C32.4 7.4 38.6 13.8 38.6 22.4 C38.6 31 32.4 37.4 24 37.4 C15.6 37.4 9.4 31 9.4 22.4 C9.4 13.8 15.6 7.4 24 7.4 Z" fill="#f6dcc0" ${S}/>
    <path d="M11.4 26.6 C11 20.4 13.4 17.6 17.6 17.4 C21.4 17.2 23 20 22.6 23.6 L22.2 29.4 L12.4 30.4 Z" fill="#efc6a6" ${S}/>
    <path d="M36.6 26.6 C37 20.4 34.6 17.6 30.4 17.4 C26.6 17.2 25 20 25.4 23.6 L25.8 29.4 L35.6 30.4 Z" fill="#efc6a6" ${S}/>
    <path d="M20.4 33.4 C22.4 34.8 25.6 34.8 27.6 33.4" ${s(2)} fill="none"/>`),
  speech: svg(`
    <path d="M9.2 10.6 L38.8 10.2 C40.4 10.2 41.2 11 41.2 12.6 L41.4 29.2 C41.4 30.8 40.6 31.6 39 31.6 L22.4 31.8 L13.6 39.6 L14.6 31.8 L9.4 31.8 C7.8 31.8 7 31 7 29.4 L6.8 13 C6.8 11.4 7.6 10.6 9.2 10.6 Z" fill="${PAL.paper}" ${S}/>
    <path d="M13.4 18.4 C15 16.6 17 18.6 18.4 20.6 C19.8 18.6 21.8 16.6 23.4 18.4 M25.6 22.4 C27.2 20.6 29.2 22.6 30.6 24.6 C32 22.6 34 20.6 35.6 22.4" ${s(2)} fill="none" stroke="${PAL.terracotta}"/>`),
  blocks: svg(`
    <path d="M8.6 26.6 L22.6 26.4 L22.8 40.6 L8.8 40.8 Z" fill="${PAL.blueLight}" ${S}/>
    <path d="M25.4 26.4 L39.4 26.2 L39.6 40.4 L25.6 40.6 Z" fill="${PAL.sageLight}" ${S}/>
    <path d="M16.8 9.8 L30.8 9.6 L31 23.8 L17 24 Z" fill="${PAL.blush}" ${S}/>
    <path d="M20.4 20.6 L21.6 13.4 L24 17.6 L26.4 13.2 L27.6 20.4" ${s(1.8)} fill="none"/>`),
  sparkle: svg(`
    <path d="M24 5.6 C25.6 16.4 31.6 22.4 42.4 24 C31.6 25.6 25.6 31.6 24 42.4 C22.4 31.6 16.4 25.6 5.6 24 C16.4 22.4 22.4 16.4 24 5.6 Z" fill="#f2d48a" ${S}/>`),
  confetti: svg(`
    <path d="M8.6 40.6 L19.6 14.6 L34.4 29.4 Z" fill="${PAL.mustard}" ${S}/>
    <path d="M24.4 9.4 L26 5.6 M32.6 12.6 L36.4 9.6 M36.4 20.4 L41 19.4" ${s(2.4)} fill="none" stroke="${PAL.terracotta}"/>
    <circle cx="30" cy="5.6" r="1.6" fill="${PAL.blue}"/><circle cx="41.6" cy="13" r="1.6" fill="${PAL.sage}"/><circle cx="40" cy="27.6" r="1.6" fill="${PAL.terracotta}"/>`),
};

/** red ink "棒" approval stamp used when a task is completed */
export const STAMP = `<svg viewBox="0 0 64 64" aria-hidden="true"><g filter="url(#stamp)">
  <circle cx="32" cy="32" r="27" fill="none" stroke="#c4553f" stroke-width="3.4"/>
  <circle cx="32" cy="32" r="22.4" fill="none" stroke="#c4553f" stroke-width="1.6" stroke-dasharray="3 3"/>
  <text x="32" y="41" text-anchor="middle" font-size="25" fill="#c4553f" font-family="WenKai, serif">棒</text>
</g></svg>`;
