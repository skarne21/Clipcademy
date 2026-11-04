# Pre-test and post-test

Two multiple-choice forms of 8 questions each: Form A on Day 0, before the app, and Form B on Day 2. Each form has 2 questions on each of the four topics the clips cover: DNA replication (L19 pp. 1–2), DNA repair (L20 p. 1), transcription (L21 p. 1) and translation (L22 pp. 1–2). Every question and every correct answer comes from the lecture excerpts in the lesson packets (`learning/packets/`). Have a course-knowledgeable reviewer check the questions and the answer key before testing.

**Forms.** Questions A*n* and B*n* cover the same topic and the same idea, but no question appears on both forms. Their difficulty hasn't been checked for equality.

**No overlap with the app.** None of these questions reuse or reword the app's 24 practice questions (`learning/data/questions.json`). The app asks for a fact directly ("Which enzyme makes the RNA primer?"). These questions give a situation and ask what follows from it. If either file changes, recheck both and log the check in content-audit.csv.

**Giving the test.** Print the form without the answer key and the "closest app question" notes, or put the questions in a form tool with the choices in this order. One answer per question, no feedback, and no notes or phone.

## Form A (pre-test, Day 0)

**A1.** A template strand runs 3′ → 5′ from left to right. In which direction does the new strand grow along it?
- A. Right to left
- B. Left to right
- C. Both ways from the middle
- D. It can't grow along this strand

**A2.** A tube holds a single-stranded DNA template, DNA nucleotides and DNA polymerase, but no primase and no primer. What happens?
- A. No new DNA is made
- B. DNA is made in the 3′ to 5′ direction
- C. DNA polymerase makes its own primer first
- D. DNA ligase starts the new strand

**A3.** A wrong base slipped past proofreading, and the DNA has now been fully copied. What can still correct it?
- A. DNA polymerase proofreading
- B. Primase replacing the base
- C. Mismatch repair proteins
- D. Nothing, the error is permanent

**A4.** UV light has bonded two neighbouring T's on one DNA strand. Why is this a problem for the cell?
- A. The two strands fall apart
- B. A base is lost from the strand
- C. The T's turn into C's
- D. A bulge blocks normal copying

**A5.** Which bonds does RNA polymerase form during transcription?
- A. Peptide bonds between amino acids
- B. Links between ribonucleotides
- C. Pairs of codons and anticodons
- D. Links between deoxyribonucleotides

**A6.** A mutation destroys a gene's promoter. What is the most direct effect?
- A. RNA polymerase can't start on the gene
- B. The ribosome can't find the start codon
- C. DNA polymerase can't copy the gene
- D. The tRNAs can't carry amino acids

**A7.** An mRNA codon reads CGA. Which tRNA anticodon pairs with it?
- A. CGA
- B. AGC
- C. GCU
- D. UCG

**A8.** A tRNA holding the growing protein sits in the P site, and a matching charged tRNA has just bound in the A site. What happens next?
- A. The A-site tRNA leaves from the E site
- B. A peptide bond joins their amino acids
- C. The P-site tRNA picks up an amino acid
- D. A new tRNA enters the P site

## Form B (post-test, Day 2)

**B1.** A new DNA strand reads 5′-ACG-3′. Then T is added, then A. What does it read now?
- A. 5′-ATACG-3′
- B. 5′-TAACG-3′
- C. 5′-ACGTA-3′
- D. 5′-ACGAT-3′

**B2.** In a cell, primase stops working but DNA polymerase is normal. Why can't the cell copy its DNA?
- A. The template strand can't be read
- B. New strands would grow 3′ to 5′
- C. DNA polymerase runs out of nucleotides
- D. There's no primer to build onto

**B3.** Which activity of DNA polymerase removes a wrong base during proofreading?
- A. Exonuclease activity
- B. Ligase activity
- C. Primase activity
- D. Mismatch repair activity

**B4.** In UV-damage repair, what happens right after the damage site is recognized?
- A. New bases are put in the gap
- B. The damaged piece is cut out
- C. The backbone is sealed shut again
- D. An RNA primer is added to it

