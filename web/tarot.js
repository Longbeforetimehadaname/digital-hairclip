// Tarot-Deck (78 Karten) und Ziehen von Karten. Reine Daten und Funktionen, ohne Browser.
// Die Firmware bekommt dieselben Daten über tools/gen-firmware-data.mjs (firmware/src/tarot_data.h).
// Schreibweise wie in der Schweiz: ss statt ß.

// Grosse Arkana: [Name, Zahl, aufrecht, umgekehrt]
const MAJOR = [
  ['Der Narr', '0', 'Neubeginn, Mut, Leichtigkeit', 'Leichtsinn, Zögern, Chaos'],
  ['Der Magier', 'I', 'Willenskraft, Können, Tatkraft', 'Täuschung, Zweifel, Blockade'],
  ['Die Hohepriesterin', 'II', 'Intuition, Geheimnis, Stille', 'Verdrängung, Unsicherheit, Lärm'],
  ['Die Herrscherin', 'III', 'Fülle, Fürsorge, Kreativität', 'Abhängigkeit, Leere, Stillstand'],
  ['Der Herrscher', 'IV', 'Struktur, Stabilität, Führung', 'Starrheit, Kontrolle, Chaos'],
  ['Der Hierophant', 'V', 'Tradition, Rat, Vertrauen', 'Rebellion, Dogma, Freiheit'],
  ['Die Liebenden', 'VI', 'Liebe, Harmonie, Wahl', 'Zweifel, Ungleichgewicht, Trennung'],
  ['Der Wagen', 'VII', 'Sieg, Wille, Aufbruch', 'Ziellosigkeit, Widerstand, Hast'],
  ['Die Kraft', 'VIII', 'Mut, Sanftmut, Geduld', 'Selbstzweifel, Schwäche, Ungeduld'],
  ['Der Eremit', 'IX', 'Rückzug, Weisheit, Suche', 'Einsamkeit, Isolation, Weltflucht'],
  ['Rad des Schicksals', 'X', 'Wandel, Glück, Zyklus', 'Pech, Widerstand, Stillstand'],
  ['Die Gerechtigkeit', 'XI', 'Wahrheit, Fairness, Klarheit', 'Unrecht, Unehrlichkeit, Ausreden'],
  ['Der Gehängte', 'XII', 'Hingabe, Pause, neue Sicht', 'Stillstand, Opfer, Zögern'],
  ['Der Tod', 'XIII', 'Ende, Wandlung, Neubeginn', 'Festhalten, Angst, Stillstand'],
  ['Die Mässigkeit', 'XIV', 'Balance, Geduld, Heilung', 'Übermass, Ungeduld, Unruhe'],
  ['Der Teufel', 'XV', 'Versuchung, Bindung, Lust', 'Befreiung, Loslassen, Erkenntnis'],
  ['Der Turm', 'XVI', 'Umbruch, Erkenntnis, Befreiung', 'Angst vor Wandel, Aufschub, Krise'],
  ['Der Stern', 'XVII', 'Hoffnung, Heilung, Inspiration', 'Mutlosigkeit, Zweifel, Leere'],
  ['Der Mond', 'XVIII', 'Träume, Intuition, Unklarheit', 'Klarheit, Angst lösen, Verwirrung'],
  ['Die Sonne', 'XIX', 'Freude, Erfolg, Wärme', 'Übermut, Trübung, Verzögerung'],
  ['Das Gericht', 'XX', 'Erwachen, Ruf, Neuanfang', 'Selbstzweifel, Zögern, Vorwürfe'],
  ['Die Welt', 'XXI', 'Vollendung, Ganzheit, Reise', 'Unvollendet, Umweg, Stillstand'],
];

export const SUITS = ['Stäbe', 'Kelche', 'Schwerter', 'Münzen'];
const RANKS = ['Ass', 'Zwei', 'Drei', 'Vier', 'Fünf', 'Sechs', 'Sieben', 'Acht', 'Neun', 'Zehn', 'Bube', 'Ritter', 'Königin', 'König'];
const RANK_MARK = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'B', 'R', 'Kö', 'K'];

