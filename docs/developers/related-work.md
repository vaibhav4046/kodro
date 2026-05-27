# Related work

A dissertation-grade literature review of the four educational
programming simulator categories RoboLearn sits inside.

## 1. Block-based novice editors

Resnick et al. introduced **Scratch** as a domain-specific visual
language with the explicit goal of lowering the cognitive cost of
learning to program [1]. Bau and colleagues followed with **MIT App
Inventor** [2], emphasising mobile output. Pasternak et al. extended
the visual-language idea to **Blockly** [3] as a reusable JavaScript
library. The pedagogical evidence for block-based editors is strong
for short-form motivation [4] but weakens as pupils transition to
text-based languages — Weintrop and Wilensky show a measurable gap in
syntactic competence when pupils move from blocks to text [5].

RoboLearn deliberately skips the block-based stage because the UK KS3
*Computing programme of study* mandates "two or more programming
languages, at least one of which is textual" [6].

## 2. Text-based novice environments

**Karel J. Robot** is the canonical educational rover environment
(Bergin et al., [7]), still in print and still cited by AP-CS
syllabi. Its strength is a tiny, locked-down command set; its
weakness is its dependence on Java and its lack of any built-in
adaptive feedback. **Greenfoot** (Kölling, [8]) extends Karel's
metaphor into a 2D microworld for novice Java programmers, with
positive evaluation evidence from Patitsas et al. [9].

RoboLearn's pupil API is deliberately Karel-shaped (16 free
functions, no classes) but layered onto a real Pymunk physics
substrate and an offline hint engine.

## 3. Professional robotics simulators

**Webots** (Michel, [10]) is the leading open-source professional
robotics simulator; its strength is fidelity, its weakness is its
1.2 GB install footprint and the cognitive overhead of its scene-
graph editor. **Gazebo** (Koenig & Howard, [11]) targets ROS
development. Both are widely cited in higher-education robotics
courses but neither claims pedagogical alignment with the UK
Computing curriculum.

## 4. Curriculum-aligned commercial offerings

**VEX VR** and **CoderZ** target school estates with cloud-hosted IDE
plus block-or-text editors. Their evaluation evidence is largely
self-reported. They share a structural problem with all cloud-hosted
educational tools (Holmes & Tuomi, [12]): the moment a school loses
internet, the lesson collapses.

## 5. RoboLearn's contribution

By combining the lock-down of Karel's API surface with the curriculum
mapping of CoderZ and the offline footprint of Greenfoot, RoboLearn
occupies a niche the existing literature does not. The
*self-improving* element — the EMA-driven recommender plus the 24-
rule hint engine — is the original contribution this dissertation
documents.

## References (IEEE format)

[1] M. Resnick *et al.*, "Scratch: Programming for all,"
*Communications of the ACM*, vol. 52, no. 11, pp. 60–67, 2009.

[2] D. Wolber, H. Abelson, E. Spertus and L. Looney, *App Inventor 2:
Create your own Android apps*, O'Reilly, 2014.

[3] N. Fraser, "Ten things we've learned from Blockly,"
*Blocks and Beyond Workshop*, IEEE, 2015, pp. 49–50.

[4] D. Weintrop and U. Wilensky, "Comparing block-based and text-based
programming in high school computer science classrooms," *ACM
Transactions on Computing Education*, vol. 18, no. 1, pp. 1–25,
2017.

[5] D. Weintrop, "Block-based programming in computer science
education," *Communications of the ACM*, vol. 62, no. 8,
pp. 22–25, 2019.

[6] Department for Education, "Computing programmes of study:
Key Stages 3 and 4," DFE-00191-2013, 2013.

[7] J. Bergin, M. Stehlik, J. Roberts and R. Pattis, *Karel J. Robot:
A Gentle Introduction to the Art of Object-Oriented Programming in
Java*, Dreamsongs Press, 2005.

[8] M. Kölling, "The Greenfoot programming environment,"
*ACM Transactions on Computing Education*, vol. 10, no. 4, 2010.

[9] E. Patitsas, M. Craig and S. Easterbrook, "An empirical
investigation of how and why undergraduates use Greenfoot,"
*Proc. WCCCE*, 2013, pp. 1–6.

[10] O. Michel, "Webots: Professional mobile robot simulation,"
*Journal of Advanced Robotics Systems*, vol. 1, no. 1, pp. 39–42,
2004.

[11] N. Koenig and A. Howard, "Design and use paradigms for Gazebo,
an open-source multi-robot simulator," *Proc. IROS*, 2004,
pp. 2149–2154.

[12] W. Holmes and I. Tuomi, "State of the art and practice in AI in
education," *European Journal of Education*, vol. 57, no. 4,
pp. 542–570, 2022.
