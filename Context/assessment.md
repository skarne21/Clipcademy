# Pre-test and post-test

Two forms, each with 10 multiple-choice questions and a written sheet of 4 short questions, covering four topics: DNA replication (L19 pp. 1–2) and DNA repair (L20 p. 1) with 3 multiple-choice questions each, and transcription (L21 p. 1) and translation (L22 pp. 1–2) with 2 each, plus one written question per topic. The app teaches replication and repair; transcription and translation are the comparison topics ([validation-plan.md](validation-plan.md)). Every question and correct answer comes from the lecture excerpts in the lesson packets (`learning/packets/`). Have a course-knowledgeable reviewer check the questions and the answer key before testing.

**Same ideas, different questions.** Question A*n* and question B*n* test the same idea, but in a different situation with a different correct answer, usually in a different position. A student who remembers what they picked on the first test gains nothing: that answer is wrong on the other form. Only knowing the idea helps. Their difficulty hasn't been checked for equality, so the forms are counterbalanced (below).

**No overlap with the app.** None of these questions reuse or reword the app's 24 practice questions (`learning/data/questions.json`). The app asks for a fact directly ("Which enzyme makes the RNA primer?"). These questions give a situation and ask what follows from it. If either file changes, recheck both and log the check in content-audit.csv.

**Giving the tests.**
- **Counterbalancing:** P01, P03 and P05 take Form A in the morning and Form B in the evening. P02, P04 and P06 take Form B in the morning and Form A in the evening. Record it in the `pre_form` column of participant-results.csv. If one form is easier, this keeps it from looking like a gain.
- Use the printable PDFs in [tests/](tests/): `form-A.pdf`, `form-B.pdf`, and `answer-key.pdf` for the moderator only. Rebuild them after any change here with `python learning/make_test_pdfs.py`. The PDFs don't include the written sheets yet: print the [written questions](#written-questions) for each form on a separate page and staple it after the multiple choice.
- No notes, phone or feedback. Collect the paper when they finish, and don't tell anyone their score or the answers until after the evening session, so there's nothing to look up between tests.

## Form A

**A1.** A template strand runs 3′ → 5′ from left to right. In which direction does the new strand grow along it?
- A. Right to left
- B. Left to right
- C. Both ways from the middle
- D. It can't grow along this strand

**A2.** A new DNA strand reads 5′-AGT-3′. The next nucleotide added is C. What does the strand read now?
- A. 5′-CAGT-3′
- B. 5′-ACGT-3′
- C. 5′-AGCT-3′
- D. 5′-AGTC-3′

**A3.** A tube holds a single-stranded DNA template, DNA nucleotides and DNA polymerase, but no primase and no primer. What happens?
- A. DNA is made in the 3′ to 5′ direction
- B. DNA polymerase makes its own primer first
- C. No new DNA is made
- D. DNA ligase starts the new strand

**A4.** A wrong base slipped past proofreading, and the DNA has now been fully copied. What can still correct it?
- A. Mismatch repair proteins
- B. DNA polymerase proofreading
- C. Primase replacing the base
- D. Nothing, the error is permanent

**A5.** UV light has bonded two neighbouring T's on one DNA strand. Why is this a problem for the cell?
- A. The two strands fall apart
- B. A base is lost from the strand
- C. A bulge blocks normal copying
- D. The T's turn into C's

**A6.** In UV-damage repair, what happens right after the damage site is recognized?
- A. New bases are put in the gap
- B. The backbone is sealed shut again
- C. An RNA primer is added to it
- D. The damaged piece is cut out

**A7.** An NTP carrying G enters RNA polymerase's active site. The next base on the template strand is C. What happens?
- A. It is joined to the growing RNA
- B. It isn't joined, because it doesn't match
- C. It pairs with the coding strand instead
- D. It waits for the coding strand to be read

**A8.** A mutation destroys a gene's promoter. What is the most direct effect?
- A. The ribosome can't find the start codon
- B. RNA polymerase can't start on the gene
- C. DNA polymerase can't copy the gene
- D. The tRNAs can't carry amino acids

**A9.** An mRNA codon reads CGA. Which tRNA anticodon pairs with it? (Bases are listed in the order they pair, like AUG and UAC in the notes.)
- A. CGA
- B. AGC
- C. GCA
- D. GCU

**A10.** A tRNA holding the growing protein sits in the P site, and a matching charged tRNA has just bound in the A site. What happens next?
- A. The A-site tRNA leaves from the E site
- B. The P-site tRNA picks up an amino acid
- C. A peptide bond joins their amino acids
- D. A new tRNA enters the P site