**B5.** An NTP enters RNA polymerase's active site. When is it joined to the growing RNA?
- A. Whenever it enters the channel
- B. When it pairs with the next coding-strand base
- C. When it pairs with the next template-strand base
- D. When a tRNA delivers it

**B6.** RNA polymerase is present, but it never starts transcribing gene G. Which part of gene G is most likely damaged?
- A. Its start codon
- B. Its coding strand
- C. Its anticodon
- D. Its promoter

**B7.** Why does a cell need a different tRNA for each of the 20 amino acids?
- A. Each tRNA can be used only once
- B. Each amino acid has different codons
- C. Each tRNA enters at a different site
- D. Each amino acid needs its own ribosome

**B8.** In what order does one tRNA pass through the ribosome's sites?
- A. A, then P, then E
- B. P, then A, then E
- C. E, then A, then P
- D. A, then E, then P

## Answer key (moderator only)

| Item | Answer | Source | Closest app question, and why it isn't a reword |
| --- | --- | --- | --- |
| A1 | B | L19-p1: antiparallel strands, 5′→3′ synthesis | `rep-r3` asks the growth direction directly. A1 gives a template's orientation, so the student has to apply antiparallel pairing |
| A2 | A | L19-p1, L19-p2: polymerase can't start a strand | `rep-q2` asks why a primer is needed. A2 asks what happens in a tube without one |
| A3 | C | L20-p1: mismatch repair after replication | `dr-r1` asks when mismatch repair scans. A3 asks which process can still act in a situation |
| A4 | D | L20-p1: the bulge prevents normal copying | `dr-q2` asks what UV does. A4 gives the damage and asks why it matters |
| A5 | B | L21-p1: phosphodiester linkages between ribonucleotides | None asks what transcription joins |
| A6 | A | L21-p1: promoter is where RNA polymerase first contacts DNA | `tx-q2` asks for the definition. A6 asks for the effect of losing it |
| A7 | C | L22-p1: anticodon is complementary to the codon | `tl-q2` pairs AUG with UAC. A7 uses a different codon, so the student has to pair each base |
| A8 | B | L22-p2: the bond forms between the P-site and A-site amino acids | `tl-q1` asks which site. A8 gives both sites filled and asks what happens next |
| B1 | C | L19-p1: bases are added to the 3′ end | `rep-q1` asks which end. B1 asks the student to write the strand after two additions |
| B2 | D | L19-p2: primase makes the primer DNA polymerase extends | `rep-r2` asks which enzyme makes the primer. B2 asks what is missing without it |
| B3 | A | L20-p1: proofreading uses polymerase's exonuclease activity | None asks how proofreading removes a base |
| B4 | B | L20-p1: step 2, cut the backbone and remove the damaged bases | `dr-r2` and `dr-r4` ask the first and last steps. B4 asks the second |
| B5 | C | L21-p1: an NTP is joined if it matches the next template base | `tx-r3` asks which strand the RNA is complementary to. B5 asks when one NTP is joined |
| B6 | D | L21-p1: promoter is where transcription starts | `tx-q2` asks for the definition. B6 works back from a gene that is never transcribed |
| B7 | B | L22-p1: a different tRNA for each of the 20 amino acids | None |
| B8 | A | L22-p1, L22-p2: enter at A, bond at P, exit from E | `tl-r1` and `tl-r3` ask for one site each. B8 asks the order |

**Check, 2026-11-03** (Member 2): no item reuses or rewords an app question, and no item appears on both forms. A7 is the closest: it is the same skill as `tl-q2` with a different codon. The reviewer decides, and fills in `overlaps_app_question` for each `test:` row in content-audit.csv.

## Scoring

Score each question 1 if correct and 0 otherwise, using the key, for a total of 0–8. Record the total in participant-results.csv. If transcription or translation stay "Coming soon" in the frozen build, also record the score on just the topics that were open (see validation-plan.md, H2). Don't give feedback on either test.
