export interface BookMeta {
  id: number;
  testament: 'OT' | 'NT';
  chapters: number;
  nameFr: string;
  namePt: string;
  abbrFr: string;
  abbrPt: string;
  aliases: string[];
}

export const BIBLE_BOOKS: BookMeta[] = [
  { id: 1, testament: 'OT', chapters: 50, nameFr: 'Genèse', namePt: 'Gênesis', abbrFr: 'Gn', abbrPt: 'Gn', aliases: ['gen', 'genese', 'genesis', 'gn'] },
  { id: 2, testament: 'OT', chapters: 40, nameFr: 'Exode', namePt: 'Êxodo', abbrFr: 'Ex', abbrPt: 'Êx', aliases: ['ex', 'exode', 'exodo', 'exo'] },
  { id: 3, testament: 'OT', chapters: 27, nameFr: 'Lévitique', namePt: 'Levítico', abbrFr: 'Lv', abbrPt: 'Lv', aliases: ['lv', 'lev', 'levitique', 'levitico'] },
  { id: 4, testament: 'OT', chapters: 36, nameFr: 'Nombres', namePt: 'Números', abbrFr: 'Nb', abbrPt: 'Nm', aliases: ['nb', 'nm', 'nombres', 'numeros', 'num'] },
  { id: 5, testament: 'OT', chapters: 34, nameFr: 'Deutéronome', namePt: 'Deuteronômio', abbrFr: 'Dt', abbrPt: 'Dt', aliases: ['dt', 'deu', 'deuteronome', 'deuteronomio'] },
  { id: 6, testament: 'OT', chapters: 24, nameFr: 'Josué', namePt: 'Josué', abbrFr: 'Jos', abbrPt: 'Js', aliases: ['jos', 'js', 'josue'] },
  { id: 7, testament: 'OT', chapters: 21, nameFr: 'Juges', namePt: 'Juízes', abbrFr: 'Jg', abbrPt: 'Jz', aliases: ['jg', 'jz', 'juges', 'juizes', 'jdg'] },
  { id: 8, testament: 'OT', chapters: 4, nameFr: 'Ruth', namePt: 'Rute', abbrFr: 'Rt', abbrPt: 'Rt', aliases: ['rt', 'rut', 'ruth', 'rute'] },
  { id: 9, testament: 'OT', chapters: 31, nameFr: '1 Samuel', namePt: '1 Samuel', abbrFr: '1 S', abbrPt: '1Sm', aliases: ['1s', '1sm', '1sa', '1 samuel', '1samuel'] },
  { id: 10, testament: 'OT', chapters: 24, nameFr: '2 Samuel', namePt: '2 Samuel', abbrFr: '2 S', abbrPt: '2Sm', aliases: ['2s', '2sm', '2sa', '2 samuel', '2samuel'] },
  { id: 11, testament: 'OT', chapters: 22, nameFr: '1 Rois', namePt: '1 Reis', abbrFr: '1 R', abbrPt: '1Rs', aliases: ['1r', '1rs', '1ki', '1 rois', '1 reis', '1rois', '1reis'] },
  { id: 12, testament: 'OT', chapters: 25, nameFr: '2 Rois', namePt: '2 Reis', abbrFr: '2 R', abbrPt: '2Rs', aliases: ['2r', '2rs', '2ki', '2 rois', '2 reis', '2rois', '2reis'] },
  { id: 13, testament: 'OT', chapters: 29, nameFr: '1 Chroniques', namePt: '1 Crônicas', abbrFr: '1 Ch', abbrPt: '1Cr', aliases: ['1ch', '1cr', '1 chroniques', '1 cronicas'] },
  { id: 14, testament: 'OT', chapters: 36, nameFr: '2 Chroniques', namePt: '2 Crônicas', abbrFr: '2 Ch', abbrPt: '2Cr', aliases: ['2ch', '2cr', '2 chroniques', '2 cronicas'] },
  { id: 15, testament: 'OT', chapters: 10, nameFr: 'Esdras', namePt: 'Esdras', abbrFr: 'Esd', abbrPt: 'Ed', aliases: ['esd', 'ed', 'ezr', 'esdras'] },
  { id: 16, testament: 'OT', chapters: 13, nameFr: 'Néhémie', namePt: 'Neemias', abbrFr: 'Né', abbrPt: 'Ne', aliases: ['ne', 'neh', 'nehemie', 'neemias'] },
  { id: 17, testament: 'OT', chapters: 10, nameFr: 'Esther', namePt: 'Ester', abbrFr: 'Est', abbrPt: 'Et', aliases: ['est', 'et', 'esther', 'ester'] },
  { id: 18, testament: 'OT', chapters: 42, nameFr: 'Job', namePt: 'Jó', abbrFr: 'Jb', abbrPt: 'Jó', aliases: ['jb', 'jo', 'job'] },
  { id: 19, testament: 'OT', chapters: 150, nameFr: 'Psaumes', namePt: 'Salmos', abbrFr: 'Ps', abbrPt: 'Sl', aliases: ['ps', 'sl', 'psa', 'psaumes', 'psaume', 'salmos', 'salmo'] },
  { id: 20, testament: 'OT', chapters: 31, nameFr: 'Proverbes', namePt: 'Provérbios', abbrFr: 'Pr', abbrPt: 'Pv', aliases: ['pr', 'pv', 'pro', 'proverbes', 'proverbios'] },
  { id: 21, testament: 'OT', chapters: 12, nameFr: 'Ecclésiaste', namePt: 'Eclesiastes', abbrFr: 'Ec', abbrPt: 'Ec', aliases: ['ec', 'ecc', 'ecclesiaste', 'eclesiastes'] },
  { id: 22, testament: 'OT', chapters: 8, nameFr: 'Cantique des cantiques', namePt: 'Cânticos', abbrFr: 'Ct', abbrPt: 'Ct', aliases: ['ct', 'cant', 'sol', 'cantique', 'canticos'] },
  { id: 23, testament: 'OT', chapters: 66, nameFr: 'Ésaïe', namePt: 'Isaías', abbrFr: 'És', abbrPt: 'Is', aliases: ['es', 'is', 'isa', 'esaie', 'isaias'] },
  { id: 24, testament: 'OT', chapters: 52, nameFr: 'Jérémie', namePt: 'Jeremias', abbrFr: 'Jr', abbrPt: 'Jr', aliases: ['jr', 'jer', 'jeremie', 'jeremias'] },
  { id: 25, testament: 'OT', chapters: 5, nameFr: 'Lamentations', namePt: 'Lamentações', abbrFr: 'Lm', abbrPt: 'Lm', aliases: ['lm', 'lam', 'lamentations', 'lamentacoes'] },
  { id: 26, testament: 'OT', chapters: 48, nameFr: 'Ézéchiel', namePt: 'Ezequiel', abbrFr: 'Éz', abbrPt: 'Ez', aliases: ['ez', 'eze', 'ezechiel', 'ezequiel'] },
  { id: 27, testament: 'OT', chapters: 12, nameFr: 'Daniel', namePt: 'Daniel', abbrFr: 'Dn', abbrPt: 'Dn', aliases: ['dn', 'dan', 'daniel'] },
  { id: 28, testament: 'OT', chapters: 14, nameFr: 'Osée', namePt: 'Oséias', abbrFr: 'Os', abbrPt: 'Os', aliases: ['os', 'hos', 'osee', 'oseias'] },
  { id: 29, testament: 'OT', chapters: 3, nameFr: 'Joël', namePt: 'Joel', abbrFr: 'Jl', abbrPt: 'Jl', aliases: ['jl', 'joe', 'joel'] },
  { id: 30, testament: 'OT', chapters: 9, nameFr: 'Amos', namePt: 'Amós', abbrFr: 'Am', abbrPt: 'Am', aliases: ['am', 'amo', 'amos'] },
  { id: 31, testament: 'OT', chapters: 1, nameFr: 'Abdias', namePt: 'Obadias', abbrFr: 'Ab', abbrPt: 'Ob', aliases: ['ab', 'ob', 'oba', 'abdias', 'obadias'] },
  { id: 32, testament: 'OT', chapters: 4, nameFr: 'Jonas', namePt: 'Jonas', abbrFr: 'Jon', abbrPt: 'Jn', aliases: ['jon', 'jonas'] },
  { id: 33, testament: 'OT', chapters: 7, nameFr: 'Michée', namePt: 'Miquéias', abbrFr: 'Mi', abbrPt: 'Mq', aliases: ['mi', 'mq', 'mic', 'michee', 'miqueias'] },
  { id: 34, testament: 'OT', chapters: 3, nameFr: 'Nahum', namePt: 'Naum', abbrFr: 'Na', abbrPt: 'Na', aliases: ['na', 'nah', 'nahum', 'naum'] },
  { id: 35, testament: 'OT', chapters: 3, nameFr: 'Habacuc', namePt: 'Habacuque', abbrFr: 'Ha', abbrPt: 'Hc', aliases: ['ha', 'hc', 'hab', 'habacuc', 'habacuque'] },
  { id: 36, testament: 'OT', chapters: 3, nameFr: 'Sophonie', namePt: 'Sofonias', abbrFr: 'So', abbrPt: 'Sf', aliases: ['so', 'sf', 'zep', 'sophonie', 'sofonias'] },
  { id: 37, testament: 'OT', chapters: 2, nameFr: 'Aggée', namePt: 'Ageu', abbrFr: 'Ag', abbrPt: 'Ag', aliases: ['ag', 'hag', 'aggee', 'ageu'] },
  { id: 38, testament: 'OT', chapters: 14, nameFr: 'Zacharie', namePt: 'Zacarias', abbrFr: 'Za', abbrPt: 'Zc', aliases: ['za', 'zc', 'zec', 'zacharie', 'zacarias'] },
  { id: 39, testament: 'OT', chapters: 4, nameFr: 'Malachie', namePt: 'Malaquias', abbrFr: 'Ml', abbrPt: 'Ml', aliases: ['ml', 'mal', 'malachie', 'malaquias'] },
  { id: 40, testament: 'NT', chapters: 28, nameFr: 'Matthieu', namePt: 'Mateus', abbrFr: 'Mt', abbrPt: 'Mt', aliases: ['mt', 'mat', 'matthieu', 'mateus'] },
  { id: 41, testament: 'NT', chapters: 16, nameFr: 'Marc', namePt: 'Marcos', abbrFr: 'Mc', abbrPt: 'Mc', aliases: ['mc', 'mar', 'marc', 'marcos'] },
  { id: 42, testament: 'NT', chapters: 24, nameFr: 'Luc', namePt: 'Lucas', abbrFr: 'Lc', abbrPt: 'Lc', aliases: ['lc', 'luk', 'luc', 'lucas'] },
  { id: 43, testament: 'NT', chapters: 21, nameFr: 'Jean', namePt: 'João', abbrFr: 'Jn', abbrPt: 'Jo', aliases: ['jn', 'jo', 'joh', 'jean', 'joao'] },
  { id: 44, testament: 'NT', chapters: 28, nameFr: 'Actes', namePt: 'Atos', abbrFr: 'Ac', abbrPt: 'At', aliases: ['ac', 'at', 'act', 'actes', 'atos'] },
  { id: 45, testament: 'NT', chapters: 16, nameFr: 'Romains', namePt: 'Romanos', abbrFr: 'Rm', abbrPt: 'Rm', aliases: ['rm', 'ro', 'rom', 'romains', 'romanos'] },
  { id: 46, testament: 'NT', chapters: 16, nameFr: '1 Corinthiens', namePt: '1 Coríntios', abbrFr: '1 Co', abbrPt: '1Co', aliases: ['1co', '1 cor', '1 corinthiens', '1 corintios'] },
  { id: 47, testament: 'NT', chapters: 13, nameFr: '2 Corinthiens', namePt: '2 Coríntios', abbrFr: '2 Co', abbrPt: '2Co', aliases: ['2co', '2 cor', '2 corinthiens', '2 corintios'] },
  { id: 48, testament: 'NT', chapters: 6, nameFr: 'Galates', namePt: 'Gálatas', abbrFr: 'Ga', abbrPt: 'Gl', aliases: ['ga', 'gl', 'gal', 'galates', 'galatas'] },
  { id: 49, testament: 'NT', chapters: 6, nameFr: 'Éphésiens', namePt: 'Efésios', abbrFr: 'Ép', abbrPt: 'Ef', aliases: ['ep', 'ef', 'eph', 'ephesiens', 'efesios'] },
  { id: 50, testament: 'NT', chapters: 4, nameFr: 'Philippiens', namePt: 'Filipenses', abbrFr: 'Ph', abbrPt: 'Fp', aliases: ['ph', 'fp', 'phi', 'philippiens', 'filipenses'] },
  { id: 51, testament: 'NT', chapters: 4, nameFr: 'Colossiens', namePt: 'Colossenses', abbrFr: 'Col', abbrPt: 'Cl', aliases: ['col', 'cl', 'colossiens', 'colossenses'] },
  { id: 52, testament: 'NT', chapters: 5, nameFr: '1 Thessaloniciens', namePt: '1 Tessalonicenses', abbrFr: '1 Th', abbrPt: '1Ts', aliases: ['1th', '1ts', '1 thessaloniciens', '1 tessalonicenses'] },
  { id: 53, testament: 'NT', chapters: 3, nameFr: '2 Thessaloniciens', namePt: '2 Tessalonicenses', abbrFr: '2 Th', abbrPt: '2Ts', aliases: ['2th', '2ts', '2 thessaloniciens', '2 tessalonicenses'] },
  { id: 54, testament: 'NT', chapters: 6, nameFr: '1 Timothée', namePt: '1 Timóteo', abbrFr: '1 Tm', abbrPt: '1Tm', aliases: ['1tm', '1ti', '1 timothee', '1 timoteo'] },
  { id: 55, testament: 'NT', chapters: 4, nameFr: '2 Timothée', namePt: '2 Timóteo', abbrFr: '2 Tm', abbrPt: '2Tm', aliases: ['2tm', '2ti', '2 timothee', '2 timoteo'] },
  { id: 56, testament: 'NT', chapters: 3, nameFr: 'Tite', namePt: 'Tito', abbrFr: 'Tt', abbrPt: 'Tt', aliases: ['tt', 'tit', 'tite', 'tito'] },
  { id: 57, testament: 'NT', chapters: 1, nameFr: 'Philémon', namePt: 'Filemom', abbrFr: 'Phm', abbrPt: 'Fm', aliases: ['phm', 'fm', 'philemon', 'filemom'] },
  { id: 58, testament: 'NT', chapters: 13, nameFr: 'Hébreux', namePt: 'Hebreus', abbrFr: 'Hé', abbrPt: 'Hb', aliases: ['he', 'hb', 'heb', 'hebreux', 'hebreus'] },
  { id: 59, testament: 'NT', chapters: 5, nameFr: 'Jacques', namePt: 'Tiago', abbrFr: 'Jc', abbrPt: 'Tg', aliases: ['jc', 'tg', 'jam', 'jacques', 'tiago'] },
  { id: 60, testament: 'NT', chapters: 5, nameFr: '1 Pierre', namePt: '1 Pedro', abbrFr: '1 P', abbrPt: '1Pe', aliases: ['1p', '1pe', '1 pierre', '1 pedro'] },
  { id: 61, testament: 'NT', chapters: 3, nameFr: '2 Pierre', namePt: '2 Pedro', abbrFr: '2 P', abbrPt: '2Pe', aliases: ['2p', '2pe', '2 pierre', '2 pedro'] },
  { id: 62, testament: 'NT', chapters: 5, nameFr: '1 Jean', namePt: '1 João', abbrFr: '1 Jn', abbrPt: '1Jo', aliases: ['1jn', '1jo', '1 jean', '1 joao'] },
  { id: 63, testament: 'NT', chapters: 1, nameFr: '2 Jean', namePt: '2 João', abbrFr: '2 Jn', abbrPt: '2Jo', aliases: ['2jn', '2jo', '2 jean', '2 joao'] },
  { id: 64, testament: 'NT', chapters: 1, nameFr: '3 Jean', namePt: '3 João', abbrFr: '3 Jn', abbrPt: '3Jo', aliases: ['3jn', '3jo', '3 jean', '3 joao'] },
  { id: 65, testament: 'NT', chapters: 1, nameFr: 'Jude', namePt: 'Judas', abbrFr: 'Jd', abbrPt: 'Jd', aliases: ['jd', 'jud', 'jude', 'judas'] },
  { id: 66, testament: 'NT', chapters: 22, nameFr: 'Apocalypse', namePt: 'Apocalipse', abbrFr: 'Ap', abbrPt: 'Ap', aliases: ['ap', 'rev', 'apocalypse', 'apocalipse'] },
];

export function getBookMeta(bookId: number): BookMeta {
  return BIBLE_BOOKS[bookId - 1] ?? BIBLE_BOOKS[0];
}

export function getBookName(bookId: number, lang: 'fr' | 'pt'): string {
  const b = getBookMeta(bookId);
  return lang === 'pt' ? b.namePt : b.nameFr;
}

export function getBookAbbr(bookId: number, lang: 'fr' | 'pt'): string {
  const b = getBookMeta(bookId);
  return lang === 'pt' ? b.abbrPt : b.abbrFr;
}
