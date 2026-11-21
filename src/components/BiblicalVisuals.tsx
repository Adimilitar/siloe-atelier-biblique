import React from 'react';
import { AlertTriangle, Compass, Layers } from 'lucide-react';
import type { BiblicalPlace, ReconstructionSpec, UILanguage } from '../types/siloe';

/**
 * Projects lat/lng onto a Levant & Eastern Mediterranean canvas (lat 29..42, lng 12..45 or auto-fitted).
 */
export function buildMapSvgString(places: BiblicalPlace[], lang: UILanguage): string {
  if (!places || places.length === 0) return '';

  const lats = places.map((p) => p.lat);
  const lngs = places.map((p) => p.lng);
  const minLat = Math.min(...lats, 31.2) - 0.6;
  const maxLat = Math.max(...lats, 33.4) + 0.6;
  const minLng = Math.min(...lngs, 34.2) - 0.8;
  const maxLng = Math.max(...lngs, 36.2) + 0.8;

  const w = 640;
  const h = 380;
  const pad = 42;

  const project = (lat: number, lng: number) => {
    const x = pad + ((lng - minLng) / Math.max(0.5, maxLng - minLng)) * (w - pad * 2);
    const y = h - pad - ((lat - minLat) / Math.max(0.5, maxLat - minLat)) * (h - pad * 2);
    return { x: Math.round(x), y: Math.round(y) };
  };

  // Stylized Levant coastline & Jordan Rift Valley guide lines
  const seaCoast = [
    project(31.2, 34.2),
    project(31.7, 34.62),
    project(32.08, 34.77),
    project(32.82, 34.98),
    project(33.55, 35.37),
    project(34.4, 35.8),
  ];
  const coastPath = seaCoast.map((p, idx) => `${idx === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ');
  const seaPoly = `M0,0 L${seaCoast[seaCoast.length - 1].x},0 ${seaCoast
    .slice()
    .reverse()
    .map((p) => `L${p.x},${p.y}`)
    .join(' ')} L0,${h} Z`;

  const galilee = project(32.82, 35.58);
  const deadSea = project(31.5, 35.48);

  const pins = places
    .map((pl) => {
      const { x, y } = project(pl.lat, pl.lng);
      const isUncertain = pl.certainty.toLowerCase().includes('incert');
      const isProbable = pl.certainty.toLowerCase().includes('prob');
      const ringColor = isUncertain ? '#D97706' : isProbable ? '#2563EB' : '#14243E';
      const dash = isUncertain ? 'stroke-dasharray="4 3"' : isProbable ? 'stroke-dasharray="6 2"' : '';
      const escName = pl.name.replace(/[<>&"]/g, '');
      return `
        <g>
          <circle cx="${x}" cy="${y}" r="${isUncertain ? 16 : 11}" fill="${ringColor}" fill-opacity="0.14" stroke="${ringColor}" stroke-width="1.5" ${dash} />
          <circle cx="${x}" cy="${y}" r="4.5" fill="${ringColor}" stroke="#FAF7F0" stroke-width="1.5" />
          <text x="${x + 10}" y="${y + 4}" font-family="Plus Jakarta Sans, sans-serif" font-size="12" font-weight="600" fill="#14243E">${escName}${isUncertain ? ' (?)' : ''}</text>
        </g>`;
    })
    .join('');

  const legendText =
    lang === 'pt'
      ? 'Mapa esquemático · Círculo pontilhado = localização incerta'
      : 'Carte schématique · Cercle pointillé = localisation incertaine';

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" class="w-full h-auto rounded-2xl">
    <rect width="${w}" height="${h}" fill="#F3EEE3" />
    <path d="${seaPoly}" fill="#DCE6F2" />
    <path d="${coastPath}" fill="none" stroke="#9EB4CD" stroke-width="2" />
    <ellipse cx="${galilee.x}" cy="${galilee.y}" rx="9" ry="15" fill="#B8CEE6" stroke="#7E9EC2" stroke-width="1" />
    <ellipse cx="${deadSea.x}" cy="${deadSea.y}" rx="11" ry="26" fill="#B8CEE6" stroke="#7E9EC2" stroke-width="1" />
    <line x1="${galilee.x}" y1="${galilee.y + 15}" x2="${deadSea.x}" y2="${deadSea.y - 26}" stroke="#9EB4CD" stroke-width="1.5" stroke-dasharray="3 3" />
    ${pins}
    <rect x="14" y="${h - 32}" width="380" height="22" rx="6" fill="#FAF7F0" fill-opacity="0.92" />
    <text x="22" y="${h - 17}" font-family="Plus Jakarta Sans, sans-serif" font-size="10.5" fill="#4B5B73">${legendText}</text>
  </svg>`;
}

export function buildReconstructionSvgString(spec: ReconstructionSpec, lang: UILanguage): string {
  const title = (spec.title || 'Reconstitution').replace(/[<>&"]/g, '');
  const era = (spec.era || 'Ier siècle').replace(/[<>&"]/g, '');
  const badge =
    lang === 'pt' ? 'RECONSTITUIÇÃO GERADA · NÃO DOCUMENTAL' : 'RECONSTITUTION GÉNÉRÉE · SCHÉMATIQUE';

  let sceneShapes = '';
  switch (spec.sceneType) {
    case 'pool_siloam':
      sceneShapes = `
        <path d="M80 245 L560 245 L520 305 L120 305 Z" fill="#C7D8EE" stroke="#1D3557" stroke-width="2"/>
        <path d="M110 215 L530 215 M100 230 L540 230 M90 245 L550 245" stroke="#8A7968" stroke-width="4" stroke-linecap="round"/>
        <rect x="130" y="135" width="380" height="80" fill="none" stroke="#14243E" stroke-width="2"/>
        <line x1="170" y1="135" x2="170" y2="215" stroke="#14243E" stroke-width="6"/>
        <line x1="255" y1="135" x2="255" y2="215" stroke="#14243E" stroke-width="6"/>
        <line x1="385" y1="135" x2="385" y2="215" stroke="#14243E" stroke-width="6"/>
        <line x1="470" y1="135" x2="470" y2="215" stroke="#14243E" stroke-width="6"/>
        <path d="M190 272 Q260 258 320 272 T450 272" fill="none" stroke="#1D3557" stroke-width="2"/>
      `;
      break;
    case 'vineyard':
      sceneShapes = `
        <path d="M40 285 Q180 255 320 275 T600 260" fill="none" stroke="#8A7968" stroke-width="2.5"/>
        <path d="M40 310 L600 310" stroke="#A69888" stroke-width="2" stroke-dasharray="6 4"/>
        <rect x="465" y="145" width="76" height="125" fill="#E8DFCE" stroke="#14243E" stroke-width="2"/>
        <path d="M458 145 L548 145 L540 132 L466 132 Z" fill="#1D3557"/>
        <path d="M180 280 C180 220 155 190 120 185 M180 235 C205 205 240 200 270 190 M180 245 C150 225 110 225 90 220" fill="none" stroke="#14243E" stroke-width="4" stroke-linecap="round"/>
        <circle cx="118" cy="184" r="14" fill="#4D7C5B" fill-opacity="0.35" stroke="#1D3557" stroke-width="1.5"/>
        <circle cx="272" cy="188" r="16" fill="#4D7C5B" fill-opacity="0.35" stroke="#1D3557" stroke-width="1.5"/>
        <circle cx="215" cy="212" r="12" fill="#4D7C5B" fill-opacity="0.35" stroke="#1D3557" stroke-width="1.5"/>
      `;
      break;
    default:
      sceneShapes = `
        <rect x="110" y="135" width="420" height="150" rx="6" fill="#EAE2D0" stroke="#14243E" stroke-width="2"/>
        <path d="M90 135 L320 75 L550 135 Z" fill="#DCE6F2" stroke="#14243E" stroke-width="2"/>
        <line x1="175" y1="135" x2="175" y2="285" stroke="#14243E" stroke-width="4"/>
        <line x1="270" y1="135" x2="270" y2="285" stroke="#14243E" stroke-width="4"/>
        <line x1="370" y1="135" x2="370" y2="285" stroke="#14243E" stroke-width="4"/>
        <line x1="465" y1="135" x2="465" y2="285" stroke="#14243E" stroke-width="4"/>
      `;
      break;
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 360" class="w-full h-auto rounded-2xl">
    <rect width="640" height="360" fill="#FAF5EA" />
    <rect x="14" y="14" width="612" height="332" rx="16" fill="none" stroke="#14243E" stroke-opacity="0.18" stroke-width="1.5" />
    <rect x="28" y="26" width="290" height="22" rx="6" fill="#14243E" />
    <text x="38" y="41" font-family="Plus Jakarta Sans, sans-serif" font-size="10" font-weight="700" fill="#FAF7F0">${badge}</text>
    <text x="30" y="72" font-family="Source Serif 4, Georgia, serif" font-size="18" font-weight="700" fill="#14243E">${title}</text>
    <text x="30" y="92" font-family="Plus Jakarta Sans, sans-serif" font-size="12" fill="#4B5B73">${era}</text>
    ${sceneShapes}
  </svg>`;
}

export const BiblicalMapCard: React.FC<{
  places: BiblicalPlace[];
  caption?: string;
  lang: UILanguage;
}> = ({ places, caption, lang }) => {
  const svgStr = buildMapSvgString(places, lang);
  if (!places || places.length === 0) return null;

  return (
    <div className="rounded-2xl border border-[var(--siloe-border)] bg-[var(--siloe-bg-solid)] p-3.5 space-y-3">
      <div className="flex items-center gap-2 text-xs font-semibold text-[var(--siloe-ink)]">
        <Compass className="w-4 h-4 text-[var(--siloe-accent)] shrink-0" />
        <span>{lang === 'pt' ? 'Mapa esquemático de locais bíblicos' : 'Carte schématique des lieux bibliques'}</span>
      </div>
      <div
        className="w-full overflow-hidden rounded-xl border border-[var(--siloe-border)]"
        dangerouslySetInnerHTML={{ __html: svgStr }}
      />
      {caption && <p className="text-xs text-[var(--siloe-ink-muted)]">{caption}</p>}
      <div className="space-y-1.5">
        {places.map((p, idx) => {
          const isUncertain = p.certainty.toLowerCase().includes('incert');
          const isProbable = p.certainty.toLowerCase().includes('prob');
          return (
            <div
              key={`${p.name}-${idx}`}
              className="flex flex-wrap items-baseline justify-between gap-2 text-xs py-1.5 border-t border-[var(--siloe-border)]"
            >
              <div>
                <span className="font-semibold text-[var(--siloe-ink)]">{p.name}</span>
                {p.modernName && <span className="text-[var(--siloe-ink-muted)]"> ({p.modernName})</span>}
                <span className="text-[var(--siloe-ink-muted)]"> · {p.region}</span>
                {p.certaintyNote && (
                  <p className="text-[11px] text-[var(--siloe-ink-muted)] mt-0.5">{p.certaintyNote}</p>
                )}
              </div>
              <span
                className={`inline-flex items-center gap-1 font-medium whitespace-nowrap ${
                  isUncertain
                    ? 'text-amber-700 dark:text-amber-400'
                    : isProbable
                    ? 'text-blue-700 dark:text-blue-300'
                    : 'text-emerald-700 dark:text-emerald-400'
                }`}
              >
                {isUncertain && <AlertTriangle className="w-3.5 h-3.5" />}
                {p.certainty}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export const ReconstructionCard: React.FC<{
  spec: ReconstructionSpec;
  caption?: string;
  lang: UILanguage;
}> = ({ spec, caption, lang }) => {
  const svgStr = buildReconstructionSvgString(spec, lang);
  return (
    <div className="rounded-2xl border border-[var(--siloe-border)] bg-[var(--siloe-bg-solid)] p-3.5 space-y-2.5">
      <div className="flex items-center gap-2 text-xs font-semibold text-amber-800 dark:text-amber-300">
        <Layers className="w-4 h-4 shrink-0" />
        <span>
          {lang === 'pt'
            ? 'Reconstituição gerada por IA — Ilustração esquemática, não documental'
            : 'Reconstitution générée par IA — Illustration schématique, non documentaire'}
        </span>
      </div>
      <div
        className="w-full overflow-hidden rounded-xl border border-[var(--siloe-border)]"
        dangerouslySetInnerHTML={{ __html: svgStr }}
      />
      <p className="text-xs text-[var(--siloe-ink)] leading-relaxed">{spec.description}</p>
      {spec.elements && spec.elements.length > 0 && (
        <p className="text-[11px] text-[var(--siloe-ink-muted)]">
          {spec.elements.join(' · ')}
        </p>
      )}
      {caption && <p className="text-[11px] italic text-[var(--siloe-ink-muted)]">{caption}</p>}
    </div>
  );
};