## Form B

**B1.** A template strand is drawn with its 5′ end on the left and its 3′ end on the right. Which way does the new strand grow as it's copied?
- A. Toward the right end
- B. Outward from the middle
- C. Toward the left end
- D. It can't be copied

**B2.** A new DNA strand reads 5′-ACG-3′. Then T is added, then A. What does it read now?
- A. 5′-ATACG-3′
- B. 5′-ACGTA-3′
- C. 5′-TAACG-3′
- D. 5′-ACGAT-3′

**B3.** In a cell, primase stops working but DNA polymerase is normal. Why can't the cell copy its DNA?
- A. There's no primer to build onto
- B. The template strand can't be read
- C. New strands would grow 3′ to 5′
- D. DNA polymerase runs out of nucleotides

**B4.** A cell's mismatch repair proteins don't work, but its DNA polymerase is normal. When can a wrong base still be fixed?
- A. Before copying starts
- B. Only after copying is finished
- C. Never, in this cell
- D. While the DNA is being copied

**B5.** A gene has a UV bulge in its backbone that was never repaired. What happens when the cell tries to transcribe that gene?
- A. It's read from the other end
- B. It can't be read normally
- C. The bulge is copied into the RNA
- D. Only the coding strand is read

**B6.** Which order of steps repairs UV damage?
- A. Cut out, recognize, replace, reseal
- B. Recognize, replace, cut out, reseal
- C. Recognize, cut out, replace, reseal
- D. Recognize, reseal, cut out, replace

**B7.** An NTP carrying A enters RNA polymerase's active site. The next base on the template strand is G. What happens?
- A. It is joined to the growing RNA
- B. It isn't joined, because it doesn't match
- C. It pairs with the coding strand instead
- D. It waits for the coding strand to be read

**B8.** RNA polymerase is present, but it never starts transcribing gene G. Which part of gene G is most likely damaged?
- A. Its start codon
- B. Its coding strand
- C. Its anticodon
- D. Its promoter

**B9.** A tRNA's anticodon is AAG. Which mRNA codon does it pair with? (Bases are listed in the order they pair, like AUG and UAC in the notes.)
- A. AAG
- B. UUC
- C. GAA
- D. UUG

**B10.** In what order does one tRNA pass through the ribosome's sites?
- A. A, then P, then E
- B. P, then A, then E
- C. E, then A, then P
- D. A, then E, then P

## Written questions

One per topic on each form, answered in a sentence or two without answer choices. They measure recall rather than recognition. The reviewer checks them against the app questions and the multiple choice on the same form, and adds a `test:` row for each in content-audit.csv.

**Form A**
- **WA1 (replication).** A new strand ends in …G-C-3′. Where does the next nucleotide go, and which way does the strand grow?
- **WA2 (repair).** A wrong base is added while DNA is copied. Name the two ways it can be fixed and when each acts.
- **WA3 (transcription).** How does RNA polymerase decide which nucleotide to add next?
- **WA4 (translation).** What happens in the A, P and E sites as one amino acid is added?

**Form B**
- **WB1 (replication).** Why can a new DNA strand only grow 5′ → 3′?
- **WB2 (repair).** Mismatch repair proteins stop working. Which errors can still be fixed, and by what?
- **WB3 (transcription).** A gene's coding strand reads 5′-ATG-3′. What does its RNA read, and why?
- **WB4 (translation).** An mRNA codon reads GGC. Which anticodon pairs with it, and why must it match?

**Rubric (moderator only)**

| Item | 2 points | 1 point |
| --- | --- | --- |
| WA1 | 3′ end and 5′→3′ | One of the two |
| WA2 | Proofreading by polymerase during copying and mismatch repair after | One process with its timing |
| WA3 | Pairs with the next template-strand base (U for A) | "It matches the DNA" without the strand |
| WA4 | A: charged tRNA enters; P: peptide bond; E: empty tRNA leaves | Two sites right |
| WB1 | Nucleotides join only at the 3′ end, so growth runs 5′→3′ | Direction without the reason |
| WB2 | Errors caught during copying, by polymerase proofreading | "Proofreading" without the timing |
| WB3 | 5′-AUG-3′: same as the coding strand with U for T, because RNA pairs with the template | The sequence without the reason |
| WB4 | CCG, and pairing picks the right amino acid | The anticodon only |

Anything else scores 0. The scorer works from copies with the participant code covered and the morning and evening sheets shuffled together.

## Answer key (moderator only)

