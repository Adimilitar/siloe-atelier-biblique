import type { BibleEditionMeta, BibleVerse } from '../types/siloe';

export interface AlignedVerseRow {
  key: string;
  primaryVerse: BibleVerse | null;
  secondaryVerse: BibleVerse | null;
  alignmentStatus: 'exact' | 'shifted' | 'uncertain' | 'missing';
  note?: string;
}

export interface ChapterAlignmentResult {
  rows: AlignedVerseRow[];
  hasDifference: boolean;
  summaryNoteFr: string;
  summaryNotePt: string;
}

/**
 * Known OT/NT chapter-level verse numbering shifts between Segond/NRSV and Hebrew/German (Darby).
 */
const CHAPTER_BOUNDARY_NOTES: Record<string, { fr: string; pt: string }> = {
  '1:31': {
    fr: 'Gn 31.55 dans Segond/BLIVRE correspond à Gn 32.1 dans Darby (numérotation hébraïque).',
    pt: 'Gn 31.55 na Segond/BLIVRE corresponde a Gn 32.1 na Darby (numeração hebraica).',
  },
  '1:32': {
    fr: 'Décalage d’un verset entre Darby (33 v., numérotation hébraïque) et Segond/BLIVRE (32 v.).',
    pt: 'Deslocamento de 1 versículo entre Darby (33 v.) e Segond/BLIVRE (32 v.).',
  },
  '2:7': {
    fr: 'Ex 7.26–29 (Segond/Darby) correspondent à Ex 8.1–4 dans la Bíblia Livre (NRSV).',
    pt: 'Êx 7.26–29 (Segond/Darby) correspondem a Êx 8.1–4 na Bíblia Livre (NRSV).',
  },
  '2:8': {
    fr: 'Décalage de 4 versets entre Segond/Darby et NRSV/BLIVRE au début d’Exode 8.',
    pt: 'Deslocamento de 4 versículos entre Segond/Darby e NRSV/BLIVRE no início de Êxodo 8.',
  },
  '4:16': {
    fr: 'Nb 16.36–50 (Segond/BLIVRE) sont numérotés Nb 17.1–15 dans Darby.',
    pt: 'Nm 16.36–50 (Segond/BLIVRE) são numerados Nm 17.1–15 em Darby.',
  },
  '4:17': {
    fr: 'Nb 17 (Darby) inclut les 15 versets finaux de Nb 16 (Segond/BLIVRE).',
    pt: 'Nm 17 (Darby) inclui os 15 versículos finais de Nm 16 (Segond/BLIVRE).',
  },
  '29:2': {
    fr: 'Joël 2.28–32 (Segond/BLIVRE) constituent Joël 3.1–5 dans la numérotation hébraïque (Darby).',
    pt: 'Joel 2.28–32 (Segond/BLIVRE) formam Joel 3.1–5 na numeração hebraica (Darby).',
  },
  '29:3': {
    fr: 'Joël 3 dans Segond/BLIVRE correspond à Joël 4 dans Darby.',
    pt: 'Joel 3 em Segond/BLIVRE corresponde a Joel 4 em Darby.',
  },
  '39:3': {
    fr: 'Malachie 3.19–24 (Darby) correspond à Malachie 4.1–6 dans Segond/BLIVRE.',
    pt: 'Malaquias 3.19–24 (Darby) corresponde a Malaquias 4.1–6 em Segond/BLIVRE.',
  },
  '39:4': {
    fr: 'Malachie 4 dans Segond/BLIVRE fait partie de Malachie 3 dans Darby.',
    pt: 'Malaquias 4 em Segond/BLIVRE faz parte de Malaquias 3 em Darby.',
  },
};

export function alignChapterVerses(
  bookId: number,
  chapter: number,
  primaryVerses: BibleVerse[],
  secondaryVerses: BibleVerse[],
  primaryMeta?: BibleEditionMeta,
  secondaryMeta?: BibleEditionMeta
): ChapterAlignmentResult {
  const mapA = new Map<number, BibleVerse>();
  const mapB = new Map<number, BibleVerse>();
  for (const v of primaryVerses) mapA.set(v.v, v);
  for (const v of secondaryVerses) mapB.set(v.v, v);

  const countA = primaryVerses.length;
  const countB = secondaryVerses.length;
  const boundaryKey = `${bookId}:${chapter}`;
  const knownNote = CHAPTER_BOUNDARY_NOTES[boundaryKey];

  // Detect Hebrew Psalm superscription offset: if Book 19 (Psalms), one has N+1 verses and v.1 is a title
  const isPsalmSuperscriptionShift =
    bookId === 19 &&
    Math.abs(countA - countB) === 1 &&
    primaryMeta?.versification !== secondaryMeta?.versification;

  if (isPsalmSuperscriptionShift) {
    const aHasExtra = countA > countB;
    const rows: AlignedVerseRow[] = [];
    const maxLen = Math.max(countA, countB);
    for (let i = 0; i < maxLen; i++) {
      const pVerse = aHasExtra ? primaryVerses[i] ?? null : i === 0 ? null : primaryVerses[i - 1] ?? null;
      const sVerse = !aHasExtra ? secondaryVerses[i] ?? null : i === 0 ? null : secondaryVerses[i - 1] ?? null;
      rows.push({
        key: `${bookId}-${chapter}-ps-${i}`,
        primaryVerse: pVerse,
        secondaryVerse: sVerse,
        alignmentStatus: 'shifted',
        note:
          i === 0
            ? 'Titre hébraïque numéroté v. 1 dans une édition uniquement / Título hebraico numerado como v. 1 em apenas uma edição.'
            : undefined,
      });
    }
    return {
      rows,
      hasDifference: true,
      summaryNoteFr:
        'Décalage de +1 verset dans ce Psaume : la suscription hébraïque est numérotée v. 1 dans l’une des éditions.',
      summaryNotePt:
        'Deslocamento de +1 versículo neste Salmo: o título hebraico é numerado como v. 1 em uma das edições.',
    };
  }

  const allVerseNums = Array.from(new Set([...mapA.keys(), ...mapB.keys()])).sort((a, b) => a - b);
  const countDiffers = countA !== countB || Boolean(knownNote);

  const rows: AlignedVerseRow[] = allVerseNums.map((vNum) => {
    const p = mapA.get(vNum) ?? null;
    const s = mapB.get(vNum) ?? null;
    let status: AlignedVerseRow['alignmentStatus'] = 'exact';
    if (!p || !s) {
      status = countDiffers ? 'uncertain' : 'missing';
    } else if (knownNote || countA !== countB) {
      status = 'uncertain';
    }
    return {
      key: `${bookId}-${chapter}-${vNum}`,
      primaryVerse: p,
      secondaryVerse: s,
      alignmentStatus: status,
    };
  });

  if (knownNote) {
    return {
      rows,
      hasDifference: true,
      summaryNoteFr: knownNote.fr,
      summaryNotePt: knownNote.pt,
    };
  }

  if (countA !== countB) {
    return {
      rows,
      hasDifference: true,
      summaryNoteFr: `Nombre de versets différent (${countA} vs ${countB}) : correspondance verset par verset potentiellement décalée ou incertaine.`,
      summaryNotePt: `Número de versículos diferente (${countA} vs ${countB}): correspondência potencialmente deslocada ou incerta.`,
    };
  }

  return {
    rows,
    hasDifference: false,
    summaryNoteFr: '',
    summaryNotePt: '',
  };
}
