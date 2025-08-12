// counterpoint-linter.ts
// Minimal counterpoint linter: homorhythmic, two voices, space-separated notes like: "C4 D4 E4 F4"
// Rules: parallel 5ths/8ves, leaps > octave, unresolved leading tone (resolves up by semitone)
declare const require: any;
declare const module: any;

type IssueType = 'Parallel5ths' | 'Parallel8ves' | 'LeapOverOctave' | 'UnresolvedLeadingTone' | 'LengthMismatch' | 'ParseError';
type Voice = 'A' | 'B';

interface Note {
  raw: string;
  midi: number;      // MIDI number (C4=60)
  pc: number;        // pitch class 0..11
}

interface Issue {
  type: IssueType;
  index?: number;    // refers to the FIRST of the two notes for parallel checks
  voice?: Voice;
  details: string;
}

const LETTER_TO_PC: Record<string, number> = { C:0, D:2, E:4, F:5, G:7, A:9, B:11 };

function mod12(n: number) { return ((n % 12) + 12) % 12; }

function parseNote(token: string): Note | null {
  const m = token.trim().match(/^([A-Ga-g])([#b]?)(-?\d+)$/);
  if (!m) return null;
  const letter = m[1].toUpperCase();
  const acc = m[2];
  const oct = parseInt(m[3], 10);
  let pc = LETTER_TO_PC[letter];
  if (acc === '#') pc += 1;
  else if (acc === 'b') pc -= 1;
  pc = mod12(pc);
  const midi = 12 * (oct + 1) + pc; // C4=60
  return { raw: token, midi, pc };
}

function parseMelody(line: string): { notes: Note[]; issues: Issue[] } {
  const tokens = line.trim().split(/\s+/).filter(Boolean);
  const issues: Issue[] = [];
  const notes: Note[] = [];
  tokens.forEach((t, i) => {
    const n = parseNote(t);
    if (!n) issues.push({ type: 'ParseError', index: i, details: `Cannot parse note "${t}"` });
    else notes.push(n);
  });
  return { notes, issues };
}

function parseKey(keyStr: string): { tonicPC: number; mode: 'major' | 'minor' } | null {
  const m = keyStr.trim().match(/^([A-Ga-g])([#b]?)\s*(major|minor)$/i);
  if (!m) return null;
  const letter = m[1].toUpperCase();
  const acc = m[2];
  const mode = m[3].toLowerCase() as 'major' | 'minor';
  let pc = LETTER_TO_PC[letter];
  if (acc === '#') pc += 1;
  else if (acc === 'b') pc -= 1;
  return { tonicPC: mod12(pc), mode };
}

function sign(n: number) { return n === 0 ? 0 : (n > 0 ? 1 : -1); }

function lintCounterpoint(
  upperLine: string,
  lowerLine: string,
  keyStr: string
): Issue[] {
  const issues: Issue[] = [];

  const key = parseKey(keyStr);
  if (!key) {
    issues.push({ type: 'ParseError', details: `Key "${keyStr}" not understood. Use like "C major" or "A minor".` });
    return issues;
  }
  const leadingPC = mod12(key.tonicPC - 1); // semitone below tonic
  const tonicPC = key.tonicPC;

  const { notes: A, issues: parseA } = parseMelody(upperLine);
  const { notes: B, issues: parseB } = parseMelody(lowerLine);
  issues.push(...parseA, ...parseB);

  if (A.length !== B.length) {
    issues.push({ type: 'LengthMismatch', details: `Voices have different lengths (${A.length} vs ${B.length}). Lint assumes aligned notes.` });
  }
  const N = Math.min(A.length, B.length);

  // Rule 1: Parallel 5ths & 8ves (by similar motion; both voices move same nonzero direction)
  for (let i = 0; i < N - 1; i++) {
    const int1 = Math.abs(A[i].midi - B[i].midi);
    const int2 = Math.abs(A[i+1].midi - B[i+1].midi);
    const pc1 = mod12(int1);
    const pc2 = mod12(int2);
    const dirA = sign(A[i+1].midi - A[i].midi);
    const dirB = sign(B[i+1].midi - B[i].midi);
    const similar = dirA !== 0 && dirB !== 0 && dirA === dirB;

    if (similar && pc1 === 7 && pc2 === 7) {
      issues.push({ type: 'Parallel5ths', index: i, details: `Parallel 5ths at positions ${i}→${i+1} (${A[i].raw}/${B[i].raw} → ${A[i+1].raw}/${B[i+1].raw})` });
    }
    if (similar && pc1 === 0 && pc2 === 0) {
      issues.push({ type: 'Parallel8ves', index: i, details: `Parallel 8ves (or unisons) at positions ${i}→${i+1}` });
    }
  }

  // Rule 2: Leaps > octave (each voice)
  for (let i = 0; i < A.length - 1; i++) {
    const leap = Math.abs(A[i+1].midi - A[i].midi);
    if (leap > 12) issues.push({ type: 'LeapOverOctave', voice: 'A', index: i, details: `Upper voice leaps ${leap} semitones at ${i}→${i+1} (${A[i].raw}→${A[i+1].raw})` });
  }
  for (let i = 0; i < B.length - 1; i++) {
    const leap = Math.abs(B[i+1].midi - B[i].midi);
    if (leap > 12) issues.push({ type: 'LeapOverOctave', voice: 'B', index: i, details: `Lower voice leaps ${leap} semitones at ${i}→${i+1} (${B[i].raw}→${B[i+1].raw})` });
  }

  // Rule 3: Unresolved leading tone (must resolve up by semitone to tonic)
  for (let i = 0; i < A.length - 1; i++) {
    if (A[i].pc === leadingPC) {
      const stepUp = mod12(A[i+1].pc - A[i].pc) === 1;
      if (!(A[i+1].pc === tonicPC && stepUp)) {
        issues.push({ type: 'UnresolvedLeadingTone', voice: 'A', index: i, details: `Upper voice leading tone (${A[i].raw}) does not resolve up by semitone to tonic` });
      }
    }
  }
  for (let i = 0; i < B.length - 1; i++) {
    if (B[i].pc === leadingPC) {
      const stepUp = mod12(B[i+1].pc - B[i].pc) === 1;
      if (!(B[i+1].pc === tonicPC && stepUp)) {
        issues.push({ type: 'UnresolvedLeadingTone', voice: 'B', index: i, details: `Lower voice leading tone (${B[i].raw}) does not resolve up by semitone to tonic` });
      }
    }
  }

  return issues;
}

// ---------------- Demo ----------------
if (require.main === module) {
  const key = "C major";
  const upper = "E4 A4 B4 A4 B4 C5 D5 C5";
  const lower = "C3 D3 E3 F3 G3 A3 B2 C3";
  // This demo intentionally contains a hidden unresolved leading tone in lower voice (B2->C3 ok) and a clean run;
  // tweak to test warnings, e.g. make lower "... A3 B3 C4 C3" to provoke parallels/unresolved.

  const issues = lintCounterpoint(upper, lower, key);
  console.log(`Key: ${key}`);
  console.log(`Upper: ${upper}`);
  console.log(`Lower: ${lower}`);
  if (issues.length === 0) console.log("✅ No issues found.");
  else {
    console.log("⚠️  Issues:");
    for (const i of issues) {
      const at = i.index !== undefined ? ` [idx ${i.index}]` : "";
      const v = i.voice ? ` [voice ${i.voice}]` : "";
      console.log(`- ${i.type}${v}${at}: ${i.details}`);
    }
  }
}

// Export for reuse
//export { lintCounterpoint };
