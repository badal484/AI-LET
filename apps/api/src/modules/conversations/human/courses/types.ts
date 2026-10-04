/**
 * A complete course, written down once and checked against the official docs — not made up by the model
 * on the spot (it skipped topics and the order changed every time). Lessons are numbered across the whole
 * course (1…N); every topic of a lesson is taught and practised before the lesson counts as done.
 */
export interface CourseLesson {
  title: string;
  /** Everything this lesson must cover, in teaching order. */
  topics: string[];
}

export interface CourseLevel {
  title: string;
  lessons: CourseLesson[];
  /** Built after the level's last lesson, reviewed before the next level starts. */
  project: string;
}

export interface Curriculum {
  id: string;
  name: string;
  /** How people ask for it: "javascript", "js", "node". */
  match: RegExp;
  /** Language tag for code blocks (```js). */
  codeLang: string;
  /** Where to send them for the reference. */
  docs: string;
  /** What they should know first (offered, never forced). */
  before?: string;
  /**
   * A health program, not a course: it starts with a short health check, its "lesson check" is a check-in
   * on how it's going (changes, reactions, pain), and its level projects are milestone reviews.
   */
  kind?: 'course' | 'program';
  /** Programs: what to ask before giving any plan, one question at a time. */
  screening?: string;
  levels: CourseLevel[];
}
