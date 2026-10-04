import type { Curriculum } from './types.js';
import { aiApps } from './aiApps.js';
import { dsa } from './dsa.js';
import { git } from './git.js';
import { htmlCss } from './htmlCss.js';
import { javascript } from './javascript.js';
import { nodejs } from './nodejs.js';
import { python } from './python.js';
import { react } from './react.js';
import { sql } from './sql.js';
import { spokenEnglish } from './spokenEnglish.js';
import { instagram } from './instagram.js';
import { smallBusiness } from './smallBusiness.js';
import { youtube } from './youtube.js';
import { jobSearch } from './jobSearch.js';
import { freelancing } from './freelancing.js';
import { datingConfidenceProgram, lifeResetProgram } from './coachPrograms.js';
import { calmMindProgram, doctorVisitProgram, gymProgram, habitProgram, nutritionProgram, skinProgram, strengthProgram } from './healthPrograms.js';
import { typescript } from './typescript.js';

export type { Curriculum, CourseLesson, CourseLevel } from './types.js';

/** Most specific first: "node js" is Node (not JavaScript), "react js" is React. */
export const CURRICULA: Curriculum[] = [aiApps, dsa, react, nodejs, typescript, htmlCss, sql, git, python, javascript, spokenEnglish, instagram, smallBusiness, youtube, jobSearch, freelancing, skinProgram, nutritionProgram, strengthProgram, gymProgram, habitProgram, calmMindProgram, doctorVisitProgram, lifeResetProgram, datingConfidenceProgram];

export const curriculum = (id: string): Curriculum | undefined => CURRICULA.find((c) => c.id === id);