| Item | Answer | Idea tested | Source | Closest app question, and why it isn't a reword |
| --- | --- | --- | --- | --- |
| A1 | B | Strands are antiparallel; new DNA grows 5′→3′ | L19-p1 | `rep-r3` asks the direction directly. A1 and B1 give a template's orientation, so the student has to apply antiparallel pairing |
| B1 | C | Strands are antiparallel; new DNA grows 5′→3′ | L19-p1 | As A1 |
| A2 | D | Nucleotides join the 3′ end | L19-p1 | `rep-q1` and `rep-r1` ask which end. A2 and B2 ask the student to write the strand after an addition |
| B2 | B | Nucleotides join the 3′ end | L19-p1 | As A2 |
| A3 | C | DNA polymerase can't start a strand, so it needs a primer | L19-p1, L19-p2 | `rep-q2` asks why a primer is needed. A3 asks what happens without one |
| B3 | A | DNA polymerase can't start a strand, so it needs a primer | L19-p2 | `rep-r2` asks which enzyme makes the primer. B3 asks what's missing when it fails |
| A4 | A | Proofreading acts during copying, mismatch repair after | L20-p1 | `dr-r1` asks when mismatch repair scans. A4 asks which process is left in a situation |
| B4 | D | Proofreading acts during copying, mismatch repair after | L20-p1 | `dr-r3` asks which correction happens during copying. B4 removes mismatch repair and asks when a fix is still possible |
| A5 | C | A UV bulge stops the gene from being copied or transcribed | L20-p1 | `dr-q2` asks what UV does. A5 and B5 ask why the damage matters |
| B5 | B | A UV bulge stops the gene from being copied or transcribed | L20-p1 | As A5 |
| A6 | D | UV repair: recognize, cut out, replace, reseal | L20-p1 | `dr-r2` and `dr-r4` ask the first and last steps. A6 asks the second, B6 the full order |
| B6 | C | UV repair: recognize, cut out, replace, reseal | L20-p1 | As A6 |
| A7 | A | RNA polymerase joins an NTP only if it matches the template strand | L21-p1 | `tx-r3` asks which strand the RNA is complementary to. A7 and B7 ask what happens to one NTP |
| B7 | B | RNA polymerase joins an NTP only if it matches the template strand | L21-p1 | As A7 |
| A8 | B | The promoter is where RNA polymerase starts | L21-p1 | `tx-q2` asks for the definition. A8 asks the effect of losing it, B8 works back from a gene that is never transcribed |
| B8 | D | The promoter is where RNA polymerase starts | L21-p1 | As A8 |
| A9 | D | The anticodon is complementary to the codon | L22-p1 | `tl-q2` pairs AUG with UAC. A9 and B9 use other bases, so the student has to pair each one. The closest call: same skill, different bases |
| B9 | B | The anticodon is complementary to the codon | L22-p1 | As A9 |
| A10 | C | A: tRNA enters · P: peptide bond · E: tRNA exits | L22-p2 | `tl-q1` asks which site. A10 gives both sites filled and asks what happens next |
| B10 | A | A: tRNA enters · P: peptide bond · E: tRNA exits | L22-p1, L22-p2 | `tl-r1` and `tl-r3` ask one site each. B10 asks the order |

**Check, 2026-11-03** (Member 2): no question appears on both forms or rewords an app question. Paired questions never share a correct answer, and no correct answer is the longest choice by more than a word's difference. In A9 and B9 the wrong choices leave out the reversed complement, so the question works whichever way a student writes the anticodon. The reviewer decides, and fills in `overlaps_app_question` for each `test:` row in content-audit.csv.

## Scoring

Score each multiple-choice question 1 if correct and 0 otherwise, using the key. Score each written question 0–2 using the rubric. Enter every answer and its score in test-responses.csv. Then record the totals per topic in participant-results.csv: `<topic>_pre_mc`, `<topic>_pre_wr`, `<topic>_post_mc` and `<topic>_post_wr` for `rep`, `dr`, `tx` and `tl`, whichever form was taken.

| Topic | Multiple choice | Written | Total |
| --- | --- | --- | --- |
| Replication (taught) | 0–3 | 0–2 | 5 |
| Repair (taught) | 0–3 | 0–2 | 5 |
| Transcription (comparison) | 0–2 | 0–2 | 4 |
| Translation (comparison) | 0–2 | 0–2 | 4 |

H1 compares the taught total (of 10) with the comparison total (of 8) as percentage gains ([hypothesis-tests.md](hypothesis-tests.md)). Don't give feedback on either test.
