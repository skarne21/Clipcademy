import {registerRoot} from 'remotion';
import {CourseRoot} from './Root';

// Separate entry for imported-course clips, so the biology clips' sources (src/) never change.
registerRoot(CourseRoot);