// Kleine Arkana: pro Farbe 14 Karten [aufrecht, umgekehrt]
const MINOR = [
  [ // Stäbe: Energie, Tatkraft
    ['Inspiration, Energie, Anfang', 'Verzögerung, Antriebslosigkeit, Frust'],
    ['Planung, Weitblick, Entscheidung', 'Unsicherheit, Angst, Planlosigkeit'],
    ['Fortschritt, Weitsicht, Wachstum', 'Hindernisse, Verzögerung, Enttäuschung'],
    ['Feier, Heimat, Harmonie', 'Unruhe, Übergang, Spannung'],
    ['Wettstreit, Konflikt, Reibung', 'Einigung, Vermeidung, Ruhe'],
    ['Erfolg, Anerkennung, Sieg', 'Selbstzweifel, Hochmut, Rückschlag'],
    ['Standhaftigkeit, Mut, Haltung', 'Überforderung, Aufgeben, Rückzug'],
    ['Tempo, Nachrichten, Bewegung', 'Verzögerung, Hast, Stau'],
    ['Ausdauer, Wachsamkeit, Kraft', 'Erschöpfung, Misstrauen, Sturheit'],
    ['Last, Verantwortung, Pflicht', 'Entlastung, Überlastung, Abgeben'],
    ['Neugier, Begeisterung, Botschaft', 'Ungeduld, Launen, Zerstreutheit'],
    ['Abenteuer, Leidenschaft, Tatendrang', 'Ungestüm, Leichtsinn, Unruhe'],
    ['Selbstvertrauen, Wärme, Ausstrahlung', 'Eifersucht, Unsicherheit, Härte'],
    ['Vision, Führung, Unternehmergeist', 'Überheblichkeit, Ungeduld, Druck'],
  ],
  [ // Kelche: Gefühl, Liebe
    ['Liebe, Gefühl, Neubeginn', 'Verschlossenheit, Leere, Trauer'],
    ['Partnerschaft, Verbindung, Anziehung', 'Trennung, Missverständnis, Ungleichgewicht'],
    ['Freundschaft, Feier, Gemeinschaft', 'Übermass, Klatsch, Distanz'],
    ['Grübeln, Rückzug, Unzufriedenheit', 'Neues Interesse, Erwachen, Annahme'],
    ['Verlust, Trauer, Bedauern', 'Annahme, Heilung, Weitergehen'],
    ['Erinnerung, Unschuld, Kindheit', 'Festhalten, Nostalgie, Reife'],
    ['Träume, Möglichkeiten, Fantasie', 'Klarheit, Entscheidung, Ernüchterung'],
    ['Aufbruch, Loslassen, Suche', 'Angst vor Wandel, Verharren, Ziellosigkeit'],
    ['Zufriedenheit, Wunscherfüllung, Genuss', 'Unzufriedenheit, Übermass, Eitelkeit'],
    ['Familienglück, Harmonie, Geborgenheit', 'Streit, Entfremdung, Brüche'],
    ['Sensibilität, Kreativität, Botschaft', 'Launen, Unreife, Verletzlichkeit'],
    ['Romantik, Charme, Einladung', 'Schwärmerei, Enttäuschung, Launen'],
    ['Mitgefühl, Intuition, Fürsorge', 'Überempfindlichkeit, Abhängigkeit, Selbstaufgabe'],
    ['Gelassenheit, Güte, Ausgleich', 'Verdrängung, Launen, Manipulation'],
  ],
  [ // Schwerter: Verstand, Wahrheit
    ['Klarheit, Wahrheit, Durchbruch', 'Verwirrung, Härte, Fehlurteil'],
    ['Patt, Abwägen, Blockade', 'Entscheidung, Überforderung, Klarheit'],
    ['Herzschmerz, Kummer, Trennung', 'Heilung, Vergebung, Erleichterung'],
    ['Ruhe, Erholung, Besinnung', 'Unruhe, Erschöpfung, Neustart'],
    ['Konflikt, Niederlage, Egoismus', 'Versöhnung, Reue, Einsicht'],
    ['Übergang, Weiterziehen, Heilung', 'Stillstand, Ballast, Widerstand'],
    ['List, Strategie, Heimlichkeit', 'Ehrlichkeit, Geständnis, Ertapptwerden'],
    ['Einschränkung, Hilflosigkeit, Angst', 'Befreiung, Selbstvertrauen, Ausweg'],
    ['Sorgen, Schlaflosigkeit, Angst', 'Hoffnung, Erleichterung, Zuversicht'],
    ['Ende, Tiefpunkt, Abschluss', 'Erholung, Neubeginn, Überleben'],
    ['Wissbegier, Wachsamkeit, Ideen', 'Klatsch, Vorschnelligkeit, Zynismus'],
    ['Entschlossenheit, Tempo, Ehrgeiz', 'Rücksichtslosigkeit, Hast, Streit'],
    ['Klarheit, Unabhängigkeit, Ehrlichkeit', 'Kälte, Bitterkeit, Strenge'],
    ['Verstand, Autorität, Gerechtigkeit', 'Härte, Manipulation, Rechthaberei'],
  ],
  [ // Münzen: Körper, Geld, Alltag
    ['Chance, Wohlstand, Grundstein', 'Verpasste Chance, Unsicherheit, Verlust'],
    ['Balance, Flexibilität, Jonglieren', 'Überforderung, Chaos, Ungleichgewicht'],
    ['Zusammenarbeit, Können, Handwerk', 'Mittelmass, Uneinigkeit, Nachlässigkeit'],
    ['Sicherheit, Sparsamkeit, Kontrolle', 'Geiz, Verlustangst, Loslassen'],
    ['Mangel, Sorgen, Ausgrenzung', 'Erholung, Hilfe, Besserung'],
    ['Grosszügigkeit, Teilen, Ausgleich', 'Schulden, Abhängigkeit, Ungleichheit'],
    ['Geduld, Bilanz, Wachstum', 'Ungeduld, Zweifel, Zeitverschwendung'],
    ['Fleiss, Übung, Meisterschaft', 'Perfektionismus, Langeweile, Schlamperei'],
    ['Unabhängigkeit, Genuss, Wohlstand', 'Abhängigkeit, Überarbeitung, Fassade'],
    ['Familie, Erbe, Beständigkeit', 'Geldstreit, Instabilität, Verlust'],
    ['Lernen, Ehrgeiz, Neuanfang', 'Faulheit, Planlosigkeit, Ablenkung'],
    ['Zuverlässigkeit, Fleiss, Geduld', 'Trägheit, Sturheit, Langeweile'],
    ['Fürsorge, Bodenständigkeit, Wohlstand', 'Selbstvernachlässigung, Sorge, Besitzdenken'],
    ['Wohlstand, Sicherheit, Erfolg', 'Gier, Sturheit, Materialismus'],
  ],
];

