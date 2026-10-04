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
import { typescript } from './typescript.js';

export type { Curriculum, CourseLesson, CourseLevel } from './types.js';

/** Most specific first: "node js" is Node (not JavaScript), "react js" is React. */
export const CURRICULA: Curriculum[] = [aiApps, dsa, react, nodejs, typescript, htmlCss, sql, git, python, javascript, spokenEnglish, instagram, smallBusiness];

export const curriculum = (id: string): Curriculum | undefined => CURRICULA.find((c) => c.id === id);