const words = (s) => s.split(', ');

// Karte: { id, name, mark (Zahl oben auf der Karte), suit (-1 = Grosse Arkana, sonst 0–3), rank (0–13), up, down }
export const DECK = [
  ...MAJOR.map(([name, mark, up, down], i) => ({ id: i, name, mark, suit: -1, rank: i, up: words(up), down: words(down) })),
  ...MINOR.flatMap((cards, suit) => cards.map(([up, down], rank) => ({
    id: 22 + suit * 14 + rank,
    name: `${RANKS[rank]} der ${SUITS[suit]}`,
    mark: RANK_MARK[rank],
    suit,
    rank,
    up: words(up),
    down: words(down),
  }))),
];

export const SPREAD_LABELS = ['Vergangenheit', 'Gegenwart', 'Zukunft'];
export const REVERSED_CHANCE = 0.3; // so oft liegt eine Karte umgekehrt (Firmware: gleicher Wert)

// Zieht `count` verschiedene Karten. `random` liefert Zahlen in [0, 1).
// Ergebnis: [{ id, reversed }, …]
export function drawCards(count, random = Math.random) {
  const ids = DECK.map((c) => c.id);
  const out = [];
  for (let i = 0; i < count; i++) {
    const j = i + Math.floor(random() * (ids.length - i));
    [ids[i], ids[j]] = [ids[j], ids[i]];
    out.push({ id: ids[i], reversed: random() < REVERSED_CHANCE });
  }
  return out;
}

// Kurze Deutung als Text, z. B. für die Webseite
export function reading(cards) {
  return cards.map(({ id, reversed }, i) => {
    const c = DECK[id];
    return {
      label: cards.length === 3 ? SPREAD_LABELS[i] : 'Deine Karte',
      name: c.name,
      reversed,
      words: reversed ? c.down : c.up,
    };
  });
}
